import Link from 'next/link';
import { getDb } from '@/lib/db';
import { Card, Button } from '@/components/ui';
import { OrderRow } from '@/components/order-row';

// Order Dashboard — compact, scannable. Search + filter for status + assigned-to.

export default function OrderDashboard({ searchParams }: { searchParams: { filter?: string; q?: string; status?: string; assigned?: string } }) {
  const db = getDb();
  const filter = searchParams?.filter ?? 'all';
  const q = (searchParams?.q ?? '').trim();
  const statusFilter = searchParams?.status ?? 'all';
  const assignedFilter = searchParams?.assigned ?? 'all';

  let where = '1=1';
  if (filter === 'today') where = "date(o.adt_promised_date) = date('now')";
  if (filter === 'this_week') where = "date(o.adt_promised_date) BETWEEN date('now') AND date('now', '+7 days')";
  if (filter === 'late') where = "o.adt_promised_date IS NOT NULL AND date(o.adt_promised_date) < date('now') AND o.status NOT IN ('Closed','Shipped','Invoiced','Cancelled')";
  if (filter === 'on_hold') where = "o.status = 'On Hold'";
  if (filter === 'awaiting_approval') where = "o.status = 'Waiting on Approval'";
  if (filter === 'credit_hold') where = "EXISTS (SELECT 1 FROM companies c2 WHERE c2.id = o.company_id AND c2.is_credit_hold = 1)";
  if (filter === 'rush') where = "o.is_rush = 1 AND o.status NOT IN ('Closed','Shipped','Invoiced','Cancelled')";

  const params: any[] = [];
  if (q) {
    where += ` AND (o.order_number LIKE ? OR o.po_number LIKE ? OR c.name LIKE ?)`;
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  if (statusFilter !== 'all') {
    where += ` AND o.status = ?`;
    params.push(statusFilter);
  }
  if (assignedFilter !== 'all') {
    where += ` AND o.assigned_to_user_id = ?`;
    params.push(parseInt(assignedFilter));
  }

  const orders = db.prepare(`
    SELECT o.id, o.order_number, o.po_number, c.name as company_name, o.roadmap, o.status,
           o.estimated_ship_date, o.adt_promised_date, o.created_at, o.is_rush,
           o.approval_required, o.trigger_reason,
           u.full_name as assigned_to_name,
           CASE
             WHEN o.adt_promised_date IS NOT NULL
                  AND date(o.adt_promised_date) < date('now')
                  AND o.status NOT IN ('Closed','Shipped','Invoiced','Cancelled') THEN 0
             WHEN o.is_rush = 1 AND o.status NOT IN ('Closed','Shipped','Invoiced','Cancelled') THEN 1
             WHEN o.status IN ('On Hold','Waiting on Approval') THEN 2
             ELSE 3
           END as priority_rank
    FROM orders o
    JOIN companies c ON o.company_id = c.id
    LEFT JOIN users u ON o.assigned_to_user_id = u.id
    WHERE ${where}
    ORDER BY priority_rank ASC,
             COALESCE(date(o.adt_promised_date), date(o.estimated_ship_date)) ASC,
             o.created_at DESC
    LIMIT 75
  `).all(...params) as any[];

  // Pull child PR summaries
  const orderIds = orders.map((o) => o.id);
  const placeholders = orderIds.map(() => '?').join(',');
  const prsRaw = orderIds.length > 0
    ? db.prepare(`
        SELECT pr.id, pr.pr_number, pr.status, ol.order_id
        FROM print_requests pr
        JOIN order_lines ol ON pr.order_line_id = ol.id
        WHERE ol.order_id IN (${placeholders})
      `).all(...orderIds) as any[]
    : [];
  const prsByOrder = new Map<number, any[]>();
  prsRaw.forEach((pr) => {
    if (!prsByOrder.has(pr.order_id)) prsByOrder.set(pr.order_id, []);
    prsByOrder.get(pr.order_id)!.push(pr);
  });

  // Filter dropdown options
  const allStatuses = db.prepare(`SELECT DISTINCT status FROM orders WHERE status IS NOT NULL ORDER BY status`).all() as { status: string }[];
  const allAssignees = db.prepare(`
    SELECT DISTINCT u.id, u.full_name FROM users u
    JOIN orders o ON o.assigned_to_user_id = u.id
    ORDER BY u.full_name
  `).all() as { id: number; full_name: string }[];

  const counts = {
    all: (db.prepare('SELECT COUNT(*) as c FROM orders').get() as any).c,
    today: (db.prepare("SELECT COUNT(*) as c FROM orders o WHERE date(o.adt_promised_date) = date('now')").get() as any).c,
    this_week: (db.prepare("SELECT COUNT(*) as c FROM orders o WHERE date(o.adt_promised_date) BETWEEN date('now') AND date('now', '+7 days')").get() as any).c,
    late: (db.prepare("SELECT COUNT(*) as c FROM orders o WHERE o.adt_promised_date IS NOT NULL AND date(o.adt_promised_date) < date('now') AND o.status NOT IN ('Closed','Shipped','Invoiced','Cancelled')").get() as any).c,
    on_hold: (db.prepare("SELECT COUNT(*) as c FROM orders WHERE status = 'On Hold'").get() as any).c,
    awaiting_approval: (db.prepare("SELECT COUNT(*) as c FROM orders WHERE status = 'Waiting on Approval'").get() as any).c,
    rush: (db.prepare("SELECT COUNT(*) as c FROM orders WHERE is_rush = 1 AND status NOT IN ('Closed','Shipped','Invoiced','Cancelled')").get() as any).c,
  };

  const hasFilters = q || statusFilter !== 'all' || assignedFilter !== 'all' || filter !== 'all';

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Order Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">
            Showing {orders.length} orders{hasFilters ? ' matching filters' : ''} · sorted by priority (late first)
          </p>
        </div>
        <Link href="/orders/new">
          <Button>+ New Order</Button>
        </Link>
      </header>

      {/* Search + filter bar */}
      <Card>
        <form className="p-4 grid grid-cols-12 gap-3 items-end" action="/orders">
          {filter !== 'all' && <input type="hidden" name="filter" value={filter} />}
          <div className="col-span-5">
            <label className="block text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-1">Search</label>
            <input
              type="text"
              name="q"
              defaultValue={q}
              placeholder="Order #, PO #, or customer company…"
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
              <Link href="/orders" className="px-2 py-1.5 text-xs text-gray-500 hover:text-navy-700 border border-gray-300 rounded">Clear</Link>
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
          <FilterChip label="Awaiting approval" filter="awaiting_approval" current={filter} count={counts.awaiting_approval} accent="yellow" q={q} status={statusFilter} assigned={assignedFilter} />
          <FilterChip label="On hold" filter="on_hold" current={filter} count={counts.on_hold} accent="yellow" q={q} status={statusFilter} assigned={assignedFilter} />
        </div>
      </div>

      <Card>
        <table className="w-full text-sm">
          <thead className="text-xs text-gray-500 uppercase tracking-wider border-b border-gray-200">
            <tr>
              <th className="p-0 w-1"></th>
              <th className="text-left px-3 py-2.5">Order</th>
              <th className="text-left px-3 py-2.5">Customer</th>
              <th className="text-left px-3 py-2.5">Roadmap</th>
              <th className="text-left px-3 py-2.5">Status</th>
              <th className="text-left px-3 py-2.5">Assigned To</th>
              <th className="text-left px-3 py-2.5">Promised / Est.</th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 && (
              <tr><td colSpan={7} className="text-center py-12 text-gray-400">No orders match these filters.</td></tr>
            )}
            {orders.map((o) => (
              <OrderRow key={o.id} order={o} prs={prsByOrder.get(o.id) || []} />
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function FilterChip({ label, filter, current, count, accent, q, status, assigned }: { label: string; filter: string; current: string; count: number; accent?: 'red' | 'yellow'; q?: string; status?: string; assigned?: string }) {
  const isActive = current === filter;
  let cls = '';
  if (isActive) {
    cls = 'bg-navy-700 text-white border-navy-700';
  } else if (accent === 'red' && count > 0) {
    cls = 'border-red-200 bg-red-50 text-red-800 hover:bg-red-100';
  } else if (accent === 'yellow' && count > 0) {
    cls = 'border-yellow-200 bg-yellow-50 text-yellow-900 hover:bg-yellow-100';
  } else {
    cls = 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50';
  }
  const params = new URLSearchParams();
  params.set('filter', filter);
  if (q) params.set('q', q);
  if (status && status !== 'all') params.set('status', status);
  if (assigned && assigned !== 'all') params.set('assigned', assigned);
  return (
    <Link href={`/orders?${params.toString()}`}
      className={`px-3 py-1 text-xs font-semibold rounded-full border transition-colors ${cls}`}>
      {label} <span className="ml-1 opacity-70 font-normal">{count}</span>
    </Link>
  );
}
