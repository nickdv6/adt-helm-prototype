import Link from 'next/link';
import { getDb } from '@/lib/db';
import { Card, CardHeader, Tag, Button } from '@/components/ui';
import { formatDate } from '@/lib/utils';
import { Plus, Upload, FileText } from 'lucide-react';

// /designs — Design Dashboard
// Per Nick: dedicated design management page that supports manual entry, customer assignment,
// multi-colorway, file linking, and search/sort/filter. Equivalent of the DASH design index.

export default function DesignDashboard({ searchParams }: {
  searchParams: { q?: string; customer?: string; status?: string; sort?: string }
}) {
  const db = getDb();
  const q = (searchParams?.q ?? '').trim();
  const customerFilter = searchParams?.customer ?? 'all';
  const statusFilter = searchParams?.status ?? 'all';
  const sort = searchParams?.sort ?? 'created_desc';

  let where = "d.is_legacy = 0";
  const params: any[] = [];
  if (q) {
    where += ` AND (d.name LIKE ? OR d.plant_number LIKE ? OR c.name LIKE ?)`;
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  if (customerFilter !== 'all') {
    where += ` AND d.company_id = ?`;
    params.push(parseInt(customerFilter));
  }
  if (statusFilter !== 'all') {
    where += ` AND d.lifecycle_status = ?`;
    params.push(statusFilter);
  }

  let orderBy = 'd.created_at DESC';
  if (sort === 'name_asc') orderBy = 'd.name ASC';
  if (sort === 'name_desc') orderBy = 'd.name DESC';
  if (sort === 'plant_asc') orderBy = 'd.plant_number ASC';
  if (sort === 'plant_desc') orderBy = 'd.plant_number DESC';
  if (sort === 'customer_asc') orderBy = 'c.name ASC, d.name ASC';
  if (sort === 'created_desc') orderBy = 'd.created_at DESC';
  if (sort === 'created_asc') orderBy = 'd.created_at ASC';

  const designs = db.prepare(`
    SELECT d.id, d.name, d.plant_number, d.lifecycle_status, d.created_at, d.company_id,
           c.name as company_name,
           (SELECT COUNT(*) FROM colorways cw WHERE cw.design_id = d.id) as colorway_count,
           (SELECT GROUP_CONCAT(cw.name, ', ') FROM (SELECT name FROM colorways WHERE design_id = d.id LIMIT 3) cw) as colorway_preview
    FROM designs d
    JOIN companies c ON d.company_id = c.id
    WHERE ${where}
    ORDER BY ${orderBy}
    LIMIT 100
  `).all(...params) as any[];

  const totalDesigns = (db.prepare("SELECT COUNT(*) as c FROM designs WHERE is_legacy = 0").get() as any).c;
  const customers = db.prepare(`
    SELECT DISTINCT c.id, c.name FROM companies c JOIN designs d ON d.company_id = c.id ORDER BY c.name
  `).all() as { id: number; name: string }[];
  const statuses = db.prepare(`SELECT DISTINCT lifecycle_status FROM designs WHERE lifecycle_status IS NOT NULL`).all() as { lifecycle_status: string }[];

  const hasFilters = q || customerFilter !== 'all' || statusFilter !== 'all';

  return (
    <div className="max-w-7xl mx-auto space-y-5 pb-12">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Design Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">
            {designs.length} of {totalDesigns} designs · search by name, plant #, or customer · add new designs manually or via customer intake
          </p>
        </div>
        <Button><Plus className="w-3.5 h-3.5 mr-1" />Add Design</Button>
      </header>

      {/* Search + filter + sort */}
      <Card>
        <form className="p-4 grid grid-cols-12 gap-3 items-end" action="/designs">
          <div className="col-span-4">
            <label className="block text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-1">Search</label>
            <input
              type="text"
              name="q"
              defaultValue={q}
              placeholder="Design name, plant #, or customer…"
              className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
            />
          </div>
          <div className="col-span-3">
            <label className="block text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-1">Customer</label>
            <select name="customer" defaultValue={customerFilter} className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm bg-white">
              <option value="all">All customers</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <label className="block text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-1">Status</label>
            <select name="status" defaultValue={statusFilter} className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm bg-white">
              <option value="all">All</option>
              {statuses.map((s) => <option key={s.lifecycle_status} value={s.lifecycle_status}>{s.lifecycle_status}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <label className="block text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-1">Sort by</label>
            <select name="sort" defaultValue={sort} className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm bg-white">
              <option value="created_desc">Newest first</option>
              <option value="created_asc">Oldest first</option>
              <option value="name_asc">Name (A→Z)</option>
              <option value="name_desc">Name (Z→A)</option>
              <option value="plant_asc">Plant # ↑</option>
              <option value="plant_desc">Plant # ↓</option>
              <option value="customer_asc">Customer (A→Z)</option>
            </select>
          </div>
          <div className="col-span-1 flex gap-1.5">
            <Button size="sm" type="submit" className="w-full">Apply</Button>
            {hasFilters && (
              <Link href="/designs" className="px-2 py-1.5 text-xs text-gray-500 hover:text-navy-700 border border-gray-300 rounded">Clear</Link>
            )}
          </div>
        </form>
      </Card>

      <Card>
        <CardHeader
          title="Designs"
          subtitle="Each design has 1+ colorways · each colorway can have its own file reference · click into a design to add or edit colorways and files"
        />
        <table className="w-full text-sm">
          <thead className="text-xs text-gray-500 uppercase tracking-wider border-b border-gray-200">
            <tr>
              <th className="text-left px-3 py-2.5">Plant #</th>
              <th className="text-left px-3 py-2.5">Design Name</th>
              <th className="text-left px-3 py-2.5">Customer</th>
              <th className="text-left px-3 py-2.5">Colorways</th>
              <th className="text-left px-3 py-2.5">File</th>
              <th className="text-left px-3 py-2.5">Status</th>
              <th className="text-left px-3 py-2.5">Created</th>
              <th className="text-right px-3 py-2.5 pr-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {designs.length === 0 && (
              <tr><td colSpan={8} className="text-center py-12 text-gray-400">No designs match these filters.</td></tr>
            )}
            {designs.map((d) => {
              // Mock-resolve a primary file path matching the C9 routing convention
              const fileHref = `\\\\adt-nas\\artwork\\${(d.company_name || 'customer').toLowerCase().replace(/[^a-z0-9]/g, '-')}\\${d.plant_number}\\production\\`;
              const fileName = `${d.plant_number}_production.tif`;
              return (
                <tr key={d.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-3 py-2.5 font-mono text-xs text-navy-700">{d.plant_number}</td>
                  <td className="px-3 py-2.5 font-semibold">{d.name}</td>
                  <td className="px-3 py-2.5 text-xs">
                    <Link href={`/customers/${d.company_id}`} className="text-navy-700 hover:underline">{d.company_name}</Link>
                  </td>
                  <td className="px-3 py-2.5 text-xs">
                    <div className="font-mono">{d.colorway_count}</div>
                    {d.colorway_preview && <div className="text-[10px] text-gray-500 mt-0.5 truncate max-w-44">{d.colorway_preview}</div>}
                  </td>
                  <td className="px-3 py-2.5 text-xs">
                    <a href="#" title={fileHref} className="text-navy-700 hover:underline inline-flex items-center gap-1 font-mono">
                      <FileText className="w-3 h-3" /> {fileName}
                    </a>
                  </td>
                  <td className="px-3 py-2.5">
                    <Tag color={d.lifecycle_status === 'Active' ? 'green' : d.lifecycle_status === 'Archived' ? 'gray' : 'yellow'}>
                      {d.lifecycle_status}
                    </Tag>
                  </td>
                  <td className="px-3 py-2.5 text-xs">{formatDate(d.created_at)}</td>
                  <td className="px-3 py-2.5 text-right pr-3">
                    <Link href={`/designs/${d.id}`} className="text-xs font-semibold text-navy-700 hover:underline">Open →</Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="px-4 py-2 border-t border-gray-100 text-[11px] text-gray-500 italic">
          <strong>Each design supports multiple colorways.</strong> Each colorway can reference its own production file (resolved via the customer's C9 routing guide).
          <Link href="/customer-configs" className="text-navy-700 hover:underline ml-1.5">Configure customer routing rules</Link> to control where files are stored and how they're picked up at print time.
        </div>
      </Card>
    </div>
  );
}
