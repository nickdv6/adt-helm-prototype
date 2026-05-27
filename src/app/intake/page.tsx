import Link from 'next/link';
import { getDb } from '@/lib/db';
import { Card, CardHeader, Tag, Button } from '@/components/ui';

// S42b CSV/XML Intake Configuration + Auto-Route
// Per S23-S32.61 — scripts pull files + route to hot folders by SKU characteristics
// 5 active customers in scope: St Frank, Inside, Lemieux, Laura Park, Fabric Megastore

export default function Intake() {
  const db = getDb();
  const configs = db.prepare(`
    SELECT ic.*, c.name as company_name
    FROM intake_configs ic
    JOIN companies c ON ic.company_id = c.id
    ORDER BY c.name
  `).all() as any[];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">CSV / XML Intake (S42b)</h1>
          <p className="text-sm text-gray-500 mt-1">Per S23-S32.61 — auto-route scripts pull files + drop into hot folders by SKU</p>
        </div>
        <Button>+ Add Customer Config</Button>
      </header>

      <Card>
        <CardHeader title="Active Configs" subtitle={`${configs.length} customers · ${configs.filter((c) => c.auto_route_enabled).length} with auto-route enabled`} />
        <div className="divide-y divide-gray-100">
          {configs.map((c) => (
            <div key={c.id} className="px-5 py-4 grid grid-cols-5 gap-3 items-center text-sm">
              <div>
                <Link href={`/customers/${c.company_id}`} className="font-semibold text-navy-700 hover:underline">{c.company_name}</Link>
                <div className="text-xs text-gray-500">Intake config</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-0.5">Mode</div>
                <Tag color="gray">{c.intake_mode}</Tag>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-0.5">Format</div>
                <Tag color="blue">{c.file_format.toUpperCase()}</Tag>
              </div>
              <div className="col-span-2">
                <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-0.5">Source / Hot Folder</div>
                <div className="font-mono text-xs text-gray-700 truncate">{c.source_path}</div>
                {c.auto_route_enabled
                  ? <Tag color="green">Auto-route ENABLED</Tag>
                  : <Tag color="yellow">Manual review</Tag>}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader title="Recent Import History" subtitle="Per import: counts + failed-row queue routes to CSR review" />
        <div className="px-5 py-8 text-sm text-gray-400 text-center italic">
          Import history will populate once intake watcher runs. CSR sees failed rows in CSV/XML Import Failures sidebar widget on Home.
        </div>
      </Card>
    </div>
  );
}
