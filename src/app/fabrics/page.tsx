// /fabrics — Fabric registry. Lists all fabrics with their spec basics.
// Add button links to /fabrics/new where the full DASH-style spec form lives.
import Link from 'next/link';
import { getDb } from '@/lib/db';
import { Card, CardHeader, Tag, Button } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default function FabricsPage({ searchParams }: { searchParams: { q?: string } }) {
  const db = getDb();
  const q = (searchParams.q ?? '').trim().toLowerCase();

  const allFabrics = db.prepare(`
    SELECT f.*,
      (SELECT COUNT(*) FROM print_requests pr WHERE pr.fabric_id = f.id) as pr_count,
      (SELECT COUNT(*) FROM skus s WHERE s.fabric_id = f.id) as sku_count
    FROM fabrics f
    ORDER BY f.name
  `).all() as any[];

  const fabrics = q
    ? allFabrics.filter((f) => f.name.toLowerCase().includes(q) || (f.fiber_content ?? '').toLowerCase().includes(q))
    : allFabrics;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Fabrics</h1>
          <p className="text-sm text-gray-600 mt-0.5">Master fabric registry — each entry can populate a standardized Tech Sheet PDF for customers.</p>
        </div>
        <Link href="/fabrics/new" className="inline-flex items-center px-3.5 py-2 text-sm font-semibold rounded bg-navy-700 text-white hover:bg-navy-900">
          + Add Fabric
        </Link>
      </header>

      <div className="grid grid-cols-3 gap-4">
        <Stat label="Total fabrics" value={allFabrics.length} />
        <Stat label="In use on active PRs" value={allFabrics.filter((f) => f.pr_count > 0).length} accent="blue" />
        <Stat label="Linked to SKUs" value={allFabrics.filter((f) => f.sku_count > 0).length} />
      </div>

      <Card>
        <CardHeader title={`${fabrics.length} fabric${fabrics.length === 1 ? '' : 's'}`}
          action={
            <form action="/fabrics" className="flex items-center gap-2">
              <input type="search" name="q" defaultValue={q}
                placeholder="Search by name or fiber content"
                className="text-xs border border-gray-300 rounded px-2 py-1 w-64" />
              <Button size="sm" variant="secondary">Search</Button>
            </form>
          } />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
              <tr>
                <th className="text-left px-4 py-2.5">Fabric Name</th>
                <th className="text-left px-4 py-2.5">Fiber Content</th>
                <th className="text-left px-4 py-2.5">Width</th>
                <th className="text-left px-4 py-2.5">Weight</th>
                <th className="text-left px-4 py-2.5">PRs</th>
                <th className="text-left px-4 py-2.5">SKUs</th>
              </tr>
            </thead>
            <tbody>
              {fabrics.map((f) => (
                <tr key={f.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-2.5 font-semibold text-navy-900">{f.name}</td>
                  <td className="px-4 py-2.5 text-xs">{f.fiber_content ?? <span className="text-gray-300">—</span>}</td>
                  <td className="px-4 py-2.5 font-mono text-xs">{f.width_inches ? `${f.width_inches}"` : <span className="text-gray-300">—</span>}</td>
                  <td className="px-4 py-2.5 text-xs">{f.weight ?? <span className="text-gray-300">—</span>}</td>
                  <td className="px-4 py-2.5 font-mono text-xs">{f.pr_count}</td>
                  <td className="px-4 py-2.5 font-mono text-xs">{f.sku_count}</td>
                </tr>
              ))}
              {fabrics.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-500 italic">No fabrics match.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <CardHeader title="Notes" />
        <div className="p-5 text-sm text-gray-600 space-y-2">
          <p>The current schema captures a minimal fabric record (name, fiber content, weight, width, default print profile). The <Link href="/fabrics/new" className="text-navy-700 underline">Add Fabric form</Link> captures the full DASH spec set — composition (3 contents + percentages), performance (Wyzenbeek, Martindale, per-thousand weight), compliance (NFPA 701/260, CA 117), country of origin, supplier, sale price.</p>
          <p>Each fabric&apos;s full spec set populates a standardized Tech Sheet PDF that can be sent to customers on request.</p>
        </div>
      </Card>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: any; accent?: 'blue' }) {
  const cls = accent === 'blue' ? 'text-navy-700' : 'text-navy-900';
  return (
    <Card>
      <div className="p-4">
        <div className="text-xs uppercase tracking-wider text-gray-500 mb-1">{label}</div>
        <div className={`text-2xl font-bold ${cls}`}>{value}</div>
      </div>
    </Card>
  );
}
