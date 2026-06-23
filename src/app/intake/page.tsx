import Link from 'next/link';
import { getDb } from '@/lib/db';
import { Card, CardHeader, Tag, Button, StatusPill } from '@/components/ui';
import {
  ArrowRight, Wand2, AlertTriangle, CheckCircle2, Clock, RotateCw, FileText, Printer,
  ScanLine, Layers, FileWarning, Settings, Activity, ImagePlus,
} from 'lucide-react';

// /intake — Automated Print Intake Command Center
// Per Nick: extends the existing CSV/XML intake page into the front end of the automated
// production engine. Operator manages exceptions rather than building jobs.
//
// This page does NOT replace existing modules — it surfaces and links into:
//   /customer-configs   (Customer Automation Profiles — already exist there)
//   /print-requests     (PR Dashboard, drilldown)
//   /printer-queue      (Hot folder + printer cards)
//   /exceptions         (Exception Center)
//   /po-intake          (PDF PO intake — parallel intake channel)
//   /designs            (Design records — used by Design Retrieval)
//   /rolls              (FabricOutput / roll registry)
//   /packing-correction (Backtracking)
// Each section in this Command Center is a window into one stage of the pipeline; deep work
// happens on the existing page that owns that stage.

// =====================================================================
// Mock data — per-customer pipeline state
// =====================================================================

type PipelineRow = {
  customer: string;
  source: string;
  last_import: string;
  import_status: 'ok' | 'error' | 'paused';
  orders_today: number;
  prs_created_today: number;
  design_match_rate: number;     // 0-100
  colorway_match_rate: number;   // 0-100
  strikeoffs_required: number;
  auto_approved: number;
  exceptions: number;
  printer_route: string;
  submission_status: 'submitted' | 'queued' | 'failed';
};

const PIPELINE: PipelineRow[] = [
  { customer: 'Havenly / The Inside', source: 'Shopify packing list (email)', last_import: '4 min ago', import_status: 'ok',
    orders_today: 18, prs_created_today: 18, design_match_rate: 100, colorway_match_rate: 100,
    strikeoffs_required: 0, auto_approved: 18, exceptions: 0,
    printer_route: 'MS JP4-A (Dye Sub) · MS JP4-B fallback', submission_status: 'submitted' },
  { customer: 'St. Frank', source: 'CSV via SFTP', last_import: '12 min ago', import_status: 'ok',
    orders_today: 7, prs_created_today: 12, design_match_rate: 92, colorway_match_rate: 100,
    strikeoffs_required: 1, auto_approved: 11, exceptions: 1,
    printer_route: 'MS JP7 (Fiber Reactive)', submission_status: 'submitted' },
  { customer: 'Laura Park Designs', source: 'CSV via email watcher', last_import: '24 min ago', import_status: 'ok',
    orders_today: 9, prs_created_today: 9, design_match_rate: 100, colorway_match_rate: 78,
    strikeoffs_required: 2, auto_approved: 7, exceptions: 0,
    printer_route: 'Durst Alpha 330 (Pigment)', submission_status: 'queued' },
  { customer: 'House of MBR', source: 'CSV via email watcher', last_import: '47 min ago', import_status: 'ok',
    orders_today: 3, prs_created_today: 3, design_match_rate: 100, colorway_match_rate: 100,
    strikeoffs_required: 0, auto_approved: 3, exceptions: 0,
    printer_route: 'Customer-supplied label · pulled from stored inventory', submission_status: 'submitted' },
  { customer: 'Lemieux Et Cie', source: 'CSV via email watcher', last_import: '1h 14m ago', import_status: 'ok',
    orders_today: 2, prs_created_today: 2, design_match_rate: 100, colorway_match_rate: 100,
    strikeoffs_required: 2, auto_approved: 0, exceptions: 0,
    printer_route: 'MS JP7 (after strike-off approval)', submission_status: 'queued' },
  { customer: 'Jordan Connelly', source: 'CSV via email watcher', last_import: '3h ago', import_status: 'error',
    orders_today: 0, prs_created_today: 0, design_match_rate: 0, colorway_match_rate: 0,
    strikeoffs_required: 0, auto_approved: 0, exceptions: 1,
    printer_route: 'TBD', submission_status: 'failed' },
  { customer: 'Kravet (PDF PO)', source: 'PDF PO intake', last_import: '8 min ago', import_status: 'ok',
    orders_today: 14, prs_created_today: 22, design_match_rate: 95, colorway_match_rate: 90,
    strikeoffs_required: 1, auto_approved: 20, exceptions: 1,
    printer_route: 'MS JP7 + Durst Alpha 330 (per SKU)', submission_status: 'submitted' },
];

type StrikeOffDecision = {
  when: string;
  pr_number: string;
  customer: string;
  design: string;
  colorway: string;
  decision: 'required' | 'skipped (approved repeat)' | 'auto-approved (CAP eligible)';
  reason: string;
};

const STRIKEOFF_FEED: StrikeOffDecision[] = [
  { when: '2 min ago', pr_number: 'PR-12101', customer: 'St. Frank', design: 'Cypress', colorway: 'Indigo',
    decision: 'skipped (approved repeat)', reason: 'Design+Colorway+Fabric combo last printed 14 days ago (PR-11942) · CAP eligible · no requalification due' },
  { when: '8 min ago', pr_number: 'PR-12099', customer: 'Lemieux Et Cie', design: 'Textured', colorway: 'Natural',
    decision: 'required', reason: 'Customer rule: Always require strike-off · customer-approved tokenized email sent to Margaret O\'Brien · awaiting response' },
  { when: '14 min ago', pr_number: 'PR-12097', customer: 'Laura Park Designs', design: 'Marigold', colorway: 'Yellow',
    decision: 'required', reason: 'New colorway · no prior production history found for Marigold + Yellow + Cotton Sateen 110-thread combo' },
  { when: '22 min ago', pr_number: 'PR-12094', customer: 'Havenly / The Inside', design: 'Sage Block', colorway: 'Olive',
    decision: 'skipped (approved repeat)', reason: 'Customer rule: Never (stored-inventory model, pre-approved combos)' },
  { when: '34 min ago', pr_number: 'PR-12089', customer: 'St. Frank', design: 'Coral', colorway: 'Pink',
    decision: 'required', reason: 'ICC profile changed on 2026-06-15 · requires requalification per customer profile · Jeannine to review' },
  { when: '48 min ago', pr_number: 'PR-12085', customer: 'Havenly / The Inside', design: 'Cypress', colorway: 'Indigo',
    decision: 'auto-approved (CAP eligible)', reason: 'Click-and-Print flag on this Design+Colorway+Fabric · routed direct to MS JP4-A hot folder' },
];

type SubmissionEvent = {
  when: string;
  pr_number: string;
  customer: string;
  printer: string;
  status: 'submitted' | 'queued' | 'failed';
  detail: string;
};

const SUBMISSIONS: SubmissionEvent[] = [
  { when: 'just now', pr_number: 'PR-12104', customer: 'Havenly', printer: 'MS JP4-A', status: 'submitted', detail: 'XML written to \\\\adt-nas\\hotfolder\\jp4a\\PR-12104.xml · 0.4s' },
  { when: '1 min ago', pr_number: 'PR-12101', customer: 'St. Frank', printer: 'MS JP7', status: 'submitted', detail: 'XML generated + sent · Parent QR PQ-A4F7-B12 embedded in leader margin' },
  { when: '4 min ago', pr_number: 'PR-12097', customer: 'Laura Park', printer: 'Durst Alpha 330', status: 'queued', detail: 'Waiting on strike-off approval · will resubmit on approval' },
  { when: '11 min ago', pr_number: 'PR-12091', customer: 'St. Frank', printer: 'MS JP7', status: 'submitted', detail: 'Auto-routed (CSV intake · CAP eligible) · 2,431 yds queued' },
  { when: '18 min ago', pr_number: 'PR-12088', customer: 'Jordan Connelly', printer: '(unrouted)', status: 'failed', detail: 'No printer route configured for Jordan Connelly · open Customer Config to assign' },
  { when: '25 min ago', pr_number: 'PR-12086', customer: 'Kravet', printer: 'MS JP7', status: 'failed', detail: 'Design file not found at expected NAS path — falling back to OCR PO data, CSR review required' },
];

type ScanEvent = {
  when: string;
  user: string;
  station: string;
  action: string;
  context: string;
  fabric_output_qr?: string;
  bundle_qr?: string;
};

const SCAN_FEED: ScanEvent[] = [
  { when: '12s ago', user: 'Jeannine R.', station: 'MS JP7 · post-print',     action: 'Printed',        context: 'PR-12091 · 250 yd · Pass',         fabric_output_qr: 'FQ-A4F7-B12' },
  { when: '47s ago', user: 'Lucio H.',    station: 'Heat Press #2',           action: 'Transferred',    context: 'PR-12001 (dye sub) · transfer ok', fabric_output_qr: 'FQ-9921-X44' },
  { when: '2 min',   user: 'Yuliana C.',  station: 'Cutting Table A',         action: 'Cut',            context: 'PR-12087 → Bundle B-12087-A',      bundle_qr: 'BQ-12087-A' },
  { when: '4 min',   user: 'Maya C.',     station: 'Durst Alpha · loader',    action: 'Steamed',        context: 'PR-12089 · Steam cycle complete',  fabric_output_qr: 'FQ-D4E5-2845' },
  { when: '7 min',   user: 'Yuliana C.',  station: 'Inspection Bench',        action: 'Inspected',      context: 'B-12085-A · Pass with Notes',      bundle_qr: 'BQ-12085-A' },
  { when: '11 min',  user: 'Lucio H.',    station: 'Packing Bench',           action: 'Packed',         context: 'B-12082-B · into roll 100',        bundle_qr: 'BQ-12082-B' },
  { when: '14 min',  user: 'Maya C.',     station: 'Tenter Frame',            action: 'Tentered',       context: 'PR-12080 · dimensional check ok',  fabric_output_qr: 'FQ-7711-2204' },
];

type CompositeEvent = {
  when: string;
  pr_number: string;
  customer: string;
  qr_payload: string;
  status: 'generated' | 'pending' | 'failed';
  detail: string;
};

const COMPOSITES: CompositeEvent[] = [
  { when: 'just now',  pr_number: 'PR-12104', customer: 'Havenly',     qr_payload: 'ADT-4742', status: 'generated', detail: '\\\\adt-nas\\composites\\ADT-4742\\PR-12104.tif (composite + QR + metadata strip)' },
  { when: '2 min ago', pr_number: 'PR-12101', customer: 'St. Frank',   qr_payload: 'ADT-4506', status: 'generated', detail: '\\\\adt-nas\\composites\\ADT-4506\\PR-12101.tif' },
  { when: '5 min ago', pr_number: 'PR-12097', customer: 'Laura Park',  qr_payload: 'ADT-4619', status: 'pending',   detail: 'In queue · awaiting source artwork retrieval' },
  { when: '11 min',    pr_number: 'PR-12086', customer: 'Kravet',      qr_payload: '2581754',  status: 'failed',    detail: 'Source artwork not found at expected NAS path — Composite Generation Failure exception raised' },
  { when: '18 min',    pr_number: 'PR-12082', customer: 'St. Frank',   qr_payload: 'ADT-4500', status: 'generated', detail: '\\\\adt-nas\\composites\\ADT-4500\\PR-12082.tif' },
  { when: '32 min',    pr_number: 'PR-12080', customer: 'Lemieux',     qr_payload: 'ADT-4488', status: 'failed',    detail: 'QR encode failed — payload exceeded 96 char limit (current payload includes extended metadata in error)' },
];

// Top-level metrics
const METRICS = {
  orders_today: 53,
  prs_created_today: 69,
  automation_pct: 87,        // % of PRs that needed no manual intervention
  manual_pct: 13,
  strikeoffs_required: 6,
  pending_approvals: 4,
  printer_queue_total: 14,   // PRs sitting in any hot folder
  exception_count: 3,
  rip_failures_today: 2,
  avg_minutes_intake_to_print: 11,
  label_print_failures_today: 0,
  top_customer: 'Havenly / The Inside',
  most_active_printer: 'MS JP4-A',
};

// =====================================================================
// Page
// =====================================================================

export default function IntakeCommandCenter() {
  return (
    <div className="max-w-7xl mx-auto space-y-5 pb-12">
      <header>
        <h1 className="text-2xl font-bold text-navy-900">Intake Command Center</h1>
        <p className="text-sm text-gray-500 mt-1">
          Automated print intake pipeline · CSV · XML · API · Shopify · FTP · folder watchers · PDF PO · operator manages exceptions, not setup
        </p>
      </header>

      {/* Production flow visual */}
      <Card>
        <div className="p-4 overflow-x-auto">
          <ProductionFlow />
        </div>
      </Card>

      {/* Metric tiles — Command Center */}
      <div className="grid grid-cols-6 gap-3">
        <Metric label="Orders today"          value={METRICS.orders_today} accent="blue" />
        <Metric label="PRs created"           value={METRICS.prs_created_today} />
        <Metric label="Automation"            value={`${METRICS.automation_pct}%`} accent="green" />
        <Metric label="Manual intervention"   value={`${METRICS.manual_pct}%`} accent="yellow" />
        <Metric label="Strike-offs required"  value={METRICS.strikeoffs_required} accent="yellow" />
        <Metric label="Pending approvals"     value={METRICS.pending_approvals} accent="yellow" />

        <Metric label="Hot-folder queue"      value={METRICS.printer_queue_total} accent="blue" />
        <Metric label="Active exceptions"     value={METRICS.exception_count} accent="red" />
        <Metric label="RIP failures today"    value={METRICS.rip_failures_today} accent="red" />
        <Metric label="Avg intake → print"    value={`${METRICS.avg_minutes_intake_to_print} min`} />
        <Metric label="Top customer"          value={METRICS.top_customer} compact />
        <Metric label="Most active printer"   value={METRICS.most_active_printer} compact />
      </div>

      {/* Per-customer pipeline status — the main table */}
      <Card>
        <CardHeader
          title="Customer Pipeline Status"
          subtitle="One row per active customer program · click into Customer Configs to add or edit a profile · automation rates and exceptions drive operator focus"
          action={
            <Link href="/customer-configs">
              <Button variant="secondary" size="sm"><Settings className="w-3.5 h-3.5 mr-1" />Customer Configs →</Button>
            </Link>
          }
        />
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-gray-500 uppercase tracking-wider border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="text-left px-3 py-2">Customer</th>
                <th className="text-left px-3 py-2">Source</th>
                <th className="text-left px-3 py-2">Last import</th>
                <th className="text-left px-3 py-2">Status</th>
                <th className="text-right px-3 py-2">Orders</th>
                <th className="text-right px-3 py-2">PRs</th>
                <th className="text-right px-3 py-2">Design match</th>
                <th className="text-right px-3 py-2">Colorway match</th>
                <th className="text-right px-3 py-2">Strike-offs</th>
                <th className="text-right px-3 py-2">Auto approved</th>
                <th className="text-right px-3 py-2">Exceptions</th>
                <th className="text-left px-3 py-2">Printer route</th>
                <th className="text-left px-3 py-2">Submission</th>
              </tr>
            </thead>
            <tbody>
              {PIPELINE.map((row) => (
                <tr key={row.customer} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-3 py-2 font-semibold">{row.customer}</td>
                  <td className="px-3 py-2 text-gray-600">{row.source}</td>
                  <td className="px-3 py-2 text-gray-500">{row.last_import}</td>
                  <td className="px-3 py-2">
                    {row.import_status === 'ok' && <Tag color="green">OK</Tag>}
                    {row.import_status === 'error' && <Tag color="red">Error</Tag>}
                    {row.import_status === 'paused' && <Tag color="gray">Paused</Tag>}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">{row.orders_today}</td>
                  <td className="px-3 py-2 text-right font-mono">{row.prs_created_today}</td>
                  <td className="px-3 py-2 text-right">
                    <MatchRate pct={row.design_match_rate} />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <MatchRate pct={row.colorway_match_rate} />
                  </td>
                  <td className="px-3 py-2 text-right font-mono">
                    {row.strikeoffs_required > 0 ? <Tag color="yellow">{row.strikeoffs_required}</Tag> : <span className="text-gray-400">0</span>}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">{row.auto_approved}</td>
                  <td className="px-3 py-2 text-right">
                    {row.exceptions > 0 ? <Tag color="red">{row.exceptions}</Tag> : <span className="text-gray-400 font-mono">0</span>}
                  </td>
                  <td className="px-3 py-2 text-gray-600">{row.printer_route}</td>
                  <td className="px-3 py-2">
                    {row.submission_status === 'submitted' && <Tag color="green">Submitted</Tag>}
                    {row.submission_status === 'queued' && <Tag color="blue">Queued</Tag>}
                    {row.submission_status === 'failed' && <Tag color="red">Failed</Tag>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2 border-t border-gray-100 text-[11px] text-gray-500 italic">
          New customer programs are onboarded entirely via configuration in <Link href="/customer-configs" className="text-navy-700 hover:underline">Customer Configs</Link> — no dev required.
        </div>
      </Card>

      {/* Strike-Off Engine + Submission Status side-by-side */}
      <div className="grid grid-cols-2 gap-5">
        <Card>
          <CardHeader
            title="Strike-Off Engine · Recent Decisions"
            subtitle="Every decision shows its reason · operators never guess"
            action={<Wand2 className="w-4 h-4 text-navy-700" />}
          />
          <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
            {STRIKEOFF_FEED.map((d, i) => (
              <div key={i} className="px-4 py-2.5 text-xs">
                <div className="flex items-center justify-between mb-1">
                  <div>
                    <Link href="/print-requests/1" className="font-mono font-semibold text-navy-700 hover:underline">{d.pr_number}</Link>
                    <span className="text-gray-500 ml-2">{d.customer}</span>
                  </div>
                  <DecisionTag decision={d.decision} />
                </div>
                <div className="text-gray-600">{d.design} · {d.colorway}</div>
                <div className="text-gray-500 mt-0.5 italic">"{d.reason}"</div>
                <div className="text-[10px] text-gray-400 mt-0.5">{d.when}</div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Submission Status · XML → Hot Folder"
            subtitle="Auto-generated XML pushed to printer hot folders · retry any failure"
            action={
              <Link href="/printer-queue" className="text-xs text-navy-700 hover:underline font-semibold">
                Printer Queue →
              </Link>
            }
          />
          <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
            {SUBMISSIONS.map((s, i) => (
              <div key={i} className="px-4 py-2.5 text-xs">
                <div className="flex items-center justify-between mb-1">
                  <div>
                    <Link href="/print-requests/1" className="font-mono font-semibold text-navy-700 hover:underline">{s.pr_number}</Link>
                    <span className="text-gray-500 ml-2">{s.customer}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <SubmissionTag status={s.status} />
                    {s.status === 'failed' && <Button size="sm" variant="ghost"><RotateCw className="w-3 h-3 mr-1" />Retry</Button>}
                  </div>
                </div>
                <div className="text-gray-500 italic">→ {s.printer}</div>
                <div className="text-gray-600 mt-0.5">{s.detail}</div>
                <div className="text-[10px] text-gray-400 mt-0.5">{s.when}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Traveler Compositing Engine */}
      <Card>
        <CardHeader
          title="Traveler Compositing Engine · Recent Composites"
          subtitle="Generates the composite print asset (original artwork + Traveler QR + human-readable metadata strip) before XML is routed to the printer's hot folder · reusable across customers · failures surface here as exceptions"
          action={
            <span className="inline-flex items-center gap-1.5 text-xs text-gray-500">
              <ImagePlus className="w-3.5 h-3.5 text-navy-700" />
              Composite library
            </span>
          }
        />
        <table className="w-full text-xs">
          <thead className="text-gray-500 uppercase tracking-wider border-b border-gray-200 bg-gray-50">
            <tr>
              <th className="text-left px-3 py-2">When</th>
              <th className="text-left px-3 py-2">PR</th>
              <th className="text-left px-3 py-2">Customer</th>
              <th className="text-left px-3 py-2">QR Payload</th>
              <th className="text-left px-3 py-2">Status</th>
              <th className="text-left px-3 py-2">Composite file / Error</th>
              <th className="text-right px-3 py-2 pr-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {COMPOSITES.map((c, i) => (
              <tr key={i} className="border-t border-gray-100 hover:bg-gray-50">
                <td className="px-3 py-1.5 text-gray-500">{c.when}</td>
                <td className="px-3 py-1.5">
                  <Link href="/print-requests/1" className="font-mono font-semibold text-navy-700 hover:underline">{c.pr_number}</Link>
                </td>
                <td className="px-3 py-1.5">{c.customer}</td>
                <td className="px-3 py-1.5 font-mono">{c.qr_payload}</td>
                <td className="px-3 py-1.5">
                  {c.status === 'generated' && <Tag color="green">Generated</Tag>}
                  {c.status === 'pending' && <Tag color="blue">Pending</Tag>}
                  {c.status === 'failed' && <Tag color="red">Failed</Tag>}
                </td>
                <td className="px-3 py-1.5">
                  {c.status === 'failed'
                    ? <span className="text-red-700 italic">{c.detail}</span>
                    : <span className="font-mono text-[10px] text-gray-500 break-all">{c.detail}</span>}
                </td>
                <td className="px-3 py-1.5 text-right pr-3">
                  {c.status === 'failed' && <Button size="sm" variant="ghost"><RotateCw className="w-3 h-3 mr-1" />Retry</Button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-4 py-2 border-t border-gray-100 text-[11px] text-gray-500 italic">
          <strong>Traveler QR payload</strong> is the lookup key (today: PO# / Order ID; extensible to PR# / line id / customer / VPN / fabric).
          Printed text near the QR is display metadata only — never baked into the QR itself.
          The Compositing Engine runs per customer via the routing rules in <Link href="/customer-configs" className="text-navy-700 hover:underline">Customer Configs</Link>.
        </div>
      </Card>

      {/* Auto-RIP Engine — NeoStampa Phase 1
          The Compositing Engine above produces a package; the Auto-RIP Engine submits it
          to NeoStampa, watches the hot folder, and tracks RIP lifecycle through to print + QR confirm. */}
      <AutoRipEngine />

      {/* Scan Event Engine */}
      <Card>
        <CardHeader
          title="Scan Event Engine · Live MES Activity"
          subtitle="Every scan updates status automatically · no manual status updates anywhere · FabricOutput QRs follow the fabric through print → wash → tenter → inspect → cut, Bundle QRs take over from cut → sew → pack → ship"
          action={
            <span className="inline-flex items-center gap-1.5 text-xs text-gray-500"><Activity className="w-3.5 h-3.5 text-green-600" />live</span>
          }
        />
        <table className="w-full text-xs">
          <thead className="text-gray-500 uppercase tracking-wider border-b border-gray-200 bg-gray-50">
            <tr>
              <th className="text-left px-3 py-2">When</th>
              <th className="text-left px-3 py-2">User</th>
              <th className="text-left px-3 py-2">Station</th>
              <th className="text-left px-3 py-2">Action</th>
              <th className="text-left px-3 py-2">Context</th>
              <th className="text-left px-3 py-2">Identifier</th>
            </tr>
          </thead>
          <tbody>
            {SCAN_FEED.map((e, i) => (
              <tr key={i} className="border-t border-gray-100 hover:bg-gray-50">
                <td className="px-3 py-1.5 text-gray-500">{e.when}</td>
                <td className="px-3 py-1.5">{e.user}</td>
                <td className="px-3 py-1.5 text-gray-600">{e.station}</td>
                <td className="px-3 py-1.5"><ActionTag action={e.action} /></td>
                <td className="px-3 py-1.5 text-gray-600">{e.context}</td>
                <td className="px-3 py-1.5 font-mono text-navy-700">
                  {e.fabric_output_qr && <span title="FabricOutput QR — embedded in sacrificial trim">{e.fabric_output_qr}</span>}
                  {e.bundle_qr && <span title="Bundle QR — permanent traveler label printed on Zebra ZT400">{e.bundle_qr}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-4 py-2 border-t border-gray-100 text-[11px] text-gray-500 italic">
          <strong>QR transition at cutting:</strong> the temporary FabricOutput QR is scanned one last time before cutting · Helm generates Bundle records and prints permanent traveler labels (Zebra ZT400 · bundle ID, PR #, customer, product type, qty, destination workstation, barcode, QR). Bundle labels carry the identity through sewing, packing, and shipping.
        </div>
      </Card>

      {/* Cross-links to the rest of the subsystem */}
      <div className="grid grid-cols-4 gap-3">
        <CrossLink href="/exceptions" icon={<FileWarning className="w-4 h-4" />} title="Exception Center"
          subtitle={`${METRICS.exception_count} active · retry · reassign · override · escalate`} />
        <CrossLink href="/printer-queue" icon={<Printer className="w-4 h-4" />} title="Printer Queue"
          subtitle={`${METRICS.printer_queue_total} PRs in hot folders · per-printer cards · intelligent batching`} />
        <CrossLink href="/rolls" icon={<Layers className="w-4 h-4" />} title="Created Rolls"
          subtitle="FabricOutput → roll registry · backtrack roll-creation errors" />
        <CrossLink href="/po-intake" icon={<FileText className="w-4 h-4" />} title="PDF PO Intake"
          subtitle="Drag PDF POs · auto-extract Kravet/Schumacher/etc. · parallel intake channel" />
      </div>
    </div>
  );
}

// =====================================================================
// Production flow breadcrumb
// =====================================================================

function ProductionFlow() {
  const steps = [
    { label: 'Order Source', detail: 'CSV · XML · API · Shopify · PDF PO' },
    { label: 'Intake', detail: 'This page' },
    { label: 'Design Retrieval', detail: 'Match · history · approval' },
    { label: 'Strike-Off Engine', detail: 'Decide · reason logged' },
    { label: 'File Retrieval', detail: 'NAS pull · per customer profile' },
    { label: 'XML Gen', detail: 'Auto · per printer template' },
    { label: 'Hot Folder', detail: 'Submit · retry on fail' },
    { label: 'Printer', detail: 'JP7 · Alpha · JP4-A/B · Latex · Zimmer' },
    { label: 'FabricOutput QR', detail: 'Temp · in sacrificial trim' },
    { label: 'Scan Events', detail: 'Print · Steam · Wash · Tenter · Inspect' },
    { label: 'Bundle QR', detail: 'Permanent · Zebra ZT400 traveler' },
    { label: 'Sew · Pack · Ship', detail: 'Bundle identity carried through' },
  ];
  return (
    <div className="flex items-center gap-1 text-[10px] whitespace-nowrap min-w-fit">
      {steps.map((s, i) => (
        <div key={i} className="flex items-center gap-1">
          <div className={`border rounded px-2 py-1.5 ${i === 1 ? 'border-navy-700 bg-navy-50 text-navy-900' : 'border-gray-200 bg-white text-gray-600'}`}>
            <div className={`font-semibold ${i === 1 ? 'text-navy-900' : ''}`}>{s.label}</div>
            <div className="text-gray-400 mt-0.5">{s.detail}</div>
          </div>
          {i < steps.length - 1 && <ArrowRight className="w-3 h-3 text-gray-400 flex-shrink-0" />}
        </div>
      ))}
    </div>
  );
}

// =====================================================================
// Small components
// =====================================================================

function Metric({ label, value, accent, compact }: { label: string; value: any; accent?: 'red' | 'yellow' | 'green' | 'blue'; compact?: boolean }) {
  const bar = {
    yellow: 'bg-helm-yellow', red: 'bg-helm-red', green: 'bg-helm-green', blue: 'bg-helm-blue',
  }[accent || ''] || 'bg-gray-200';
  return (
    <Card>
      <div className="p-3 flex items-center gap-2.5">
        <div className={`w-1 h-9 rounded ${bar}`} />
        <div className="min-w-0">
          <div className={`${compact ? 'text-xs' : 'text-xl'} font-bold text-navy-900 leading-tight truncate`}>{value}</div>
          <div className="text-[10px] text-gray-500 uppercase tracking-wider mt-0.5">{label}</div>
        </div>
      </div>
    </Card>
  );
}

function MatchRate({ pct }: { pct: number }) {
  const color = pct >= 95 ? 'text-green-700' : pct >= 80 ? 'text-yellow-700' : 'text-red-700';
  return <span className={`font-mono ${color}`}>{pct}%</span>;
}

function DecisionTag({ decision }: { decision: string }) {
  if (decision.startsWith('skipped')) return <Tag color="green">skipped</Tag>;
  if (decision.startsWith('auto')) return <Tag color="blue">auto-approved</Tag>;
  return <Tag color="yellow">required</Tag>;
}

function SubmissionTag({ status }: { status: 'submitted' | 'queued' | 'failed' }) {
  if (status === 'submitted') return <Tag color="green">Submitted</Tag>;
  if (status === 'queued') return <Tag color="blue">Queued</Tag>;
  return <Tag color="red">Failed</Tag>;
}

function ActionTag({ action }: { action: string }) {
  const map: Record<string, 'blue' | 'purple' | 'green' | 'yellow' | 'gray'> = {
    Printed: 'blue',
    Transferred: 'purple',
    Steamed: 'blue',
    Washed: 'blue',
    Tentered: 'blue',
    Inspected: 'yellow',
    Cut: 'purple',
    'Bundle Created': 'purple',
    Sewn: 'purple',
    Packed: 'green',
    Shipped: 'green',
  };
  return <Tag color={map[action] || 'gray'}>{action}</Tag>;
}

function CrossLink({ href, icon, title, subtitle }: { href: string; icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <Link href={href} className="block">
      <Card className="hover:border-navy-300 hover:shadow transition-all h-full">
        <div className="p-4">
          <div className="flex items-center gap-2 mb-1 text-navy-700">
            {icon}
            <div className="font-semibold text-sm">{title}</div>
          </div>
          <div className="text-xs text-gray-500">{subtitle}</div>
        </div>
      </Card>
    </Link>
  );
}

// Auto-RIP Engine — pulls live state from rip_jobs and rip_job_events to show
// the current automation pipeline: how many packages are ready, in flight,
// failed, held. Server-side functional component (no client state).
function AutoRipEngine() {
  const db = getDb();
  const counts = db.prepare(`
    SELECT
      SUM(CASE WHEN status = 'ready_for_rip' THEN 1 ELSE 0 END) as ready,
      SUM(CASE WHEN status IN ('package_created','submitted','accepted','ripping','rip_complete','queued_for_print','printing') THEN 1 ELSE 0 END) as in_flight,
      SUM(CASE WHEN status = 'print_complete_software' THEN 1 ELSE 0 END) as awaiting_qr,
      SUM(CASE WHEN status = 'print_complete_qr' THEN 1 ELSE 0 END) as complete_qr,
      SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as errors,
      SUM(CASE WHEN is_held = 1 THEN 1 ELSE 0 END) as held
    FROM rip_jobs
  `).get() as any;

  const recent = db.prepare(`
    SELECT rj.id, rj.external_job_name, rj.status, rj.retry_count, rj.is_held,
           rj.error_message, rj.created_at,
           pr.pr_number, pr.id as pr_id,
           p.name as printer_name,
           a.name as agent_name, a.status as agent_status
    FROM rip_jobs rj
    JOIN print_requests pr ON rj.print_request_id = pr.id
    LEFT JOIN printers p ON pr.printer_id = p.id
    LEFT JOIN neostampa_agents a ON rj.neostampa_agent_id = a.id
    ORDER BY rj.id DESC LIMIT 12
  `).all() as any[];

  return (
    <Card>
      <CardHeader
        title="Auto-RIP Engine · NeoStampa Lifecycle"
        subtitle="Composite → Submit → Accept → RIP → Print → QR-confirm. Software status here · QR scan = ground truth."
        action={
          <div className="flex gap-2">
            <Button size="sm" variant="secondary">Submit Ready</Button>
            <Button size="sm" variant="secondary">Retry Failed</Button>
          </div>
        }
      />
      <div className="grid grid-cols-6 gap-3 px-5 py-4 border-b border-gray-100">
        <Mini label="Ready" value={counts?.ready ?? 0} />
        <Mini label="In flight" value={counts?.in_flight ?? 0} color="text-navy-700" />
        <Mini label="Awaiting QR" value={counts?.awaiting_qr ?? 0} color="text-yellow-700" />
        <Mini label="QR confirmed" value={counts?.complete_qr ?? 0} color="text-green-700" />
        <Mini label="Errors" value={counts?.errors ?? 0} color={counts?.errors > 0 ? 'text-helm-red' : 'text-gray-400'} />
        <Mini label="Held" value={counts?.held ?? 0} color={counts?.held > 0 ? 'text-yellow-700' : 'text-gray-400'} />
      </div>
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
          <tr>
            <th className="text-left px-4 py-2.5">PR</th>
            <th className="text-left px-4 py-2.5">External Job Name</th>
            <th className="text-left px-4 py-2.5">Printer</th>
            <th className="text-left px-4 py-2.5">Agent</th>
            <th className="text-left px-4 py-2.5">Status</th>
            <th className="text-left px-4 py-2.5">Note</th>
          </tr>
        </thead>
        <tbody>
          {recent.map((j) => {
            const isErr = j.status === 'error';
            const isHeld = j.is_held === 1;
            const statusColor: Record<string, 'gray' | 'blue' | 'yellow' | 'green' | 'red' | 'purple'> = {
              ready_for_rip: 'gray', package_created: 'blue', submitted: 'blue', accepted: 'blue',
              ripping: 'blue', rip_complete: 'blue', queued_for_print: 'purple', printing: 'purple',
              print_complete_software: 'yellow', print_complete_qr: 'green', error: 'red', held: 'yellow',
            };
            return (
              <tr key={j.id} className={`border-t border-gray-100 ${isErr ? 'bg-red-50/30' : isHeld ? 'bg-yellow-50/30' : ''}`}>
                <td className="px-4 py-2 font-mono text-xs">
                  <Link href={`/print-requests/${j.pr_id}`} className="text-navy-700 hover:underline">{j.pr_number}</Link>
                </td>
                <td className="px-4 py-2 font-mono text-[10px] text-gray-600 break-all max-w-xs">{j.external_job_name}</td>
                <td className="px-4 py-2 text-xs">{j.printer_name ?? '—'}</td>
                <td className="px-4 py-2 text-xs">
                  {j.agent_name ?? '—'}{j.agent_status === 'degraded' && <span className="text-yellow-700 ml-1">!</span>}
                </td>
                <td className="px-4 py-2"><Tag color={statusColor[j.status] ?? 'gray'}>{j.status.replace(/_/g, ' ')}</Tag></td>
                <td className="px-4 py-2 text-[11px] text-gray-600 italic">
                  {j.retry_count > 0 && <span className="text-yellow-700">retried × {j.retry_count} </span>}
                  {j.error_message ?? ''}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="px-4 py-2 border-t border-gray-100 text-[11px] text-gray-500 italic">
        Agents run on RIP machines as the NeoStampa Sync service. See <Link href="/it-admin" className="text-navy-700 hover:underline">IT / System Admin</Link> for agent heartbeats + offline alerts.
      </div>
    </Card>
  );
}

function Mini({ label, value, color = 'text-navy-900' }: { label: string; value: any; color?: string }) {
  return (
    <div className="border border-gray-100 rounded p-2 text-center">
      <div className={`text-xl font-bold ${color}`}>{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-gray-500 mt-0.5">{label}</div>
    </div>
  );
}
