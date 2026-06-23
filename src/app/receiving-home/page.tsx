// S12 Receiving Home — Tomás Rivera
// Expected-Inbound table removed (Phase 1.12) — no purchase_orders / suppliers / inbound_shipments
// table behind it. The primary action is "Receive Fabric"; everything else stays.
// Recent receipts kept as activity context (mock until a received_lots table lands).
import Link from 'next/link';
import { RoleHomeShell } from '@/components/role-home';
import { getDb } from '@/lib/db';
import { Tag } from '@/components/ui';
import { PackageCheck } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default function ReceivingHome() {
  const db = getDb();
  const me = db.prepare(`SELECT * FROM users WHERE primary_role='receiving' LIMIT 1`).get() as any;

  const recentReceived = [
    { code: 'INB-3098', supplier: 'MillCo Textiles', received: '3h ago', items: '300 yds Cotton Sateen 280gsm', condition: 'PASS' },
    { code: 'INB-3099', supplier: 'Inside (customer-supplied)', received: 'yesterday', items: '12 rolls PFP base — 540 yds', condition: 'PASS' },
    { code: 'INB-3100', supplier: 'PerformaWeave', received: 'yesterday', items: '2 rolls Performance Velvet', condition: 'FAIL — color streaks, flagged' },
  ];
  const receivedTodayCount = recentReceived.filter((r) => r.received.includes('h ago') || r.received === 'today').length;

  return (
    <RoleHomeShell
      userName={me?.full_name ?? 'Tomás'}
      userRole="Receiving"
      greeting="Log every inbound delivery as it arrives. Customer-supplied fabric routes to the Open Bank."
      headerAction={
        <Link href="/receiving-home/receive"
          className="inline-flex items-center px-4 py-2.5 text-sm font-semibold rounded bg-navy-700 text-white hover:bg-navy-900">
          + Receive Fabric
        </Link>
      }
      kpis={[
        { label: 'Received today', value: receivedTodayCount, accent: 'green' },
        { label: 'Received this week', value: recentReceived.length },
        { label: 'Failed last 7d', value: 1, accent: 'red' },
      ]}
      queueTitle="Log a delivery"
      queueSubtitle="A truck just pulled up? Start here — fabric receipt routes to Inventory or to the Customer Open Bank automatically."
      queue={
        <div className="px-5 py-8 flex flex-col items-center justify-center text-center bg-gradient-to-br from-navy-50 to-white">
          <div className="w-14 h-14 rounded-full bg-navy-700 text-white flex items-center justify-center mb-3 shadow-md">
            <PackageCheck className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-bold text-navy-900">Receive Fabric</h3>
          <p className="text-sm text-gray-600 max-w-md mt-1 mb-4">
            Owner · Mill · GHL LOT# · Yardage · Roll count · Condition · Sample cut · White-point L*a*b* · Absorbency.
            Customer-supplied rolls log to the Customer Open Bank; mill stock goes to general Inventory.
          </p>
          <Link
            href="/receiving-home/receive"
            className="inline-flex items-center gap-2 px-6 py-3 text-base font-semibold rounded-md bg-navy-700 text-white hover:bg-navy-900 shadow-sm transition-all"
          >
            <PackageCheck className="w-5 h-5" />
            Start a New Receipt
          </Link>
          <div className="mt-3 text-[11px] text-gray-500 italic">
            Tip: scan the BOL or supplier label to pre-fill mill + LOT# fields.
          </div>
        </div>
      }
      activityTitle="Recent receipts"
      activity={
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
              <tr>
                <th className="text-left px-4 py-2.5">Ref</th>
                <th className="text-left px-4 py-2.5">Supplier</th>
                <th className="text-left px-4 py-2.5">Received</th>
                <th className="text-left px-4 py-2.5">Items</th>
                <th className="text-left px-4 py-2.5">Inspection</th>
              </tr>
            </thead>
            <tbody>
              {recentReceived.map((r) => (
                <tr key={r.code} className="border-t border-gray-100">
                  <td className="px-4 py-2.5 font-mono text-xs">{r.code}</td>
                  <td className="px-4 py-2.5 text-xs">{r.supplier}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-500">{r.received}</td>
                  <td className="px-4 py-2.5 text-xs">{r.items}</td>
                  <td className="px-4 py-2.5">
                    <Tag color={r.condition.startsWith('PASS') ? 'green' : 'red'}>{r.condition}</Tag>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      }
      crossLinks={[
        { label: 'Inventory Dashboard', href: '/inventory', description: 'Stage received items' },
        { label: 'Inventory Home', href: '/inventory-home', description: 'Low-stock alerts' },
        { label: 'Customer Open Bank', href: '/customers', description: 'Log customer-supplied fabric per customer' },
      ]}
    />
  );
}
