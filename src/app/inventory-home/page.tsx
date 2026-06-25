// S10 Inventory / Purchasing Home — Karen Boyd
import Link from 'next/link';
import { getDb } from '@/lib/db';
import { RoleHomeShell } from '@/components/role-home';
import { Tag } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default function InventoryHome() {
  const db = getDb();
  const me = db.prepare(`SELECT * FROM users WHERE primary_role='inventory' LIMIT 1`).get() as any;

  const lowStock = db.prepare(`
    SELECT i.id, i.name, i.available_qty, i.reserved_qty, i.low_stock_threshold, i.status, i.item_type, i.item_class
    FROM inventory_items i
    WHERE i.status IN ('LowStock','OutOfStock')
    ORDER BY i.available_qty ASC
    LIMIT 20
  `).all() as any[];

  const outCount = lowStock.filter((i) => i.status === 'OutOfStock').length;
  const lowCount = lowStock.filter((i) => i.status === 'LowStock').length;
  const totalItems = db.prepare(`SELECT COUNT(*) as n FROM inventory_items`).get() as any;

  return (
    <RoleHomeShell
      userName={me?.full_name ?? 'Karen'}
      userRole="Inventory / Purchasing"
      greeting="Low + out-of-stock items, with quick links to the full inventory and supplier flow."
      kpis={[
        { label: 'Out of stock', value: outCount, accent: outCount > 0 ? 'red' : 'green' },
        { label: 'Low stock', value: lowCount, accent: lowCount > 0 ? 'yellow' : 'green' },
        { label: 'Total tracked items', value: totalItems?.n ?? 0 },
      ]}
      queueTitle="Stock alerts — purchasing priority"
      queueSubtitle="Out-of-stock first, then ascending available qty"
      queue={
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
              <tr>
                <th className="text-left px-4 py-2.5">Item</th>
                <th className="text-left px-4 py-2.5">Class</th>
                <th className="text-left px-4 py-2.5">Type</th>
                <th className="text-left px-4 py-2.5">Available</th>
                <th className="text-left px-4 py-2.5">Reserved</th>
                <th className="text-left px-4 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody>
              {lowStock.map((i) => {
                const classColor = i.item_class === 'fabric' ? 'blue' : i.item_class === 'customer_material' ? 'purple' : i.item_class === 'branded_supply' ? 'yellow' : 'gray';
                const classLabel = i.item_class === 'customer_material' ? 'Customer Material' : i.item_class === 'branded_supply' ? 'Branded Supply' : i.item_class === 'fabric' ? 'Fabric' : (i.item_class ?? 'Fabric');
                return (
                  <tr key={i.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-2.5 text-sm">{i.name}</td>
                    <td className="px-4 py-2.5"><Tag color={classColor}>{classLabel}</Tag></td>
                    <td className="px-4 py-2.5"><Tag>{i.item_type}</Tag></td>
                    <td className="px-4 py-2.5 font-mono text-xs">{i.available_qty}</td>
                    <td className="px-4 py-2.5 font-mono text-xs">{i.reserved_qty}</td>
                    <td className="px-4 py-2.5">
                      <Tag color={i.status === 'OutOfStock' ? 'red' : 'yellow'}>{i.status}</Tag>
                    </td>
                  </tr>
                );
              })}
              {lowStock.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-500 italic">Stock is healthy.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      }
      activityTitle="Recent inventory activity (prototype mock)"
      activity={
        <div className="p-5 text-sm text-gray-600 space-y-2">
          <div className="flex items-center gap-3">
            <Tag color="green">PO placed</Tag>
            <span>500 yds <strong>Cotton sateen 200gsm</strong> from MillCo · ETA 5 days</span>
          </div>
          <div className="flex items-center gap-3">
            <Tag color="blue">Received</Tag>
            <span>2 rolls <strong>Performance velvet</strong> · receiver inspected, ready to stage</span>
          </div>
          <div className="flex items-center gap-3">
            <Tag color="yellow">Allocated</Tag>
            <span>3 yds <strong>St Frank PFP linen</strong> reserved for PR-8421</span>
          </div>
        </div>
      }
      crossLinks={[
        { label: 'Inventory Dashboard', href: '/inventory', description: 'Full item list with filters' },
        { label: 'Receiving Home', href: '/receiving-home', description: 'Inbound from suppliers' },
        { label: 'Customers', href: '/customers', description: 'Customer-owned fabric / open bank' },
      ]}
    />
  );
}
