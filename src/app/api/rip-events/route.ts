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
  // ---- Canvas-originated workflow ----
  agent_observed_job:       { event_type: 'agent_observed_job',                                              description: 'Agent observed a new NeoStampa job that ORIGINATED IN THE CANVAS GUI (not in Helm). Helm creates an unattributed RipJob, attempts filename auto-match, and either binds it to a PR or routes it to the Reconciliation Queue.' },
  manual_associate:         { event_type: 'manual_associate',                                                description: 'Operator binds a Canvas-originated NeoStampa job to a Helm PR via the Reconciliation Queue UI. Sets rip_jobs.print_request_id + reconciliation_status=manual_associated.' },
};

// Parse a Canvas filename for high-confidence Helm identifiers.
// Returns the lookup key + confidence score (0-100).
function tryAutoMatch(filename: string): { key: 'pr_number' | 'plant_number'; value: string; confidence: number } | null {
  // PR-#### format
  const prMatch = filename.match(/PR-(\d{4,6})/i);
  if (prMatch) return { key: 'pr_number', value: `PR-${prMatch[1]}`, confidence: 95 };
  // P##-#### (PLANT#)
  const plantMatch = filename.match(/P\d{2}-\d{4}/i);
  if (plantMatch) return { key: 'plant_number', value: plantMatch[0].toUpperCase(), confidence: 70 };
  return null;
}

// =====================================================================
// Contract docs returned by GET with no params
// =====================================================================
const CONTRACT_DOCS = {
  endpoint: '/api/rip-events',
  purpose: 'Ingestion webhook for NeoStampa RIP lifecycle events. Receives notifications from Inèdit neoRipEngine + the Helm-side Sync Agent, looks up the corresponding RipJob in Helm by external_job_name, and writes events to rip_job_events + advances rip_jobs.status. Also handles Canvas-originated jobs (started in the NeoStampa GUI, not in Helm) via the agent_observed_job + manual_associate event pair — see "two origins" below.',
  spec_reference: 'Inèdit neoRipEngine 4.23.0 · Notifications §p.85',
  two_origins: {
    helm: 'Helm minted the external_job_name + wrote the job XML to the hot folder. Agent picks it up and fires standard lifecycle events (package_created → submitted → … → print_completed_qr).',
    neostampa_gui: 'A colorist opened a file in the NeoStampa Canvas, made adjustments, and clicked print. The agent observes the job via log-tail + hot-folder watch and sends an agent_observed_job event. Helm tries to auto-match the filename to a PR (PR-#### or PLANT# match) and either binds it directly or routes it to the Reconciliation Queue for operator review (manual_associate event).',
  },
  reconciliation_flow: [
    '1. Colorist starts a job in NeoStampa Canvas.',
    '2. Agent observes (log-tail / hot-folder watch) and POSTs agent_observed_job to Helm.',
    '3. Helm parses filename for PR-#### (95% confidence) or PLANT# (70%).',
    '4. High-confidence match → bind print_request_id, reconciliation_status=auto_matched, awaits operator confirmation.',
    '5. Low or no match → reconciliation_status=awaiting_review, lands in /printer-queue Reconciliation Queue.',
    '6. Operator clicks "Bind to PR" → POST manual_associate with neostampa_job_id + pr → rip_jobs.print_request_id set, reconciliation_status=manual_associated.',
    '7. Lifecycle events from that point on resolve normally via external_job_name.',
  ],
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

  const db = getDb();

  // ============================================================
  // agent_observed_job — Canvas-originated job announcement
  // ============================================================
  if (event === 'agent_observed_job') {
    // Try to auto-match the filename to a Helm PR.
    const match = tryAutoMatch(job);
    const woundCreate: any = {
      origin: 'neostampa_gui',
      external_job_name: job,
      neostampa_job_id: details ?? null,           // agent sends NS job id in details
      agent: agent ?? null,
      status: 'submitted',
      auto_match_score: 0,
      reconciliation_status: 'awaiting_review',
      print_request_id: null,
    };
    let resolved: any = null;
    if (match) {
      if (match.key === 'pr_number') {
        resolved = db.prepare(`SELECT id, pr_number FROM print_requests WHERE pr_number = ?`).get(match.value);
      } else {
        // Plant# match — look up most recent active PR for any design with that PLANT#
        resolved = db.prepare(`
          SELECT pr.id, pr.pr_number FROM print_requests pr
          JOIN order_lines ol ON pr.order_line_id = ol.id
          JOIN designs d ON ol.design_id = d.id
          WHERE d.plant_number = ? AND pr.status NOT IN ('Closed','Cancelled','Complete')
          ORDER BY pr.created_at DESC LIMIT 1
        `).get(match.value);
      }
      if (resolved) {
        woundCreate.print_request_id = resolved.id;
        woundCreate.auto_match_score = match.confidence;
        woundCreate.reconciliation_status = match.confidence >= 90 ? 'auto_matched' : 'awaiting_review';
      }
    }
    return NextResponse.json({
      ok: true,
      event: 'agent_observed_job',
      external_job_name: job,
      origin: 'neostampa_gui',
      auto_match: match
        ? {
            matched_key: match.key,
            matched_value: match.value,
            confidence: match.confidence,
            resolved_to_pr: resolved ? resolved.pr_number : null,
            decision: resolved
              ? (match.confidence >= 90 ? 'auto_bound · awaits operator confirm' : 'suggested · operator must confirm')
              : 'no_match · routes to Reconciliation Queue',
          }
        : { decision: 'no_helm_identifier_in_filename · routes to Reconciliation Queue' },
      would_persist: {
        insert_into: 'rip_jobs',
        row: woundCreate,
      },
      next_step: resolved
        ? `Visit /print-requests/${resolved.pr_number} to confirm the binding.`
        : 'Operator picks the job up from /printer-queue · Reconciliation Queue and clicks Bind to PR (fires manual_associate).',
      note: 'Prototype mock: validates + auto-matches + returns the would-be write. Production inserts a real rip_jobs row.',
    }, { status: 200 });
  }

  // ============================================================
  // manual_associate — operator binds a Canvas job to a Helm PR
  // ============================================================
  if (event === 'manual_associate') {
    if (!pr) {
      return NextResponse.json(
        { error: 'missing_pr', hint: 'event=manual_associate requires pr (target Helm PR number).' },
        { status: 400 },
      );
    }
    const ripJob = db.prepare(`SELECT id, status, origin, reconciliation_status FROM rip_jobs WHERE external_job_name = ?`).get(job) as any;
    if (!ripJob) {
      return NextResponse.json({ error: 'unknown_job', external_job_name: job }, { status: 404 });
    }
    const targetPr = db.prepare(`SELECT id, pr_number FROM print_requests WHERE pr_number = ?`).get(pr) as any;
    if (!targetPr) {
      return NextResponse.json({ error: 'unknown_pr', pr }, { status: 404 });
    }
    return NextResponse.json({
      ok: true,
      event: 'manual_associate',
      rip_job_id: ripJob.id,
      external_job_name: job,
      bound_to_pr: targetPr.pr_number,
      previous_origin: ripJob.origin,
      previous_reconciliation_status: ripJob.reconciliation_status,
      would_persist: {
        update_rip_jobs: {
          print_request_id: targetPr.id,
          reconciliation_status: 'manual_associated',
        },
        insert_into: 'rip_job_events',
        row: {
          rip_job_id: ripJob.id,
          event_type: 'manual_associate',
          source: 'manual',
          details: details ?? `Bound to ${targetPr.pr_number}`,
        },
      },
      note: 'Prototype mock: validates + returns the would-be write. Production UPDATEs rip_jobs + INSERTs the event in a transaction.',
    }, { status: 200 });
  }

  // ============================================================
  // Standard lifecycle events (existing behavior)
  // ============================================================
  // Look up the RipJob by external_job_name
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
