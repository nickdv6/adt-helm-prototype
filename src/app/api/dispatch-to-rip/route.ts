// /api/dispatch-to-rip — the upstream Helm → NeoStampa handoff
//
// When a PR moves to 'Ready for Scheduling' AND its rip_status is 'not_started',
// this endpoint:
//   1. Validates the PR is dispatchable
//   2. Computes the external_job_name (CUSTOMER_PR-#_FO-#_DESIGN_COLORWAY_yyYD,
//      with _R2/_R3 suffix on reprints to avoid the UNIQUE constraint)
//   3. Picks the hot folder by the PR's printer assignment (or the rush lane
//      on Durst Alpha 330 if the parent order is rush)
//   4. Generates the Inèdit neoRipEngine 4.23.0 XML via buildNeoStampaXml()
//   5. Returns the would-be writes (INSERT rip_jobs + INSERT fabric_outputs +
//      UPDATE print_requests + WRITE file to hot folder + schedule the
//      EX-RIP-NO-CONFIRM watchdog) AND the generated XML inline
//
// Production: executes the writes in one transaction, then the agent
// picks up the XML and the lifecycle events flow back through /api/rip-events.
// Prototype: returns the would-be writes (Vercel FS is read-only at runtime).
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { buildNeoStampaXml, XmlJobInput } from '@/components/neostampa-xml-preview';

export const dynamic = 'force-dynamic';

const CONTRACT = {
  endpoint: '/api/dispatch-to-rip',
  purpose: 'Helm-side dispatcher. Called when a PR is ready to enter the RIP lifecycle. Generates the external job name + the Inèdit XML + selects the hot folder, then writes everything atomically.',
  triggered_by: [
    'Manual button click on PR Detail (operator decides this PR is ready)',
    'Background scheduler that runs every 60s and dispatches any PR where pr.status = Ready for Scheduling AND pr.rip_status = not_started AND not on hold',
    'Bulk action from /printer-queue (Submit Ready) or /intake Auto-RIP Engine (Submit Ready)',
  ],
  methods: {
    POST: {
      content_type: 'application/json',
      body: { pr_id: 'integer (required) — id of the print_requests row to dispatch' },
    },
    GET: 'No params: returns this contract doc.',
  },
  validation_order: [
    'PR exists',
    'PR is not cancelled / closed',
    'PR has a printer assigned (otherwise: cannot pick hot folder)',
    'PR.status is dispatchable: Ready for Scheduling | (Approved Internal Proof = ok)',
    'PR.rip_status is not_started OR error (retries allowed)',
    'PR is not held (rip_jobs.is_held = 1)',
    'If parent order has Customer Strike-Off Required, strike-off must be approved',
    'No active rip_job already exists for this PR (unless this is an explicit reprint)',
  ],
  reprint_collision_handling: 'If a rip_job with the unsuffixed external_job_name already exists, append _R2, then _R3, etc. until no UNIQUE collision. The retry_count on the new rip_jobs row equals the suffix number.',
  hot_folder_selection: [
    'Look up the PR.printer_id',
    'If parent order.is_rush AND the printer has a rush-lane hot folder (is_rush_lane=1), use it',
    'Otherwise use the STANDARD lane for that printer',
    'Fallback: raise EX-2425 Hot Folder Unreachable if no active hot folder exists',
  ],
  watchdog: 'After dispatch, Helm schedules a check at +4h. If no print_completed_software event arrived by then, raises EX-RIP-NO-CONFIRM with a link to the rip_jobs row.',
};

export async function GET() {
  return NextResponse.json(CONTRACT, { status: 200 });
}

export async function POST(req: NextRequest) {
  let body: { pr_id?: number } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json', hint: 'POST body must be valid JSON: { pr_id: <integer> }' }, { status: 400 });
  }
  if (!body.pr_id || typeof body.pr_id !== 'number') {
    return NextResponse.json({ error: 'missing_pr_id', hint: 'pr_id is required.' }, { status: 400 });
  }

  const db = getDb();
  const pr = db.prepare(`
    SELECT pr.id, pr.pr_number, pr.status as pr_status, pr.rip_status, pr.is_held,
           pr.printer_id, pr.planned_yardage, pr.printed_yardage, pr.created_at,
           pr.reprint_of_pr_id,
           ol.order_id, ol.strike_off_classification,
           o.order_number, o.status as order_status, o.is_rush,
           c.name as company_name,
           d.name as design_name, d.plant_number,
           cw.name as colorway_name,
           f.name as fabric_name, f.width_inches as fabric_width_inches,
           p.name as printer_name, p.ink_set
    FROM print_requests pr
    JOIN order_lines ol ON pr.order_line_id = ol.id
    JOIN orders o ON ol.order_id = o.id
    JOIN companies c ON o.company_id = c.id
    LEFT JOIN designs d ON ol.design_id = d.id
    LEFT JOIN colorways cw ON ol.colorway_id = cw.id
    LEFT JOIN fabrics f ON pr.fabric_id = f.id
    LEFT JOIN printers p ON pr.printer_id = p.id
    WHERE pr.id = ?
  `).get(body.pr_id) as any;

  if (!pr) {
    return NextResponse.json({ error: 'pr_not_found', pr_id: body.pr_id }, { status: 404 });
  }

  // ============================================================
  // Validation checks — record each one for the trace
  // ============================================================
  const checks: { name: string; passed: boolean; detail?: string }[] = [];

  checks.push({ name: 'PR exists', passed: true, detail: pr.pr_number });
  checks.push({
    name: 'PR not cancelled / closed',
    passed: !['Cancelled', 'Closed', 'Complete'].includes(pr.pr_status),
    detail: `current status = ${pr.pr_status}`,
  });
  checks.push({
    name: 'PR has printer assigned',
    passed: !!pr.printer_id && !!pr.printer_name,
    detail: pr.printer_name ?? '(no printer)',
  });
  checks.push({
    name: 'PR in dispatchable state',
    passed: ['Ready for Scheduling', 'Scheduled'].includes(pr.pr_status),
    detail: `pr.status = ${pr.pr_status}; allowed: Ready for Scheduling`,
  });
  checks.push({
    name: 'PR rip_status allows dispatch',
    passed: ['not_started', 'error'].includes(pr.rip_status),
    detail: `pr.rip_status = ${pr.rip_status}; allowed: not_started | error (retry)`,
  });
  checks.push({
    name: 'PR not on hold',
    passed: pr.is_held !== 1,
    detail: pr.is_held === 1 ? 'PR is held — must be released first' : 'not held',
  });
  if (pr.strike_off_classification === 'Customer Strike-Off Required') {
    const so = db.prepare(`
      SELECT customer_decision_outcome FROM strike_offs WHERE print_request_id = ?
      ORDER BY id DESC LIMIT 1
    `).get(pr.id) as any;
    checks.push({
      name: 'Customer strike-off approved (required by OD-9 class)',
      passed: so && ['Approved', 'Approve with Changes'].includes(so.customer_decision_outcome),
      detail: so ? `latest decision: ${so.customer_decision_outcome ?? 'pending'}` : 'no strike-off recorded',
    });
  }

  // Reprint handling: append _R2/_R3 suffix until no UNIQUE collision
  const customer = (pr.company_name ?? 'UNKNOWN').toUpperCase().replace(/&/g, 'AND').replace(/[^A-Z0-9]+/g, '');
  const design = (pr.design_name ?? 'UNKNOWN').toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '');
  const colorway = (pr.colorway_name ?? 'DEFAULT').toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '');
  const yards = Math.round(pr.planned_yardage ?? 0);
  const baseName = `${customer}_PR-${pr.id}`;
  const foId = `FO-${90000 + pr.id}`;
  const baseExternalJobName = `${baseName}_${foId}_${design}_${colorway}_${yards}YD`;

  // Find the next available suffix
  let externalJobName = baseExternalJobName;
  let suffix = 1;
  while (db.prepare(`SELECT 1 FROM rip_jobs WHERE external_job_name = ?`).get(externalJobName)) {
    suffix++;
    externalJobName = `${baseExternalJobName}_R${suffix}`;
  }
  const isReprint = suffix > 1;
  checks.push({
    name: 'No name collision',
    passed: true,
    detail: isReprint
      ? `collision detected → appended _R${suffix} suffix (reprint scenario)`
      : 'unique external_job_name reserved',
  });

  const allPassed = checks.every((c) => c.passed);

  // ============================================================
  // Hot folder selection
  // ============================================================
  const hotFolder = pr.printer_id ? db.prepare(`
    SELECT hf.*, a.name as agent_name
    FROM hot_folders hf
    LEFT JOIN neostampa_agents a ON hf.neostampa_agent_id = a.id
    WHERE hf.printer_id = ? AND hf.is_active = 1
      ${pr.is_rush ? '' : 'AND hf.is_rush_lane = 0'}
    ORDER BY hf.is_rush_lane DESC
    LIMIT 1
  `).get(pr.printer_id) as any : null;

  if (allPassed) {
    checks.push({
      name: 'Hot folder available',
      passed: !!hotFolder,
      detail: hotFolder
        ? `${hotFolder.name} (${hotFolder.unc_path}) · agent ${hotFolder.agent_name}${pr.is_rush && hotFolder.is_rush_lane ? ' · RUSH LANE' : ''}`
        : 'no active hot folder for this printer → would raise EX-2425',
    });
  }

  const dispatchable = allPassed && !!hotFolder;

  // ============================================================
  // Generate the XML (only if validation passed)
  // ============================================================
  let xml: string | null = null;
  if (dispatchable) {
    const xmlInput: XmlJobInput = {
      prNumber: pr.pr_number,
      prId: pr.id,
      externalJobName,
      fabricOutputPayload: foId,
      customerName: pr.company_name,
      designName: pr.design_name,
      plantNumber: pr.plant_number,
      colorwayName: pr.colorway_name,
      fabricName: pr.fabric_name,
      fabricWidthIn: pr.fabric_width_inches,
      printWidthIn: pr.fabric_width_inches ? pr.fabric_width_inches - 2 : null,
      printedYards: pr.planned_yardage,
      printerName: pr.printer_name,
      inkSet: pr.ink_set ?? 'Pigment',
      iccProfileFile: null,
      hotFolderPath: hotFolder.unc_path,
      agentName: hotFolder.agent_name,
    };
    xml = buildNeoStampaXml(xmlInput);
  }

  return NextResponse.json(
    {
      ok: dispatchable,
      pr_id: pr.id,
      pr_number: pr.pr_number,
      validation: {
        passed: allPassed && !!hotFolder,
        checks,
      },
      ...(dispatchable ? {
        external_job_name: externalJobName,
        is_reprint: isReprint,
        retry_count: suffix - 1,
        hot_folder: {
          id: hotFolder.id,
          name: hotFolder.name,
          unc_path: hotFolder.unc_path,
          agent: hotFolder.agent_name,
          is_rush_lane: hotFolder.is_rush_lane === 1,
        },
        xml,
        would_persist: {
          // All four happen in one transaction
          insert_fabric_outputs: {
            row: {
              qr_payload: foId,
              print_request_id: pr.id,
              generated_at: new Date().toISOString(),
              yards_produced: null,
              status: 'pending_print',
            },
          },
          insert_rip_jobs: {
            row: {
              print_request_id: pr.id,
              origin: 'helm',
              neostampa_job_id: null,
              external_job_name: externalJobName,
              fabric_output_id: '<id from fabric_outputs INSERT>',
              status: 'package_created',
              hot_folder_id: hotFolder.id,
              neostampa_agent_id: '<from hot_folders.neostampa_agent_id>',
              package_path: `\\\\nas\\packages\\${externalJobName.toLowerCase()}.prn`,
              retry_count: suffix - 1,
              auto_match_score: 100,
              reconciliation_status: 'attributed',
            },
          },
          update_print_requests: {
            where: { id: pr.id },
            set: {
              external_job_name: externalJobName,
              fabric_output_id: '<id from fabric_outputs INSERT>',
              current_rip_job_id: '<id from rip_jobs INSERT>',
              rip_status: 'package_created',
              rip_last_event_at: new Date().toISOString(),
            },
          },
          write_file: {
            path: `${hotFolder.unc_path}${externalJobName}.xml`,
            content_bytes: xml ? xml.length : 0,
            description: 'Inèdit neoRipEngine job ticket XML. Agent watcher picks it up within ~30s and submits to neoRipEngineCGI.',
          },
          schedule_watchdog: {
            check_at: new Date(Date.now() + 4 * 3600 * 1000).toISOString(),
            on_failure: 'Raise EX-RIP-NO-CONFIRM exception with link to rip_jobs row. Notifies print_op + colorist.',
          },
        },
        note: 'Prototype mock: returns the would-be writes + the generated XML. Production runs all four writes in a transaction + drops the file in the hot folder + queues the watchdog timer.',
      } : {
        dispatch_blocked: true,
        reason: !allPassed ? 'Validation failed — see checks[] for details.' : 'No hot folder available for this printer.',
      }),
    },
    { status: dispatchable ? 200 : 400 },
  );
}
