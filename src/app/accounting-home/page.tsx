// S13 Accounting Home — Diana Park
import Link from 'next/link';
import { getDb } from '@/lib/db';
import { RoleHomeShell } from '@/components/role-home';
import { StatusPill, Tag } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default function AccountingHome() {
  const db = getDb();
  const me = db.prepare(`SELECT * FROM users WHERE primary_role='accounting' LIMIT 1`).get() as any;

  // Orders shipped but not yet invoiced — these are ready to invoice
  const readyToInvoice = db.prepare(`
    SELECT o.id, o.order_number, o.subtotal, c.name as company_name, c.terms,
           (SELECT MAX(r.shipped_at) FROM pr_rolls r
            JOIN print_requests pr ON r.pr_id = pr.id
            JOIN order_lines ol ON pr.order_line_id = ol.id
            WHERE ol.order_id = o.id) as shipped_at
    FROM orders o
    JOIN companies c ON o.company_id = c.id
    WHERE o.status = 'Shipped'
    ORDER BY shipped_at DESC
    LIMIT 12
  `).all() as any[];

  const invoicedThisWeek = db.prepare(`
    SELECT COUNT(*) as n, COALESCE(SUM(subtotal), 0) as total
    FROM orders WHERE status IN ('Invoiced','Closed') AND date(created_at) >= date('now','-7 days')
  `).get() as any;

  const onHold = db.prepare(`
    SELECT o.id, o.order_number, c.name as company_name, o.hold_status, o.subtotal
    FROM orders o JOIN companies c ON o.company_id = c.id
    WHERE o.hold_status IS NOT NULL AND o.status NOT IN ('Cancelled','Closed')
    LIMIT 10
  `).all() as any[];

  return (
    <RoleHomeShell
      userName={me?.full_name ?? 'Diana'}
      userRole="Accounting"
      greeting="Ready-to-invoice + QB sync status + holds. Shipped orders flow to invoicing automatically."
      kpis={[
        { label: 'Ready to invoice', value: readyToInvoice.length, accent: 'yellow' },
        { label: 'Invoiced 7d', value: invoicedThisWeek?.n ?? 0, accent: 'green' },
        { label: 'Revenue 7d', value: '$' + (invoicedThisWeek?.total ?? 0).toFixed(0) },
        { label: 'On hold', value: onHold.length, accent: onHold.length > 0 ? 'red' : 'green' },
      ]}
      queueTitle="Shipped — ready to invoice"
      queueSubtitle="Will sync to QuickBooks once invoiced. Verify customer + terms before push."
      queue={
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
              <tr>
                <th className="text-left px-4 py-2.5">Order</th>
                <th className="text-left px-4 py-2.5">Customer</th>
                <th className="text-left px-4 py-2.5">Terms</th>
                <th className="text-left px-4 py-2.5">Subtotal</th>
                <th className="text-left px-4 py-2.5">Shipped</th>
              </tr>
            </thead>
            <tbody>
              {readyToInvoice.map((o) => (
                <tr key={o.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-2.5 font-mono text-xs">
                    <Link href={`/orders/${o.id}`} className="text-navy-700 font-semibold hover:underline">{o.order_number}</Link>
                  </td>
                  <td className="px-4 py-2.5">{o.company_name}</td>
                  <td className="px-4 py-2.5 text-xs"><Tag>{o.terms ?? 'Net 30'}</Tag></td>
                  <td className="px-4 py-2.5 font-mono text-xs">${(o.subtotal ?? 0).toFixed(2)}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-500">{o.shipped_at ? new Date(o.shipped_at).toLocaleDateString() : '—'}</td>
                </tr>
              ))}
              {readyToInvoice.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-500 italic">Nothing waiting to invoice.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      }
      activityTitle="Orders on Hold (needs accounting review)"
      activity={
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
              <tr>
                <th className="text-left px-4 py-2.5">Order</th>
                <th className="text-left px-4 py-2.5">Customer</th>
                <th className="text-left px-4 py-2.5">Hold Reason</th>
                <th className="text-left px-4 py-2.5">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {onHold.map((o) => (
                <tr key={o.id} className="border-t border-gray-100">
                  <td className="px-4 py-2.5 font-mono text-xs">
                    <Link href={`/orders/${o.id}`} className="text-navy-700 hover:underline">{o.order_number}</Link>
                  </td>
                  <td className="px-4 py-2.5 text-xs">{o.company_name}</td>
                  <td className="px-4 py-2.5"><Tag color="red">{o.hold_status}</Tag></td>
                  <td className="px-4 py-2.5 font-mono text-xs">${(o.subtotal ?? 0).toFixed(2)}</td>
                </tr>
              ))}
              {onHold.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-500 italic">No holds.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      }
      crossLinks={[
        { label: 'Customers', href: '/customers', description: 'Terms, billing contacts' },
        { label: 'Exception Center', href: '/exceptions', description: 'Failed QB syncs' },
        { label: 'IT / System Admin', href: '/it-admin', description: 'QuickBooks integration health' },
      ]}
    />
  );
}
