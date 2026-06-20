// S04 CSR Home — Sarah Castillo
import Link from 'next/link';
import { getDb } from '@/lib/db';
import { RoleHomeShell } from '@/components/role-home';
import { StatusPill, Tag } from '@/components/ui';
import { formatDate, relativeTime } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default function CSRHome() {
  const db = getDb();
  const me = db.prepare(`SELECT * FROM users WHERE primary_role='csr' LIMIT 1`).get() as any;

  // My assigned orders, prioritized: late first, then promised ascending
  const myOrders = db.prepare(`
    SELECT o.id, o.order_number, o.status, o.adt_promised_date, o.customer_facing_status,
           c.name as company_name
    FROM orders o
    JOIN companies c ON o.company_id = c.id
    WHERE o.assigned_to_user_id = ? AND o.status NOT IN ('Closed','Cancelled','Invoiced','Shipped')
    ORDER BY
      CASE WHEN o.adt_promised_date IS NOT NULL AND date(o.adt_promised_date) < date('now') THEN 0 ELSE 1 END,
      o.adt_promised_date ASC
    LIMIT 12
  `).all(me?.id) as any[];

  const lateCount = myOrders.filter((o) => o.adt_promised_date && new Date(o.adt_promised_date) < new Date()).length;
  const awaitingCust = db.prepare(`
    SELECT COUNT(*) as n FROM strike_offs
    WHERE status IN ('Awaiting Approval','Customer Reviewing')
  `).get() as any;
  const todaysIntake = db.prepare(`
    SELECT COUNT(*) as n FROM orders WHERE date(created_at) = date('now')
  `).get() as any;
  // Exception Center uses mock data (no exceptions table in schema yet);
  // matches the 6-entry sidebar badge + EX-24xx mock array on /exceptions.
  const openExceptions = { n: 6 };

  return (
    <RoleHomeShell
      userName={me?.full_name ?? 'Sarah'}
      userRole="Customer Service"
      greeting="Your CSR desk — orders you own, strikes on the wire, and intake from today."
      kpis={[
        { label: 'My open orders', value: myOrders.length },
        { label: 'Late vs promised', value: lateCount, accent: lateCount > 0 ? 'red' : 'green' },
        { label: 'Awaiting customer', value: awaitingCust?.n ?? 0, accent: 'yellow' },
        { label: 'Today\'s intake', value: todaysIntake?.n ?? 0 },
        { label: 'Open exceptions', value: openExceptions?.n ?? 0, accent: openExceptions?.n > 0 ? 'yellow' : 'green' },
      ]}
      queueTitle="My Orders — action prioritized"
      queueSubtitle="Late orders first, then by promised date"
      queue={
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
              <tr>
                <th className="text-left px-4 py-2.5">Order</th>
                <th className="text-left px-4 py-2.5">Customer</th>
                <th className="text-left px-4 py-2.5">Status</th>
                <th className="text-left px-4 py-2.5">Promised</th>
                <th className="text-left px-4 py-2.5">Customer-facing</th>
              </tr>
            </thead>
            <tbody>
              {myOrders.map((o) => {
                const late = o.adt_promised_date && new Date(o.adt_promised_date) < new Date();
                return (
                  <tr key={o.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-mono text-xs">
                      <Link href={`/orders/${o.id}`} className="text-navy-700 font-semibold hover:underline">{o.order_number}</Link>
                    </td>
                    <td className="px-4 py-2.5">{o.company_name}</td>
                    <td className="px-4 py-2.5"><StatusPill status={o.status} /></td>
                    <td className={`px-4 py-2.5 text-xs ${late ? 'text-helm-red font-semibold' : ''}`}>
                      {o.adt_promised_date ? formatDate(o.adt_promised_date) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-600">{o.customer_facing_status ?? <span className="text-gray-300">—</span>}</td>
                  </tr>
                );
              })}
              {myOrders.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-500 italic">Inbox is clear.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      }
      activityTitle="Recent intake (last 10)"
      activity={
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
              <tr>
                <th className="text-left px-4 py-2.5">Order</th>
                <th className="text-left px-4 py-2.5">Customer</th>
                <th className="text-left px-4 py-2.5">Source</th>
                <th className="text-left px-4 py-2.5">Created</th>
              </tr>
            </thead>
            <tbody>
              {(db.prepare(`
                SELECT o.id, o.order_number, o.created_at, o.source_system, c.name as company_name
                FROM orders o JOIN companies c ON o.company_id = c.id
                ORDER BY o.created_at DESC LIMIT 10
              `).all() as any[]).map((o) => (
                <tr key={o.id} className="border-t border-gray-100">
                  <td className="px-4 py-2.5 font-mono text-xs"><Link href={`/orders/${o.id}`} className="text-navy-700 hover:underline">{o.order_number}</Link></td>
                  <td className="px-4 py-2.5 text-xs">{o.company_name}</td>
                  <td className="px-4 py-2.5"><Tag>{o.source_system.replace(/_/g,' ')}</Tag></td>
                  <td className="px-4 py-2.5 text-xs text-gray-500">{relativeTime(o.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      }
      crossLinks={[
        { label: 'Order Dashboard', href: '/orders', description: 'All open orders' },
        { label: 'CSR Dashboard', href: '/dashboards/csr', description: 'Late, awaiting customer, top customers' },
        { label: 'New Order', href: '/orders/new', description: 'Create manually' },
        { label: 'Strike-Offs', href: '/strike-offs', description: 'Customer approval queue' },
        { label: 'Customers', href: '/customers', description: 'Company list' },
        { label: 'Exceptions', href: '/exceptions', description: 'Anything blocked' },
      ]}
    />
  );
}
