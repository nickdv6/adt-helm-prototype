import { getDb } from '@/lib/db';
import { Card, CardHeader, Tag, StatusPill } from '@/components/ui';

// /inventory — Stock visibility for fabrics (Wave 1)
// Wave 2 adds inserts, labels, tags, mailers, packaging

export default function Inventory() {
  const db = getDb();
  const items = db.prepare(`
    SELECT i.*, f.name as fabric_name
    FROM inventory_items i
    LEFT JOIN fabrics f ON i.fabric_id = f.id
    ORDER BY (CASE i.status WHEN 'OutOfStock' THEN 0 WHEN 'LowStock' THEN 1 ELSE 2 END), f.name
  `).all() as any[];

  const counts = {
    total: items.length,
    out: items.filter((i) => i.status === 'OutOfStock').length,
    low: items.filter((i) => i.status === 'LowStock').length,
    ok: items.filter((i) => i.status === 'Available').length,
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-navy-900">Inventory</h1>
        <p className="text-sm text-gray-500 mt-1">Wave 1 scope — fabric stock only · {counts.total} SKUs tracked</p>
      </header>

      <div className="grid grid-cols-3 gap-4">
        <Stat label="Out of Stock" value={counts.out} accent="red" />
        <Stat label="Low Stock" value={counts.low} accent="yellow" />
        <Stat label="Available" value={counts.ok} accent="green" />
      </div>

      <Card>
        <table className="w-full text-sm">
          <thead className="text-xs text-gray-500 uppercase tracking-wider border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-2.5">Fabric</th>
              <th className="text-left px-4 py-2.5">Status</th>
              <th className="text-right px-4 py-2.5">Available</th>
              <th className="text-right px-4 py-2.5">Reserved</th>
              <th className="text-right px-4 py-2.5 pr-5">Threshold</th>
            </tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.id} className="border-t border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-2.5 font-semibold">{i.fabric_name || i.name}</td>
                <td className="px-4 py-2.5"><StatusPill status={i.status} /></td>
                <td className="px-4 py-2.5 text-right font-mono">{i.available_qty}</td>
                <td className="px-4 py-2.5 text-right font-mono text-gray-500">{i.reserved_qty}</td>
                <td className="px-4 py-2.5 text-right font-mono text-gray-400 pr-5">{i.low_stock_threshold}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: any; accent?: 'yellow' | 'red' | 'green' | 'blue' }) {
  const bar = {
    yellow: 'bg-helm-yellow', red: 'bg-helm-red', green: 'bg-helm-green', blue: 'bg-helm-blue',
  }[accent || ''] || 'bg-gray-200';
  return (
    <Card>
      <div className="p-4 flex items-center gap-3">
        <div className={`w-1 h-10 rounded ${bar}`} />
        <div>
          <div className="text-2xl font-bold text-navy-900 leading-tight">{value}</div>
          <div className="text-[11px] text-gray-500 uppercase tracking-wider mt-0.5">{label}</div>
        </div>
      </div>
    </Card>
  );
}
