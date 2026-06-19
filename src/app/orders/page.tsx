import Link from 'next/link';
import { getDb } from '@/lib/db';
import { Card, Button } from '@/components/ui';
import { OrderRow } from '@/components/order-row';

// Order Dashboard — compact, scannable order list.
// Priority encoded as a left-edge color stripe. PR-mix summary inline (no expand needed).
// Child PR details live on the Order Detail page.

export default function OrderDashboard({ searchParams }: { searchParams: { filter?: string } }) {
  const db = getDb();
  const filter = searchParams?.filter ?? 'all';

  let where = '1=1';
  if (filter === 'today') where = "date(o.adt_promised_date) = date('now')";
  if (filter === 'this_week') where = "date(o.adt_promised_date) BETWEEN date('now') AND date('now', '+7 days')";
  if (filter === 'late') where = "date(o.adt_promised_date) < date('now') AND o.status NOT IN ('Closed','Shipped','Invoiced','Cancelled')";
  if (filter === 'on_hold') where = "o.status = 'On Hold'";
  if (filter === 'awaiting_approval') where = "o.status = 'Waiting on Approval'";
  if (filter === 'credit_hold') where = "EXISTS (SELECT 1 FROM companies c2 WHERE c2.id = o.company_id AND c2.is_credit_hold = 1)";
  if (filter === 'rush') where = "o.is_rush = 1 AND o.status NOT IN ('Closed','Shipped','Invoiced','Cancelled')";

  // Sort by priority (late first, then rush, then by promised date) for a more useful default ordering
  const orders = db.prepare(`
    SELECT o.id, o.order_number, o.po_number, c.name as company_name, o.roadmap, o.status,
           o.adt_promised_date, o.created_at, o.is_rush, o.approval_required, o.trigger_reason,
           CASE
             WHEN date(o.adt_promised_date) < date('now') AND o.status NOT IN ('Closed','Shipped','Invoiced','Cancelled') THEN 0
             WHEN o.is_rush = 1 AND o.status NOT IN ('Closed','Shipped','Invoiced','Cancelled') THEN 1
             WHEN o.status IN ('On Hold','Waiting on Approval') THEN 2
             ELSE 3
           END as priority_rank
    FROM orders o JOIN companies c ON o.company_id = c.id
    WHERE ${where}
    ORDER BY priority_rank ASC, date(o.adt_promised_date) ASC, o.created_at DESC
    LIMIT 50
  `).all() as any[];

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

  const counts = {
    all: (db.prepare('SELECT COUNT(*) as c FROM orders').get() as any).c,
    today: (db.prepare("SELECT COUNT(*) as c FROM orders o WHERE date(o.adt_promised_date) = date('now')").get() as any).c,
    this_week: (db.prepare("SELECT COUNT(*) as c FROM orders o WHERE date(o.adt_promised_date) BETWEEN date('now') AND date('now', '+7 days')").get() as any).c,
    late: (db.prepare("SELECT COUNT(*) as c FROM orders o WHERE date(o.adt_promised_date) < date('now') AND o.status NOT IN ('Closed','Shipped','Invoiced','Cancelled')").get() as any).c,
    on_hold: (db.prepare("SELECT COUNT(*) as c FROM orders WHERE status = 'On Hold'").get() as any).c,
    awaiting_approval: (db.prepare("SELECT COUNT(*) as c FROM orders WHERE status = 'Waiting on Approval'").get() as any).c,
    rush: (db.prepare("SELECT COUNT(*) as c FROM orders WHERE is_rush = 1 AND status NOT IN ('Closed','Shipped','Invoiced','Cancelled')").get() as any).c,
  };

  // Active filter label for header context
  const activeLabel = ({
    all: 'all orders',
    today: 'orders promised today',
    this_week: 'orders promised this week',
    late: 'late orders',
    on_hold: 'orders on hold',
    awaiting_approval: 'orders awaiting approval',
    rush: 'rush orders',
  } as Record<string, string>)[filter] || 'orders';

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Order Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">
            Showing {orders.length} of {counts.all} {activeLabel} · sorted by priority (late first)
          </p>
        </div>
        <Link href="/orders/new">
          <Button>+ New Order</Button>
        </Link>
      </header>

      {/* Filter chips — grouped Time vs Needs Attention */}
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
          <FilterChip label="Awaiting approval" filter="awaiting_approval" current={filter} count={counts.awaiting_approval} accent="yellow" />
          <FilterChip label="On hold" filter="on_hold" current={filter} count={counts.on_hold} accent="yellow" />
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
              <th className="text-left px-3 py-2.5">Promised</th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 && (
              <tr><td colSpan={6} className="text-center py-12 text-gray-400">No orders match this filter.</td></tr>
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

function FilterChip({ label, filter, current, count, accent }: { label: string; filter: string; current: string; count: number; accent?: 'red' | 'yellow' }) {
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
  return (
    <Link href={`/orders?filter=${filter}`}
      className={`px-3 py-1 text-xs font-semibold rounded-full border transition-colors ${cls}`}>
      {label} <span className="ml-1 opacity-70 font-normal">{count}</span>
    </Link>
  );
}
