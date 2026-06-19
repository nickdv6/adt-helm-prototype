import Link from 'next/link';
import { getDb } from '@/lib/db';
import { Card, Button, StatusPill, Tag } from '@/components/ui';
import { formatPromised } from '@/lib/utils';

// /print-requests — Print Request Dashboard
// PR is the daily operational unit. Search + filter so users can quickly find a PR by PR# or
// customer company name. Roll #s are NOT shown here — rolls are pack-out-time artifacts and
// are surfaced only on the Shipping page (where each PR may yield multiple rolls).
// Filters: status, assigned-to, attention queues.

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

export default function PrintRequestDashboard({ searchParams }: { searchParams: { filter?: string; q?: string; status?: string; assigned?: string } }) {
  const db = getDb();
  const filter = searchParams?.filter ?? 'all';
  const q = (searchParams?.q ?? '').trim();
  const statusFilter = searchParams?.status ?? 'all';
  const assignedFilter = searchParams?.assigned ?? 'all';

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

  // Free-text search: PR# or Customer company name. Roll# is intentionally NOT searched here
  // (rolls are pack-out-time artifacts surfaced only on Shipping + Created Rolls pages).
  const searchParams2: any[] = [];
  if (q) {
    where += ` AND (pr.pr_number LIKE ? OR c.name LIKE ?)`;
    searchParams2.push(`%${q}%`, `%${q}%`);
  }
  if (statusFilter !== 'all') {
    where += ` AND pr.status = ?`;
    searchParams2.push(statusFilter);
  }
  if (assignedFilter !== 'all') {
    where += ` AND pr.assigned_to_user_id = ?`;
    searchParams2.push(parseInt(assignedFilter));
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
           u.full_name as assigned_to_name,
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
    LEFT JOIN users u ON pr.assigned_to_user_id = u.id
    WHERE ${where}
    ORDER BY priority_rank ASC,
             COALESCE(date(o.adt_promised_date), date(o.estimated_ship_date)) ASC,
             pr.created_at DESC
    LIMIT 75
  `).all(...searchParams2) as any[];

  // Distinct status + assignee lists for filter dropdowns
  const allStatuses = db.prepare(`SELECT DISTINCT status FROM print_requests WHERE status IS NOT NULL ORDER BY status`).all() as { status: string }[];
  const allAssignees = db.prepare(`
    SELECT DISTINCT u.id, u.full_name FROM users u
    JOIN print_requests pr ON pr.assigned_to_user_id = u.id
    ORDER BY u.full_name
  `).all() as { id: number; full_name: string }[];

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

  const hasFilters = q || statusFilter !== 'all' || assignedFilter !== 'all' || filter !== 'all';

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Print Request Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">
            Showing {prs.length} print requests{hasFilters ? ' matching filters' : ''} · sorted by priority (late first)
          </p>
        </div>
        <Link href="/printer-queue">
          <Button variant="secondary">Printer Queue →</Button>
        </Link>
      </header>

      {/* Search + filter bar */}
      <Card>
        <form className="p-4 grid grid-cols-12 gap-3 items-end" action="/print-requests">
          {/* Preserve the current attention filter via hidden field */}
          {filter !== 'all' && <input type="hidden" name="filter" value={filter} />}
          <div className="col-span-5">
            <label className="block text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-1">Search</label>
            <input
              type="text"
              name="q"
              defaultValue={q}
              placeholder="PR# or customer company…"
              className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
            />
          </div>
          <div className="col-span-3">
            <label className="block text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-1">Status</label>
            <select name="status" defaultValue={statusFilter} className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm bg-white">
              <option value="all">All statuses</option>
              {allStatuses.map((s) => <option key={s.status} value={s.status}>{s.status}</option>)}
            </select>
          </div>
          <div className="col-span-3">
            <label className="block text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-1">Assigned To</label>
            <select name="assigned" defaultValue={assignedFilter} className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm bg-white">
              <option value="all">Anyone</option>
              {allAssignees.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
            </select>
          </div>
          <div className="col-span-1 flex gap-1.5">
            <Button size="sm" type="submit" className="w-full">Search</Button>
            {hasFilters && (
              <Link href="/print-requests" className="px-2 py-1.5 text-xs text-gray-500 hover:text-navy-700 border border-gray-300 rounded">Clear</Link>
            )}
          </div>
        </form>
      </Card>

      {/* Attention chips */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold mr-1">Time</div>
          <FilterChip label="All" filter="all" current={filter} count={counts.all} q={q} status={statusFilter} assigned={assignedFilter} />
          <FilterChip label="Today" filter="today" current={filter} count={counts.today} q={q} status={statusFilter} assigned={assignedFilter} />
          <FilterChip label="This week" filter="this_week" current={filter} count={counts.this_week} q={q} status={statusFilter} assigned={assignedFilter} />
        </div>
        <span className="text-gray-300">·</span>
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold mr-1">Needs attention</div>
          <FilterChip label="Late" filter="late" current={filter} count={counts.late} accent="red" q={q} status={statusFilter} assigned={assignedFilter} />
          <FilterChip label="Rush" filter="rush" current={filter} count={counts.rush} accent="red" q={q} status={statusFilter} assigned={assignedFilter} />
          <FilterChip label="Proof pending" filter="proof_pending" current={filter} count={counts.proof_pending} accent="yellow" q={q} status={statusFilter} assigned={assignedFilter} />
          <FilterChip label="Reprint" filter="reprint" current={filter} count={counts.reprint} accent="yellow" q={q} status={statusFilter} assigned={assignedFilter} />
          <FilterChip label="On hold" filter="held" current={filter} count={counts.held} accent="yellow" q={q} status={statusFilter} assigned={assignedFilter} />
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
              <th className="text-left px-3 py-2.5">Status</th>
              <th className="text-right px-3 py-2.5">Progress</th>
              <th className="text-left px-3 py-2.5">Assigned To</th>
              <th className="text-left px-3 py-2.5">Promised / Est.</th>
            </tr>
          </thead>
          <tbody>
            {prs.length === 0 && (
              <tr><td colSpan={8} className="text-center py-12 text-gray-400">No print requests match these filters.</td></tr>
            )}
            {prs.map((pr) => <PRRow key={pr.id} pr={pr} />)}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function PRRow({ pr }: { pr: any }) {
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
      <td className="p-0 w-1">
        {accent && <div className={`w-1 h-14 ${accentBg}`} />}
      </td>

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

      <td className="px-3 py-2.5">
        <div className="font-semibold">{pr.design_name || <span className="text-gray-400">—</span>}</div>
        <div className="text-[11px] text-gray-500">
          {pr.colorway_name && <span>{pr.colorway_name}</span>}
          {pr.colorway_name && pr.fabric_name && <span className="mx-1">·</span>}
          {pr.fabric_name && <span>{pr.fabric_name}</span>}
        </div>
      </td>

      <td className="px-3 py-2.5">
        {processLabel ? <Tag color={processColor}>{processLabel}</Tag> : <span className="text-gray-400 text-xs">—</span>}
      </td>

      <td className="px-3 py-2.5">
        <StatusPill status={pr.status} />
        <div className="flex flex-wrap gap-1 mt-1">
          {pr.internal_proof_status === 'pending' && <Tag color="yellow">Proof pending</Tag>}
          {pr.internal_proof_status === 'failed' && <Tag color="red">Proof failed</Tag>}
          {pr.is_click_and_print && <Tag color="purple">C+P</Tag>}
        </div>
      </td>

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

      <td className="px-3 py-2.5 text-xs">
        {pr.assigned_to_name || <span className="text-gray-400 italic">unassigned</span>}
      </td>

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

function FilterChip({ label, filter, current, count, accent, q, status, assigned }: { label: string; filter: string; current: string; count: number; accent?: 'red' | 'yellow'; q?: string; status?: string; assigned?: string }) {
  const isActive = current === filter;
  let cls = '';
  if (isActive) cls = 'bg-navy-700 text-white border-navy-700';
  else if (accent === 'red' && count > 0) cls = 'border-red-200 bg-red-50 text-red-800 hover:bg-red-100';
  else if (accent === 'yellow' && count > 0) cls = 'border-yellow-200 bg-yellow-50 text-yellow-900 hover:bg-yellow-100';
  else cls = 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50';
  // Preserve existing search/filter state when switching attention chips
  const params = new URLSearchParams();
  params.set('filter', filter);
  if (q) params.set('q', q);
  if (status && status !== 'all') params.set('status', status);
  if (assigned && assigned !== 'all') params.set('assigned', assigned);
  return (
    <Link href={`/print-requests?${params.toString()}`}
      className={`px-3 py-1 text-xs font-semibold rounded-full border transition-colors ${cls}`}>
      {label} <span className="ml-1 opacity-70 font-normal">{count}</span>
    </Link>
  );
}
