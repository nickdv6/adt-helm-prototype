import Link from 'next/link';
import { getDb } from '@/lib/db';
import { Card, Button, StatusPill, Tag } from '@/components/ui';
import { formatPromised } from '@/lib/utils';

// /print-requests — Print Request Dashboard
// Per Nick: PRs are checked more frequently than Orders. This is the daily operational queue
// at PR granularity, parallel to /orders but focused on production execution. Late and pre-
// approval semantics inherit from the parent order (promised vs estimated ship date).

const FINISHED_PR_STATUSES = new Set(['Complete', 'Cancelled']);
const PROCESS_LABEL: Record<string, string> = {
  reactive: 'Fiber Reactive',
  pigment: 'Pigment',
  dye_sublimation: 'Dye Sub',
  latex: 'Latex',
  direct_disperse: 'Direct Disperse',
  other_manual_review: 'Manual review',
};
const PROCESS_COLOR: Record<string, 'blue' | 'purple' | 'green' | 'yellow' | 'gray'> = {
  reactive: 'blue',
  pigment: 'purple',
  dye_sublimation: 'green',
  latex: 'green',
  direct_disperse: 'yellow',
  other_manual_review: 'gray',
};

export default function PrintRequestDashboard({ searchParams }: { searchParams: { filter?: string } }) {
  const db = getDb();
  const filter = searchParams?.filter ?? 'all';

  // WHERE clauses parallel to Orders Dashboard, applied against the parent order's promised date
  let where = '1=1';
  if (filter === 'today') {
    where = "date(o.adt_promised_date) = date('now')";
  } else if (filter === 'this_week') {
    where = "date(o.adt_promised_date) BETWEEN date('now') AND date('now', '+7 days')";
  } else if (filter === 'late') {
    where = "o.adt_promised_date IS NOT NULL AND date(o.adt_promised_date) < date('now') AND pr.status NOT IN ('Complete','Cancelled')";
  } else if (filter === 'proof_pending') {
    where = "pr.internal_proof_status = 'pending'";
  } else if (filter === 'rush') {
    where = "o.is_rush = 1 AND pr.status NOT IN ('Complete','Cancelled')";
  } else if (filter === 'reprint') {
    where = "(pr.reprint_of_pr_id IS NOT NULL OR pr.pr_number LIKE 'R-%')";
  } else if (filter === 'held') {
    where = "pr.status = 'On Hold'";
  }

  const prs = db.prepare(`
    SELECT pr.id, pr.pr_number, pr.status, pr.planned_yardage, pr.printed_yardage,
           pr.is_click_and_print, pr.was_csv_auto_routed, pr.internal_proof_status,
           pr.reprint_of_pr_id, pr.print_process,
           ol.order_id,
           o.order_number, o.adt_promised_date, o.estimated_ship_date,
           o.is_rush, o.status as order_status,
           c.name as company_name,
           d.plant_number, d.name as design_name,
           cw.name as colorway_name,
           f.name as fabric_name,
           p.name as printer_name,
           CASE
             WHEN o.adt_promised_date IS NOT NULL
                  AND date(o.adt_promised_date) < date('now')
                  AND pr.status NOT IN ('Complete','Cancelled') THEN 0
             WHEN o.is_rush = 1 AND pr.status NOT IN ('Complete','Cancelled') THEN 1
             WHEN pr.internal_proof_status = 'pending' THEN 2
             WHEN pr.status IN ('On Hold','Pending Profile') THEN 2
             ELSE 3
           END as priority_rank
    FROM print_requests pr
    JOIN order_lines ol ON pr.order_line_id = ol.id
    JOIN orders o ON ol.order_id = o.id
    JOIN companies c ON o.company_id = c.id
    LEFT JOIN designs d ON ol.design_id = d.id
    LEFT JOIN colorways cw ON ol.colorway_id = cw.id
    LEFT JOIN fabrics f ON pr.fabric_id = f.id
    LEFT JOIN printers p ON pr.printer_id = p.id
    WHERE ${where}
    ORDER BY priority_rank ASC,
             COALESCE(date(o.adt_promised_date), date(o.estimated_ship_date)) ASC,
             pr.created_at DESC
    LIMIT 75
  `).all() as any[];

  const counts = {
    all: (db.prepare('SELECT COUNT(*) as c FROM print_requests pr JOIN order_lines ol ON pr.order_line_id = ol.id JOIN orders o ON ol.order_id = o.id').get() as any).c,
    today: (db.prepare("SELECT COUNT(*) as c FROM print_requests pr JOIN order_lines ol ON pr.order_line_id = ol.id JOIN orders o ON ol.order_id = o.id WHERE date(o.adt_promised_date) = date('now')").get() as any).c,
    this_week: (db.prepare("SELECT COUNT(*) as c FROM print_requests pr JOIN order_lines ol ON pr.order_line_id = ol.id JOIN orders o ON ol.order_id = o.id WHERE date(o.adt_promised_date) BETWEEN date('now') AND date('now', '+7 days')").get() as any).c,
    late: (db.prepare("SELECT COUNT(*) as c FROM print_requests pr JOIN order_lines ol ON pr.order_line_id = ol.id JOIN orders o ON ol.order_id = o.id WHERE o.adt_promised_date IS NOT NULL AND date(o.adt_promised_date) < date('now') AND pr.status NOT IN ('Complete','Cancelled')").get() as any).c,
    proof_pending: (db.prepare("SELECT COUNT(*) as c FROM print_requests pr WHERE pr.internal_proof_status = 'pending'").get() as any).c,
    rush: (db.prepare("SELECT COUNT(*) as c FROM print_requests pr JOIN order_lines ol ON pr.order_line_id = ol.id JOIN orders o ON ol.order_id = o.id WHERE o.is_rush = 1 AND pr.status NOT IN ('Complete','Cancelled')").get() as any).c,
    reprint: (db.prepare("SELECT COUNT(*) as c FROM print_requests pr WHERE pr.reprint_of_pr_id IS NOT NULL OR pr.pr_number LIKE 'R-%'").get() as any).c,
    held: (db.prepare("SELECT COUNT(*) as c FROM print_requests pr WHERE pr.status = 'On Hold'").get() as any).c,
  };

  const activeLabel = ({
    all: 'all print requests',
    today: 'PRs on orders promised today',
    this_week: 'PRs on orders promised this week',
    late: 'late PRs',
    proof_pending: 'PRs with proof pending',
    rush: 'PRs on rush orders',
    reprint: 'reprints',
    held: 'PRs on hold',
  } as Record<string, string>)[filter] || 'print requests';

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Print Request Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">
            Showing {prs.length} of {counts.all} {activeLabel} · sorted by priority (late first)
          </p>
        </div>
        <Link href="/printer-queue">
          <Button variant="secondary">Printer Queue →</Button>
        </Link>
      </header>

      {/* Filter chips — Time vs Needs Attention */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold mr-1">Time</div>
          <FilterChip label="All" filter="all" current={filter} count={counts.all} />
          <FilterChip label="Today" filter="today" current={filter} count={counts.today} />
          <FilterChip label="This week" filter="this_week" current={filter} count={counts.this_week} />
        </div>
        <span className="text-gray-300">·</span>
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold mr-1">Needs attention</div>
          <FilterChip label="Late" filter="late" current={filter} count={counts.late} accent="red" />
          <FilterChip label="Rush" filter="rush" current={filter} count={counts.rush} accent="red" />
          <FilterChip label="Proof pending" filter="proof_pending" current={filter} count={counts.proof_pending} accent="yellow" />
          <FilterChip label="Reprint" filter="reprint" current={filter} count={counts.reprint} accent="yellow" />
          <FilterChip label="On hold" filter="held" current={filter} count={counts.held} accent="yellow" />
        </div>
      </div>

      <Card>
        <table className="w-full text-sm">
          <thead className="text-xs text-gray-500 uppercase tracking-wider border-b border-gray-200">
            <tr>
              <th className="p-0 w-1"></th>
              <th className="text-left px-3 py-2.5">PR / Order</th>
              <th className="text-left px-3 py-2.5">Design / Colorway / Fabric</th>
              <th className="text-left px-3 py-2.5">Process</th>
              <th className="text-left px-3 py-2.5">Printer</th>
              <th className="text-left px-3 py-2.5">Status</th>
              <th className="text-right px-3 py-2.5">Progress</th>
              <th className="text-left px-3 py-2.5">Promised / Est. ship</th>
            </tr>
          </thead>
          <tbody>
            {prs.length === 0 && (
              <tr><td colSpan={8} className="text-center py-12 text-gray-400">No print requests match this filter.</td></tr>
            )}
            {prs.map((pr) => <PRRow key={pr.id} pr={pr} />)}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function PRRow({ pr }: { pr: any }) {
  // Priority computed from the parent order's promised date — pre-approval orders (no promised
  // date) can never qualify as Late.
  const promised = pr.adt_promised_date ? new Date(pr.adt_promised_date) : null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const isLate = !!(promised && promised < today && !FINISHED_PR_STATUSES.has(pr.status));
  const isReprint = !!pr.reprint_of_pr_id || (pr.pr_number && pr.pr_number.startsWith('R-'));
  const isRushActive = pr.is_rush && !FINISHED_PR_STATUSES.has(pr.status);

  const accent: 'red' | 'yellow' | null =
    isLate || isRushActive ? 'red'
    : pr.internal_proof_status === 'pending' || pr.status === 'On Hold' || pr.status === 'Pending Profile' ? 'yellow'
    : null;
  const accentBg = accent === 'red' ? 'bg-red-500' : accent === 'yellow' ? 'bg-yellow-400' : '';
  const rowBg = accent === 'red' ? 'hover:bg-red-50/40' : 'hover:bg-gray-50';

  const hasPromised = !!pr.adt_promised_date;
  const dateLabel = formatPromised(hasPromised ? pr.adt_promised_date : pr.estimated_ship_date);

  const planned = pr.planned_yardage || 0;
  const printed = pr.printed_yardage || 0;
  const pct = planned > 0 ? Math.min(100, Math.round((printed / planned) * 100)) : 0;

  const processLabel = pr.print_process ? (PROCESS_LABEL[pr.print_process] || pr.print_process) : null;
  const processColor = pr.print_process ? (PROCESS_COLOR[pr.print_process] || 'gray') : 'gray';

  return (
    <tr className={`border-t border-gray-100 transition-colors ${rowBg}`}>
      {/* Priority accent stripe */}
      <td className="p-0 w-1">
        {accent && <div className={`w-1 h-14 ${accentBg}`} />}
      </td>

      {/* PR# + Plant# stacked over Order# + Customer */}
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-2">
          <Link href={`/print-requests/${pr.id}`} className="font-mono text-navy-700 hover:underline font-semibold">
            {pr.pr_number}
          </Link>
          {pr.plant_number && <span className="font-mono text-[10px] text-gray-400">{pr.plant_number}</span>}
          {isReprint && <Tag color="yellow">Reprint</Tag>}
          {isRushActive && <Tag color="red">Rush</Tag>}
          {isLate && <Tag color="red">Late</Tag>}
        </div>
        <div className="text-[11px] text-gray-500 mt-0.5">
          <Link href={`/orders/${pr.order_id}`} className="font-mono hover:underline">{pr.order_number}</Link>
          <span className="ml-2">{pr.company_name}</span>
        </div>
      </td>

      {/* Design / Colorway / Fabric stacked */}
      <td className="px-3 py-2.5">
        <div className="font-semibold">{pr.design_name || <span className="text-gray-400">—</span>}</div>
        <div className="text-[11px] text-gray-500">
          {pr.colorway_name && <span>{pr.colorway_name}</span>}
          {pr.colorway_name && pr.fabric_name && <span className="mx-1">·</span>}
          {pr.fabric_name && <span>{pr.fabric_name}</span>}
        </div>
      </td>

      {/* Process tag */}
      <td className="px-3 py-2.5">
        {processLabel ? <Tag color={processColor}>{processLabel}</Tag> : <span className="text-gray-400 text-xs">—</span>}
      </td>

      {/* Printer (if assigned) */}
      <td className="px-3 py-2.5 text-xs">
        {pr.printer_name || <span className="text-gray-400">unassigned</span>}
      </td>

      {/* Status + secondary indicators */}
      <td className="px-3 py-2.5">
        <StatusPill status={pr.status} />
        <div className="flex flex-wrap gap-1 mt-1">
          {pr.internal_proof_status === 'pending' && <Tag color="yellow">Proof pending</Tag>}
          {pr.internal_proof_status === 'failed' && <Tag color="red">Proof failed</Tag>}
          {pr.is_click_and_print && <Tag color="purple">C+P</Tag>}
        </div>
      </td>

      {/* Progress bar */}
      <td className="px-3 py-2.5 text-right">
        {planned > 0 ? (
          <>
            <div className="text-xs font-mono">{printed}/{planned} yd</div>
            <div className="w-20 h-1.5 bg-gray-200 rounded mt-1 ml-auto">
              <div className={`h-1.5 rounded ${pct === 100 ? 'bg-helm-green' : 'bg-navy-700'}`} style={{ width: `${pct}%` }} />
            </div>
          </>
        ) : <span className="text-gray-400 text-xs">—</span>}
      </td>

      {/* Promised (commitment) or Estimated (pre-approval) */}
      <td className="px-3 py-2.5">
        {hasPromised ? (
          <div className={`text-sm ${dateLabel.isLate ? 'text-red-700 font-semibold' : ''}`}>
            {dateLabel.label}
          </div>
        ) : (
          <div className="text-sm">
            <span className="text-gray-700">{dateLabel.label}</span>
            <div className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold mt-0.5">Est. · pending approval</div>
          </div>
        )}
      </td>
    </tr>
  );
}

function FilterChip({ label, filter, current, count, accent }: { label: string; filter: string; current: string; count: number; accent?: 'red' | 'yellow' }) {
  const isActive = current === filter;
  let cls = '';
  if (isActive) cls = 'bg-navy-700 text-white border-navy-700';
  else if (accent === 'red' && count > 0) cls = 'border-red-200 bg-red-50 text-red-800 hover:bg-red-100';
  else if (accent === 'yellow' && count > 0) cls = 'border-yellow-200 bg-yellow-50 text-yellow-900 hover:bg-yellow-100';
  else cls = 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50';
  return (
    <Link href={`/print-requests?filter=${filter}`}
      className={`px-3 py-1 text-xs font-semibold rounded-full border transition-colors ${cls}`}>
      {label} <span className="ml-1 opacity-70 font-normal">{count}</span>
    </Link>
  );
}
