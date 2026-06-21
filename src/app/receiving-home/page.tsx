// S12 Receiving Home — Tomás Rivera
// Mock data — no inbound shipments table in schema yet.
import Link from 'next/link';
import { RoleHomeShell } from '@/components/role-home';
import { getDb } from '@/lib/db';
import { Tag } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default function ReceivingHome() {
  const db = getDb();
  const me = db.prepare(`SELECT * FROM users WHERE primary_role='receiving' LIMIT 1`).get() as any;

  // Mock inbound shipments — receiving doesn't have a dedicated table yet
  const expectedInbound = [
    { code: 'INB-3104', supplier: 'MillCo Textiles', expected: 'today', items: '500 yds Cotton Sateen 200gsm', po: 'PO-9821', urgency: 'normal' },
    { code: 'INB-3105', supplier: 'St Frank (customer-supplied)', expected: 'today', items: '8 rolls PFP Linen — 320 yds', po: 'cust-supply', urgency: 'rush', tag: 'Customer-supplied — log to Open Bank' },
    { code: 'INB-3106', supplier: 'PerformaWeave', expected: 'tomorrow', items: '4 rolls Performance Velvet', po: 'PO-9844', urgency: 'normal' },
    { code: 'INB-3107', supplier: 'Avery Dennison', expected: 'Mon Jun 22', items: '5,000 ct CUT labels (Zebra ZT400 stock)', po: 'PO-9851', urgency: 'normal' },
    { code: 'INB-3108', supplier: 'Custom Coatings Inc.', expected: 'Mon Jun 22', items: '4 drums PFP pretreatment chemistry', po: 'PO-9852', urgency: 'low' },
  ];

  const recentReceived = [
    { code: 'INB-3098', supplier: 'MillCo Textiles', received: '3h ago', items: '300 yds Cotton Sateen 280gsm', condition: 'PASS' },
    { code: 'INB-3099', supplier: 'Inside (customer-supplied)', received: 'yesterday', items: '12 rolls PFP base — 540 yds', condition: 'PASS' },
    { code: 'INB-3100', supplier: 'PerformaWeave', received: 'yesterday', items: '2 rolls Performance Velvet', condition: 'FAIL — color streaks, flagged' },
  ];

  return (
    <RoleHomeShell
      userName={me?.full_name ?? 'Tomás'}
      userRole="Receiving"
      greeting="Inbound shipments to expect and recent receipts. Customer-supplied fabric goes to the Open Bank."
      headerAction={
        <Link href="/receiving-home/receive"
          className="inline-flex items-center px-4 py-2.5 text-sm font-semibold rounded bg-navy-700 text-white hover:bg-navy-900">
          + Receive Fabric
        </Link>
      }
      kpis={[
        { label: 'Inbound today', value: expectedInbound.filter((i) => i.expected === 'today').length, accent: 'yellow' },
        { label: 'This week', value: expectedInbound.length },
        { label: 'Failed last 7d', value: 1, accent: 'red' },
      ]}
      queueTitle="Expected Inbound"
      queueSubtitle="Manifest each delivery on arrival — log condition + reconcile against PO"
      queue={
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
              <tr>
                <th className="text-left px-4 py-2.5">Ref</th>
                <th className="text-left px-4 py-2.5">Supplier</th>
                <th className="text-left px-4 py-2.5">Expected</th>
                <th className="text-left px-4 py-2.5">Items</th>
                <th className="text-left px-4 py-2.5">PO #</th>
                <th className="text-left px-4 py-2.5">Notes</th>
              </tr>
            </thead>
            <tbody>
              {expectedInbound.map((i) => (
                <tr key={i.code} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-2.5 font-mono text-xs font-semibold">{i.code}</td>
                  <td className="px-4 py-2.5 text-xs">{i.supplier}</td>
                  <td className="px-4 py-2.5">
                    <Tag color={i.expected === 'today' ? 'yellow' : 'gray'}>{i.expected}</Tag>
                    {i.urgency === 'rush' && <Tag color="red">Rush</Tag>}
                  </td>
                  <td className="px-4 py-2.5 text-xs">{i.items}</td>
                  <td className="px-4 py-2.5 font-mono text-xs">{i.po}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-500 italic">{i.tag ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
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
