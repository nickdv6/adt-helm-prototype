import Link from 'next/link';
import { getDb } from '@/lib/db';
import { Card, CardHeader, StatusPill, Button, Tag } from '@/components/ui';
import { formatDate, relativeTime } from '@/lib/utils';
import { OrderRow } from '@/components/order-row';

// S20 Order Dashboard
// Per S23-S32.47 (Megan A2): expandable rows show child PR#s
// Per S19-S22.7: default columns Order # · PO # · Customer · Roadmap · Stage · Due Date · Status · Last Activity
// Per S19-S22.9: quick filter chips

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

  const orders = db.prepare(`
    SELECT o.id, o.order_number, o.po_number, c.name as company_name, o.roadmap, o.status,
           o.adt_promised_date, o.subtotal, o.created_at, o.is_rush, o.approval_required, o.trigger_reason
    FROM orders o JOIN companies c ON o.company_id = c.id
    WHERE ${where}
    ORDER BY o.created_at DESC LIMIT 50
  `).all() as any[];

  // For expand-rows, pre-fetch PRs grouped by order id
  const orderIds = orders.map((o) => o.id);
  const placeholders = orderIds.map(() => '?').join(',');
  const prsRaw = orderIds.length > 0
    ? db.prepare(`
        SELECT pr.id, pr.pr_number, pr.status, pr.internal_proof_status, pr.is_click_and_print, pr.was_csv_auto_routed,
               ol.order_id, d.plant_number
        FROM print_requests pr
        JOIN order_lines ol ON pr.order_line_id = ol.id
        LEFT JOIN designs d ON ol.design_id = d.id
        WHERE ol.order_id IN (${placeholders})
        ORDER BY pr.pr_number
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

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Order Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">
            S20 · {orders.length} of {counts.all} orders shown · expand rows to see child PR#s
          </p>
        </div>
        <Link href="/orders/new">
          <Button>+ New Order</Button>
        </Link>
      </header>

      <div className="flex flex-wrap gap-2">
        <FilterChip label="All" filter="all" current={filter} count={counts.all} />
        <FilterChip label="Today" filter="today" current={filter} count={counts.today} />
        <FilterChip label="This Week" filter="this_week" current={filter} count={counts.this_week} />
        <FilterChip label="Late" filter="late" current={filter} count={counts.late} accent="red" />
        <FilterChip label="On Hold" filter="on_hold" current={filter} count={counts.on_hold} />
        <FilterChip label="Awaiting Approval" filter="awaiting_approval" current={filter} count={counts.awaiting_approval} accent="yellow" />
        <FilterChip label="Rush" filter="rush" current={filter} count={counts.rush} accent="red" />
      </div>

      <Card>
        <table className="w-full text-sm">
          <thead className="text-xs text-gray-500 uppercase tracking-wider border-b border-gray-200">
            <tr>
              <th className="text-left px-3 py-2.5 w-8"></th>
              <th className="text-left px-3 py-2.5">Order #</th>
              <th className="text-left px-3 py-2.5">PO #</th>
              <th className="text-left px-3 py-2.5">Customer</th>
              <th className="text-left px-3 py-2.5">Roadmap</th>
              <th className="text-left px-3 py-2.5">Status</th>
              <th className="text-left px-3 py-2.5">Promised</th>
              <th className="text-right px-3 py-2.5">Last Activity</th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 && (
              <tr><td colSpan={8} className="text-center py-12 text-gray-400">No orders match this filter.</td></tr>
            )}
            {orders.map((o) => (
              <OrderRow key={o.id} order={o} prs={prsByOrder.get(o.id) || []} />
            ))}
          </tbody>
        </table>
      </Card>

      <div className="text-xs text-gray-500">
        Filter logic + columns lock per S19-S22.7 / .8 / .9. Per Megan A2 (S23-S32.47), each row expands inline to show child PR#s with their current status.
      </div>
    </div>
  );
}

function FilterChip({ label, filter, current, count, accent }: { label: string; filter: string; current: string; count: number; accent?: 'red' | 'yellow' }) {
  const isActive = current === filter;
  const accentCls = accent === 'red' && count > 0 ? 'border-red-300 bg-red-50 text-red-800'
    : accent === 'yellow' && count > 0 ? 'border-yellow-300 bg-yellow-50 text-yellow-900'
    : isActive ? 'bg-navy-700 text-white border-navy-700'
    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50';
  return (
    <Link href={`/orders?filter=${filter}`}
      className={`px-3 py-1.5 text-xs font-semibold rounded-full border transition-colors ${accentCls}`}>
      {label} <span className="ml-1 opacity-70">({count})</span>
    </Link>
  );
}
