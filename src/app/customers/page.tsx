import Link from 'next/link';
import { getDb } from '@/lib/db';
import { Card, CardHeader, Tag, Button } from '@/components/ui';

// /customers — Customer Directory
// Surfaces: name, industry, terms, credit hold, 3rd-party billing, recent order activity
// Financial figures (LTV, revenue) intentionally not surfaced — those live in QuickBooks / accounting

export default function CustomerList() {
  const db = getDb();
  const rows = db.prepare(`
    SELECT c.*,
      (SELECT COUNT(*) FROM orders o WHERE o.company_id = c.id) as order_count,
      (SELECT COUNT(*) FROM orders o WHERE o.company_id = c.id AND o.status IN ('Shipped','Invoiced','Closed')) as completed_count
    FROM companies c
    WHERE c.is_legacy = 0
    ORDER BY c.name
  `).all() as any[];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Customers</h1>
          <p className="text-sm text-gray-500 mt-1">{rows.length} active companies · HubSpot syncs Companies + Contacts (no Deals — per Megan E2)</p>
        </div>
        <Button>+ New Customer</Button>
      </header>

      <Card>
        <table className="w-full text-sm">
          <thead className="text-xs text-gray-500 uppercase tracking-wider border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-2.5">Name</th>
              <th className="text-left px-4 py-2.5">Industry</th>
              <th className="text-left px-4 py-2.5">Terms</th>
              <th className="text-left px-4 py-2.5">Flags</th>
              <th className="text-right px-4 py-2.5">Orders (all-time)</th>
              <th className="text-right px-4 py-2.5 pr-5">Completed</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id} className="border-t border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-2.5">
                  <Link href={`/customers/${c.id}`} className="text-navy-700 hover:underline font-semibold">{c.name}</Link>
                </td>
                <td className="px-4 py-2.5 text-xs">{c.industry || '—'}</td>
                <td className="px-4 py-2.5 text-xs">{c.payment_terms}</td>
                <td className="px-4 py-2.5">
                  {c.is_credit_hold ? <Tag color="red">Credit Hold</Tag> : null}
                  {c.is_third_party_billed ? <Tag color="yellow">3rd-Party Billed</Tag> : null}
                  {c.is_blind_ship_default ? <Tag color="green">Blind Default</Tag> : null}
                </td>
                <td className="px-4 py-2.5 text-right font-mono">{c.order_count}</td>
                <td className="px-4 py-2.5 text-right font-mono pr-5">{c.completed_count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
