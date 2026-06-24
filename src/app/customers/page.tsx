import Link from 'next/link';
import { getDb } from '@/lib/db';
import { Card, CardHeader, Tag, Button } from '@/components/ui';

// /customers — Customer Directory with search + filter
// Search by company name, contact name, or email. Filter by status / hold flags.

export default function CustomerList({ searchParams }: { searchParams: { q?: string; status?: string } }) {
  const db = getDb();
  const q = (searchParams?.q ?? '').trim();
  const statusFilter = searchParams?.status ?? 'all';

  let where = "c.is_legacy = 0";
  const params: any[] = [];
  if (q) {
    where += ` AND (c.name LIKE ?
                    OR EXISTS (SELECT 1 FROM contacts ct WHERE ct.company_id = c.id
                              AND (ct.first_name LIKE ? OR ct.last_name LIKE ? OR ct.email LIKE ?)))`;
    params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
  }
  if (statusFilter === 'credit_hold') where += ` AND c.is_credit_hold = 1`;
  if (statusFilter === 'third_party') where += ` AND c.is_third_party_billed = 1`;
  if (statusFilter === 'blind_ship') where += ` AND c.is_blind_ship_default = 1`;
  if (statusFilter === 'active') where += ` AND c.is_credit_hold = 0`;

  const rows = db.prepare(`
    SELECT c.*,
      (SELECT COUNT(*) FROM orders o WHERE o.company_id = c.id) as order_count,
      (SELECT COUNT(*) FROM orders o WHERE o.company_id = c.id AND o.status NOT IN ('Closed','Shipped','Invoiced','Cancelled')) as open_count,
      (SELECT COUNT(*) FROM orders o WHERE o.company_id = c.id AND o.status IN ('Shipped','Invoiced','Closed')) as completed_count
    FROM companies c
    WHERE ${where}
    ORDER BY c.name
  `).all(...params) as any[];

  const hasFilters = q || statusFilter !== 'all';

  // Stats for context
  const totalActive = (db.prepare("SELECT COUNT(*) as c FROM companies WHERE is_legacy = 0").get() as any).c;

  return (
    <div className="max-w-7xl mx-auto space-y-5 pb-12">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Customers</h1>
          <p className="text-sm text-gray-500 mt-1">
            {rows.length} of {totalActive} active companies{hasFilters ? ' matching filters' : ''} · Customer profile master record lives in Helm (HubSpot integration is out of scope per Ali kickoff)
          </p>
        </div>
        <Button>+ New Customer</Button>
      </header>

      {/* Search + filter */}
      <Card>
        <form className="p-4 flex items-end gap-3" action="/customers">
          <div className="flex-1">
            <label className="block text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-1">Search</label>
            <input
              type="text"
              name="q"
              defaultValue={q}
              placeholder="Company name, contact name, or email…"
              className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-1">Status</label>
            <select name="status" defaultValue={statusFilter} className="border border-gray-300 rounded px-2 py-1.5 text-sm bg-white">
              <option value="all">All</option>
              <option value="active">Active (no credit hold)</option>
              <option value="credit_hold">Credit Hold</option>
              <option value="third_party">3rd-Party Billed</option>
              <option value="blind_ship">Blind Ship Default</option>
            </select>
          </div>
          <Button size="sm" type="submit">Search</Button>
          {hasFilters && (
            <Link href="/customers" className="px-3 py-1.5 text-xs text-gray-500 hover:text-navy-700 border border-gray-300 rounded">Clear</Link>
          )}
        </form>
      </Card>

      <Card>
        <table className="w-full text-sm">
          <thead className="text-xs text-gray-500 uppercase tracking-wider border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-2.5">Name</th>
              <th className="text-left px-4 py-2.5">Industry</th>
              <th className="text-left px-4 py-2.5">Terms</th>
              <th className="text-left px-4 py-2.5">Flags</th>
              <th className="text-right px-4 py-2.5">Open</th>
              <th className="text-right px-4 py-2.5">Completed</th>
              <th className="text-right px-4 py-2.5 pr-5">All-time</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={7} className="text-center py-12 text-gray-400">No customers match these filters.</td></tr>
            )}
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
                <td className="px-4 py-2.5 text-right font-mono">{c.open_count > 0 ? <span className="text-navy-700 font-semibold">{c.open_count}</span> : c.open_count}</td>
                <td className="px-4 py-2.5 text-right font-mono text-gray-500">{c.completed_count}</td>
                <td className="px-4 py-2.5 text-right font-mono pr-5 text-gray-400">{c.order_count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
