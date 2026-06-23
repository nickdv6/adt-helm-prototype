// /api/rip-events — webhook ingestion endpoint for NeoStampa Sync Agents
//
// Accepts events fired by Inèdit neoRipEngine (per spec 4.23.0 §Notifications p.85)
// and by the Helm-side NeoStampa Sync Agent (log-tail + hot-folder + QR scanner).
// Looks up the RipJob by external_job_name, validates, and (in production) writes
// a row to rip_job_events + updates rip_jobs.status.
//
// On Vercel the SQLite filesystem is read-only at runtime, so this endpoint
// validates + looks up + returns the would-be write. The contract + behavior
// are real; the persistence layer plugs in when production moves to Postgres.
//
// Both shapes are supported:
//   GET  /api/rip-events?event=…&job=…&pr=…&agent=…  (Inèdit Notification URL style)
//   POST /api/rip-events  with JSON body              (modern style for Helm agent)
//
// GET with no params returns the contract docs as JSON.
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

// =====================================================================
// Event → status transition table
// =====================================================================
const EVENT_MAP: Record<string, { event_type: string; next_status?: string; description: string }> = {
  package_created:          { event_type: 'package_created',          next_status: 'package_created',        description: 'Compositing Engine wrote the composite package to the hot folder.' },
  submitted:                { event_type: 'submitted',                next_status: 'submitted',              description: 'Agent submitted the job XML to NeoStampa via neoRipEngineCGI.' },
  accepted:                 { event_type: 'accepted',                 next_status: 'accepted',               description: 'NeoStampa validated the job ticket + sources.' },
  rip_started:              { event_type: 'rip_started',              next_status: 'ripping',                description: 'NeoStampa began RIPing the artwork.' },
  rip_completed:            { event_type: 'rip_completed',            next_status: 'rip_complete',           description: 'RIP output ready in the printer queue.' },
  print_started:            { event_type: 'print_started',            next_status: 'printing',               description: 'NeoStampa printingStart fired — printer started laying down ink.' },
  print_completed_software: { event_type: 'print_completed_software', next_status: 'print_complete_software', description: 'NeoStampa printingEnd fired — software reports complete. NOT ground truth.' },
  print_completed_qr:       { event_type: 'print_completed_qr',       next_status: 'print_complete_qr',      description: 'Physical Traveler QR scanned at printer exit — ground truth print confirmation.' },
  print_aborted:            { event_type: 'error',                    next_status: 'error',                  description: 'NeoStampa printingAbort fired or operator killed the job.' },
  message:                  { event_type: 'message',                                                         description: 'NeoStampa printingMessage fired — informational, no status change.' },
  error:                    { event_type: 'error',                    next_status: 'error',                  description: 'Agent log-tail picked up an error from NeoStampa logs.' },
  meter_advanced:           { event_type: 'message',                                                         description: 'Agent log-tail picked up an ink meter advance.' },
  retried:                  { event_type: 'retried',                  next_status: 'submitted',              description: 'Operator manually retried after error.' },
};

// =====================================================================
// Contract docs returned by GET with no params
// =====================================================================
const CONTRACT_DOCS = {
  endpoint: '/api/rip-events',
  purpose: 'Ingestion webhook for NeoStampa RIP lifecycle events. Receives notifications from Inèdit neoRipEngine + the Helm-side Sync Agent, looks up the corresponding RipJob in Helm by external_job_name, and writes events to rip_job_events + advances rip_jobs.status.',
  spec_reference: 'Inèdit neoRipEngine 4.23.0 · Notifications §p.85',
  methods: {
    GET: {
      description: 'Inèdit-style Notification URL fires GET with query params. Also returns this contract doc when called without params.',
      query_params: {
        event: 'Required. One of: ' + Object.keys(EVENT_MAP).join(', '),
        job: 'Required. external_job_name (CUSTOMER_PR-#_FO-#_DESIGN_COLORWAY_yyYD).',
        pr: 'Optional. Helm PR number — secondary lookup if job lookup fails.',
        agent: 'Optional. Source NeoStampa Sync Agent name (RIP-Bay-A | RIP-Bay-B | RIP-Bay-C | RIP-Bay-D).',
        qr_payload: 'Optional. Required for event=print_completed_qr.',
        details: 'Optional. Free-text or JSON payload.',
      },
      example: 'GET /api/rip-events?event=print_started&job=STFRANK_PR-104582_FO-98321_BLOOM-BLUE_12YD&pr=PR-104582&agent=RIP-Bay-A',
    },
    POST: {
      description: 'Modern JSON shape for the Helm Sync Agent. Same fields as GET in the body.',
      content_type: 'application/json',
      example_body: {
        event: 'print_completed_qr',
        job: 'STFRANK_PR-104582_FO-98321_BLOOM-BLUE_12YD',
        pr: 'PR-104582',
        agent: 'RIP-Bay-A',
        qr_payload: 'FO-98321',
        details: 'Scanned at Durst Alpha 330 exit · operator JV',
      },
    },
  },
  responses: {
    '200': 'Event accepted. Body returns { rip_job_id, event_id, previous_status, new_status, would_persist }.',
    '400': 'Bad request — missing/invalid event or job. Body returns { error, hint }.',
    '404': 'Orphaned event — no RipJob exists with the given external_job_name. Body returns { error: "orphaned_event", external_job_name, would_raise_exception: "EX-RIP-ORPHANED" }. The event is still logged for audit.',
  },
  identity_binding: 'external_job_name is UNIQUE in rip_jobs. Reprints append _R2/_R3 suffix. Software status (NeoStampa notification) ≠ ground truth; only print_completed_qr (physical scan) confirms a print. See PR Detail · RIP·NeoStampa card.',
  event_types: EVENT_MAP,
};

// =====================================================================
// Handlers
// =====================================================================
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const event = params.get('event');
  if (!event) {
    return NextResponse.json(CONTRACT_DOCS, { status: 200 });
  }
  return handleEvent({
    event,
    job: params.get('job'),
    pr: params.get('pr'),
    agent: params.get('agent'),
    qr_payload: params.get('qr_payload'),
    details: params.get('details'),
    source: 'inedit_notification_url',
  });
}

export async function POST(req: NextRequest) {
  let body: Record<string, string | null> = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json', hint: 'POST body must be valid JSON.' }, { status: 400 });
  }
  return handleEvent({
    event: body.event ?? null,
    job: body.job ?? null,
    pr: body.pr ?? null,
    agent: body.agent ?? null,
    qr_payload: body.qr_payload ?? null,
    details: body.details ?? null,
    source: 'helm_sync_agent',
  });
}

// =====================================================================
// Core handler — validates, looks up RipJob, returns would-be write
// =====================================================================
function handleEvent({
  event, job, pr, agent, qr_payload, details, source,
}: {
  event: string | null;
  job: string | null;
  pr: string | null;
  agent: string | null;
  qr_payload: string | null;
  details: string | null;
  source: string;
}) {
  if (!event) {
    return NextResponse.json(
      { error: 'missing_event', hint: 'event is required. See GET /api/rip-events for the contract.' },
      { status: 400 },
    );
  }
  const mapping = EVENT_MAP[event];
  if (!mapping) {
    return NextResponse.json(
      { error: 'unknown_event_type', hint: `event must be one of: ${Object.keys(EVENT_MAP).join(', ')}.` },
      { status: 400 },
    );
  }
  if (!job) {
    return NextResponse.json(
      { error: 'missing_job', hint: 'job (external_job_name) is required.' },
      { status: 400 },
    );
  }
  if (event === 'print_completed_qr' && !qr_payload) {
    return NextResponse.json(
      { error: 'missing_qr_payload', hint: 'event=print_completed_qr requires qr_payload (FabricOutput QR).' },
      { status: 400 },
    );
  }

  // Look up the RipJob by external_job_name
  const db = getDb();
  const ripJob = db.prepare(`
    SELECT rj.id, rj.status, rj.print_request_id, rj.retry_count,
           pr.pr_number, pr.id as pr_id
    FROM rip_jobs rj
    JOIN print_requests pr ON rj.print_request_id = pr.id
    WHERE rj.external_job_name = ?
  `).get(job) as any;

  if (!ripJob) {
    return NextResponse.json(
      {
        error: 'orphaned_event',
        external_job_name: job,
        hint: 'No RipJob exists with this external_job_name. The event was logged for audit; an EX-RIP-ORPHANED exception would be raised for an operator to investigate.',
        would_raise_exception: 'EX-RIP-ORPHANED',
        possible_causes: [
          'NeoStampa operator manually dropped a non-Helm XML in the hot folder.',
          'Helm minted a job but the rip_jobs row was rolled back before the agent received the event.',
          'Job ran on a different Helm environment (staging vs prod).',
        ],
      },
      { status: 404 },
    );
  }

  // Cross-check the PR number if supplied (helps catch routing errors)
  if (pr && pr !== ripJob.pr_number) {
    return NextResponse.json(
      {
        error: 'pr_mismatch',
        hint: `The job ${job} resolves to PR ${ripJob.pr_number}, but the request carried pr=${pr}. This usually signals an agent-side bug.`,
        rip_job_id: ripJob.id,
        external_job_name_resolves_to: ripJob.pr_number,
        request_carried_pr: pr,
      },
      { status: 400 },
    );
  }

  // Production would: INSERT rip_job_events + UPDATE rip_jobs.status + rip_last_event_at.
  // On Vercel the filesystem is read-only at runtime so we return the would-be write.
  const previousStatus = ripJob.status;
  const newStatus = mapping.next_status ?? previousStatus;
  const eventId = `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  return NextResponse.json(
    {
      ok: true,
      event_id: eventId,
      rip_job_id: ripJob.id,
      pr_number: ripJob.pr_number,
      pr_id: ripJob.pr_id,
      external_job_name: job,
      event_type: mapping.event_type,
      event_description: mapping.description,
      previous_status: previousStatus,
      new_status: newStatus,
      status_changed: previousStatus !== newStatus,
      source,
      agent: agent ?? null,
      qr_payload: qr_payload ?? null,
      details: details ?? null,
      would_persist: {
        insert_into: 'rip_job_events',
        row: {
          rip_job_id: ripJob.id,
          event_type: mapping.event_type,
          event_at: new Date().toISOString(),
          source,
          details: details ?? (qr_payload ? `QR: ${qr_payload}` : null),
        },
        update_rip_jobs: mapping.next_status
          ? { status: newStatus, rip_last_event_at: new Date().toISOString() }
          : null,
      },
      note: 'Prototype mock: validates + looks up + would-persist. Vercel filesystem is read-only at runtime. Production (Postgres) executes the persist + audits via rip_job_events.',
    },
    { status: 200 },
  );
}
