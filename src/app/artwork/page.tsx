// S27 File / Artwork Management
// Searchable artwork browser. Naming pattern: PLANT#_DESIGN_COLORWAY_VERSION.
// Columns: file name, PLANT#, design, colorway, version, status, dpi, color profile, file size, date received.
// Status counts row + status filter + customer filter + search + file-naming validator pass.
import Link from 'next/link';
import { getDb } from '@/lib/db';
import { Card, CardHeader, Tag, Button } from '@/components/ui';
import { formatDate, relativeTime } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const STATUS_COLORS: Record<string, 'gray' | 'blue' | 'green' | 'yellow' | 'red'> = {
  'Draft': 'gray',
  'Pending Approval': 'yellow',
  'Approved': 'green',
  'Archived': 'gray',
};

// Validator: returns null if the file name matches PLANT#_DESIGN_COLORWAY_VERSION pattern.
function namingError(fileName: string, plantNumber: string): string | null {
  if (!fileName.startsWith(plantNumber + '_')) return 'PLANT# prefix missing';
  if (!/_v\d+\.(tiff|tif|psd|pdf|ai|png|jpg|jpeg)$/i.test(fileName)) return 'Version suffix missing';
  const parts = fileName.replace(/\.[^.]+$/, '').split('_');
  if (parts.length < 4) return 'Too few parts (need PLANT#_DESIGN_COLORWAY_VERSION)';
  return null;
}

export default function ArtworkManagement({ searchParams }: { searchParams: { status?: string; customer?: string; q?: string } }) {
  const db = getDb();
  const statusFilter = searchParams.status ?? 'all';
  const customerFilter = searchParams.customer ?? 'all';
  const q = (searchParams.q ?? '').trim().toLowerCase();

  const rows = db.prepare(`
    SELECT af.*, d.plant_number, d.name as design_name, d.company_id, c.name as company_name,
           cw.name as colorway_name, u.full_name as submitted_by_name,
           (SELECT COUNT(*) FROM print_requests pr WHERE pr.artwork_file_id = af.id) as pr_count
    FROM artwork_files af
    JOIN designs d ON af.design_id = d.id
    JOIN companies c ON d.company_id = c.id
    LEFT JOIN colorways cw ON af.colorway_id = cw.id
    LEFT JOIN users u ON af.submitted_by_user_id = u.id
    ORDER BY af.date_received DESC
  `).all() as any[];

  const companies = Array.from(new Map(rows.map((r) => [r.company_id, r.company_name])).entries())
    .sort((a, b) => (a[1] as string).localeCompare(b[1] as string));

  let filtered = rows;
  if (statusFilter !== 'all') filtered = filtered.filter((r) => r.status === statusFilter);
  if (customerFilter !== 'all') filtered = filtered.filter((r) => String(r.company_id) === customerFilter);
  if (q) filtered = filtered.filter((r) =>
    r.file_name.toLowerCase().includes(q)
    || (r.plant_number ?? '').toLowerCase().includes(q)
    || (r.design_name ?? '').toLowerCase().includes(q)
    || (r.colorway_name ?? '').toLowerCase().includes(q)
  );

  // Counts row
  const counts = {
    total: rows.length,
    approved: rows.filter((r) => r.status === 'Approved').length,
    pending: rows.filter((r) => r.status === 'Pending Approval').length,
    draft: rows.filter((r) => r.status === 'Draft').length,
    naming_errors: rows.filter((r) => namingError(r.file_name, r.plant_number)).length,
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Artwork Management</h1>
          <p className="text-sm text-gray-600 mt-0.5">
            File naming pattern: <code className="font-mono bg-gray-100 px-1.5 py-0.5 rounded text-xs">PLANT#_DESIGN_COLORWAY_VERSION.ext</code>
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary">Browse NAS</Button>
          <Button>Upload Artwork</Button>
        </div>
      </header>

      <div className="grid grid-cols-5 gap-4">
        <Stat label="Total files" value={counts.total} />
        <Stat label="Approved" value={counts.approved} accent="green" />
        <Stat label="Pending approval" value={counts.pending} accent="yellow" />
        <Stat label="Draft" value={counts.draft} />
        <Stat label="Naming errors" value={counts.naming_errors} accent="red" />
      </div>

      {counts.naming_errors > 0 && (
        <Card>
          <CardHeader title="Naming Validator" subtitle={`${counts.naming_errors} file(s) don't match the PLANT#_DESIGN_COLORWAY_VERSION pattern`} />
          <div className="p-5 text-sm text-gray-600">
            Files with naming issues are flagged in the table below. The intake bot blocks PRs that reference improperly-named files until they&apos;re corrected.
          </div>
        </Card>
      )}

      <Card>
        <CardHeader title="Filters" />
        <div className="p-5">
          <form action="/artwork" className="flex flex-wrap items-center gap-2">
            <select name="status" defaultValue={statusFilter} className="text-sm border border-gray-300 rounded px-2 py-1">
              <option value="all">All statuses</option>
              {Object.keys(STATUS_COLORS).map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select name="customer" defaultValue={customerFilter} className="text-sm border border-gray-300 rounded px-2 py-1 max-w-xs">
              <option value="all">All customers</option>
              {companies.map(([id, name]) => <option key={id as any} value={id as any}>{name}</option>)}
            </select>
            <input type="search" name="q" defaultValue={q}
              placeholder="Search file / PLANT# / design / colorway"
              className="text-sm border border-gray-300 rounded px-2 py-1 w-72" />
            <Button size="sm" variant="secondary">Apply</Button>
          </form>
        </div>
      </Card>

      <Card>
        <CardHeader title={`${filtered.length} files`} action={<Button size="sm" variant="ghost">Export Excel</Button>} />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
              <tr>
                <th className="text-left px-4 py-2.5">File</th>
                <th className="text-left px-4 py-2.5">PLANT#</th>
                <th className="text-left px-4 py-2.5">Design</th>
                <th className="text-left px-4 py-2.5">Colorway</th>
                <th className="text-left px-4 py-2.5">v</th>
                <th className="text-left px-4 py-2.5">Status</th>
                <th className="text-left px-4 py-2.5">DPI</th>
                <th className="text-left px-4 py-2.5">Size</th>
                <th className="text-left px-4 py-2.5">Customer</th>
                <th className="text-left px-4 py-2.5">PRs</th>
                <th className="text-left px-4 py-2.5">Received</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 200).map((r) => {
                const err = namingError(r.file_name, r.plant_number);
                return (
                  <tr key={r.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-mono text-xs">
                      <div className="flex items-center gap-2">
                        <span>{r.file_name}</span>
                        {err && <Tag color="red">{err}</Tag>}
                        {r.is_original ? <Tag color="blue">orig</Tag> : null}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs">{r.plant_number}</td>
                    <td className="px-4 py-2.5">{r.design_name}</td>
                    <td className="px-4 py-2.5">{r.colorway_name ?? <span className="text-gray-300">—</span>}</td>
                    <td className="px-4 py-2.5 font-mono text-xs">v{r.version_number}</td>
                    <td className="px-4 py-2.5"><Tag color={STATUS_COLORS[r.status] ?? 'gray'}>{r.status}</Tag></td>
                    <td className="px-4 py-2.5 font-mono text-xs">{r.dpi}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-500">{(r.file_size_kb / 1024).toFixed(1)} MB</td>
                    <td className="px-4 py-2.5">
                      <Link href={`/customers/${r.company_id}`} className="text-navy-700 hover:underline">
                        {r.company_name}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-500">{r.pr_count}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-500">{r.date_received ? relativeTime(r.date_received) : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: any; accent?: 'yellow' | 'green' | 'red' }) {
  const accentCls = accent === 'yellow' ? 'text-yellow-700'
    : accent === 'green' ? 'text-green-700'
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
