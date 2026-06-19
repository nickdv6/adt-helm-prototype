// S51 Customer Service Dashboard
// CSR-facing: orders needing attention, customers in trouble, late-vs-promised, open exceptions affecting customers.
import Link from 'next/link';
import { getDb } from '@/lib/db';
import { Card, CardHeader, StatusPill, Tag } from '@/components/ui';
import { formatDate, relativeTime } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default function CSRDashboard() {
  const db = getDb();

  // Late vs promised
  const late = db.prepare(`
    SELECT o.id, o.order_number, o.adt_promised_date, o.status, c.name as company_name, c.id as company_id
    FROM orders o
    JOIN companies c ON o.company_id = c.id
    WHERE o.adt_promised_date IS NOT NULL
      AND date(o.adt_promised_date) < date('now')
      AND o.status NOT IN ('Closed','Cancelled','Invoiced','Shipped')
    ORDER BY o.adt_promised_date ASC
    LIMIT 20
  `).all() as any[];

  // Approaching promised (next 7 days)
  const approaching = db.prepare(`
    SELECT o.id, o.order_number, o.adt_promised_date, o.status, c.name as company_name
    FROM orders o
    JOIN companies c ON o.company_id = c.id
    WHERE o.adt_promised_date IS NOT NULL
      AND date(o.adt_promised_date) BETWEEN date('now') AND date('now','+7 days')
      AND o.status NOT IN ('Closed','Cancelled','Invoiced','Shipped')
    ORDER BY o.adt_promised_date ASC
    LIMIT 20
  `).all() as any[];

  // Awaiting customer (any strike-off / approval blocking)
  const awaitingCust = db.prepare(`
    SELECT so.id as so_id, o.id, o.order_number, o.customer_facing_status, c.name as company_name,
           so.strike_off_number, so.approval_sent_at
    FROM strike_offs so
    JOIN print_requests pr ON so.print_request_id = pr.id
    JOIN order_lines ol ON pr.order_line_id = ol.id
    JOIN orders o ON ol.order_id = o.id
    JOIN companies c ON o.company_id = c.id
    WHERE so.status IN ('Awaiting Approval','Customer Reviewing')
    ORDER BY so.approval_sent_at ASC
    LIMIT 15
  `).all() as any[];

  // Top customers by open order count (signals who's hot right now)
  const topCustomers = db.prepare(`
    SELECT c.id, c.name, COUNT(o.id) as n,
           COUNT(CASE WHEN o.adt_promised_date IS NOT NULL AND date(o.adt_promised_date) < date('now') AND o.status NOT IN ('Closed','Cancelled','Invoiced','Shipped') THEN 1 END) as n_late
    FROM companies c
    JOIN orders o ON c.id = o.company_id
    WHERE o.status NOT IN ('Closed','Cancelled','Invoiced')
    GROUP BY c.id
    ORDER BY n DESC
    LIMIT 10
  `).all() as any[];

  const todaysOrders = db.prepare(`
    SELECT COUNT(*) as n FROM orders WHERE date(created_at) = date('now')
  `).get() as any;
  const openOrders = db.prepare(`
    SELECT COUNT(*) as n FROM orders WHERE status NOT IN ('Closed','Cancelled','Invoiced')
  `).get() as any;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-navy-900">Customer Service Dashboard</h1>
        <p className="text-sm text-gray-600 mt-0.5">CSR command center — what to call about, who&apos;s waiting on us, who we&apos;re waiting on.</p>
      </header>

      <div className="grid grid-cols-5 gap-4">
        <Stat label="Orders today" value={todaysOrders.n} />
        <Stat label="Open orders" value={openOrders.n} />
        <Stat label="Late vs promised" value={late.length} accent="red" />
        <Stat label="Promised next 7 days" value={approaching.length} accent="yellow" />
        <Stat label="Awaiting customer" value={awaitingCust.length} accent="yellow" />
      </div>

      <Card>
        <CardHeader title="Late vs Promised" subtitle={`${late.length} open orders past their promised date — proactive call list`} />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
              <tr>
                <th className="text-left px-4 py-2.5">Order</th>
                <th className="text-left px-4 py-2.5">Customer</th>
                <th className="text-left px-4 py-2.5">Promised</th>
                <th className="text-left px-4 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody>
              {late.map((o) => {
                const days = Math.floor((Date.now() - new Date(o.adt_promised_date).getTime()) / (1000*60*60*24));
                return (
                  <tr key={o.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-mono text-xs">
                      <Link href={`/orders/${o.id}`} className="text-navy-700 font-semibold hover:underline">{o.order_number}</Link>
                    </td>
                    <td className="px-4 py-2.5">
                      <Link href={`/customers/${o.company_id}`} className="hover:underline">{o.company_name}</Link>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-helm-red font-semibold">
                      {formatDate(o.adt_promised_date)} <span className="ml-1">({days}d late)</span>
                    </td>
                    <td className="px-4 py-2.5"><StatusPill status={o.status} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-6">
        <Card>
          <CardHeader title="Promised Next 7 Days" subtitle="Heads-up list — confirm we're on track" />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-2.5">Order</th>
                  <th className="text-left px-4 py-2.5">Customer</th>
                  <th className="text-left px-4 py-2.5">Promised</th>
                </tr>
              </thead>
              <tbody>
                {approaching.map((o) => (
                  <tr key={o.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-mono text-xs">
                      <Link href={`/orders/${o.id}`} className="text-navy-700 hover:underline">{o.order_number}</Link>
                    </td>
                    <td className="px-4 py-2.5 text-xs">{o.company_name}</td>
                    <td className="px-4 py-2.5 text-xs">{formatDate(o.adt_promised_date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <CardHeader title="Awaiting Customer" subtitle="Strike-offs we sent — follow up if aged" />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-2.5">SO #</th>
                  <th className="text-left px-4 py-2.5">Customer</th>
                  <th className="text-left px-4 py-2.5">Sent</th>
                </tr>
              </thead>
              <tbody>
                {awaitingCust.map((s) => (
                  <tr key={s.so_id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-mono text-xs">
                      <Link href={`/strike-offs/${s.so_id}`} className="text-navy-700 hover:underline">{s.strike_off_number}</Link>
                    </td>
                    <td className="px-4 py-2.5 text-xs">{s.company_name}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-500">{s.approval_sent_at ? relativeTime(s.approval_sent_at) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader title="Top Customers by Open Orders" subtitle="Who's loading us most right now" />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
              <tr>
                <th className="text-left px-4 py-2.5">Customer</th>
                <th className="text-left px-4 py-2.5">Open orders</th>
                <th className="text-left px-4 py-2.5">Late</th>
              </tr>
            </thead>
            <tbody>
              {topCustomers.map((c) => (
                <tr key={c.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-2.5">
                    <Link href={`/customers/${c.id}`} className="text-navy-700 font-semibold hover:underline">{c.name}</Link>
                  </td>
                  <td className="px-4 py-2.5 font-mono">{c.n}</td>
                  <td className="px-4 py-2.5 font-mono">
                    {c.n_late > 0 ? <Tag color="red">{c.n_late}</Tag> : <span className="text-gray-300">0</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: any; accent?: 'yellow' | 'red' }) {
  const accentCls = accent === 'yellow' ? 'text-yellow-700'
    : accent === 'red' ? 'text-helm-red'
    : 'text-navy-900';
  return (
    <Card>
      <div className="p-4">
        <div className="text-xs uppercase tracking-wider text-gray-500 mb-1">{label}</div>
        <div className={`text-2xl font-bold ${accentCls}`}>{value}</div>
      </div>
    </Card>
  );
}
