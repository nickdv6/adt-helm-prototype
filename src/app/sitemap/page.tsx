// Sitemap — every registered page in the prototype, grouped by category.
// Source of truth = src/lib/page-meta.ts. Adding a page there shows it here.
import Link from 'next/link';
import { Card, CardHeader, Tag } from '@/components/ui';
import { PAGES, Category, sourceUrl } from '@/lib/page-meta';
import { Code2, Database, FileQuestion } from 'lucide-react';

const CATEGORY_ORDER: Category[] = [
  'Meta',
  'Daily',
  'Role Home',
  'Orders',
  'Production',
  'Dashboards',
  'Fulfillment',
  'Operations',
  'Admin',
  'Settings',
  'Customer-Facing',
];

export default function Sitemap() {
  // Group by category
  const grouped = new Map<Category, typeof PAGES>();
  CATEGORY_ORDER.forEach((c) => grouped.set(c, []));
  PAGES.forEach((p) => {
    if (!grouped.has(p.category)) grouped.set(p.category, []);
    grouped.get(p.category)!.push(p);
  });

  const counts = {
    total: PAGES.length,
    live: PAGES.filter((p) => p.dataSource === 'live').length,
    mock: PAGES.filter((p) => p.dataSource === 'mock').length,
    mixed: PAGES.filter((p) => p.dataSource === 'mixed').length,
    blueprint: PAGES.filter((p) => p.blueprintId).length,
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-navy-900">Prototype Sitemap</h1>
        <p className="text-sm text-gray-600 mt-1">Every page in the prototype, grouped by category. Each row shows the blueprint S## reference, Wave tag, data source, and a link to source on GitHub.</p>
      </header>

      <div className="grid grid-cols-5 gap-4">
        <Stat label="Total pages" value={counts.total} />
        <Stat label="DB-backed" value={counts.live} accent="green" />
        <Stat label="Mock" value={counts.mock} accent="yellow" />
        <Stat label="Mixed" value={counts.mixed} accent="blue" />
        <Stat label="Blueprint-mapped" value={counts.blueprint} />
      </div>

      {CATEGORY_ORDER.map((cat) => {
        const pages = grouped.get(cat) ?? [];
        if (pages.length === 0) return null;
        return (
          <Card key={cat}>
            <CardHeader title={cat} subtitle={`${pages.length} page${pages.length === 1 ? '' : 's'}`} />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
                  <tr>
                    <th className="text-left px-4 py-2.5 w-72">Page</th>
                    <th className="text-left px-4 py-2.5">Summary</th>
                    <th className="text-left px-4 py-2.5">S##</th>
                    <th className="text-left px-4 py-2.5">Wave</th>
                    <th className="text-left px-4 py-2.5">Data</th>
                    <th className="text-left px-4 py-2.5">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {pages.map((p) => {
                    const tag =
                      p.dataSource === 'live' ? { label: 'Live', color: 'green' as const, icon: <Database className="w-3 h-3" /> }
                      : p.dataSource === 'mock' ? { label: 'Mock', color: 'yellow' as const, icon: <FileQuestion className="w-3 h-3" /> }
                      : { label: 'Mixed', color: 'blue' as const, icon: <Database className="w-3 h-3" /> };
                    return (
                      <tr key={p.path} className="border-t border-gray-100 hover:bg-gray-50">
                        <td className="px-4 py-2.5">
                          <Link href={p.path.replace(/\[[^\]]+\]/g, '')} className="text-navy-700 font-semibold hover:underline text-sm block">
                            {p.title}
                          </Link>
                          <div className="text-[10px] font-mono text-gray-400">{p.path}</div>
                        </td>
                        <td className="px-4 py-2.5 text-xs text-gray-600">{p.summary}</td>
                        <td className="px-4 py-2.5">
                          {p.blueprintId
                            ? <span className="font-mono text-xs bg-navy-50 text-navy-700 border border-navy-700/20 px-1.5 py-0.5 rounded">{p.blueprintId}</span>
                            : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-[10px] text-gray-600">{p.wave}</td>
                        <td className="px-4 py-2.5">
                          <span className="inline-flex items-center gap-1">
                            <Tag color={tag.color}>{tag.label}</Tag>
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <a href={sourceUrl(p)} target="_blank" rel="noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-navy-700 hover:underline">
                            <Code2 className="w-3 h-3" />view
                          </a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: any; accent?: 'green' | 'yellow' | 'blue' }) {
  const cls = accent === 'green' ? 'text-green-700'
    : accent === 'yellow' ? 'text-yellow-700'
    : accent === 'blue' ? 'text-navy-700'
    : 'text-navy-900';
  return (
    <Card>
      <div className="p-4">
        <div className="text-xs uppercase tracking-wider text-gray-500 mb-1">{label}</div>
        <div className={`text-2xl font-bold ${cls}`}>{value}</div>
      </div>
    </Card>
  );
}
