// S11 Shipping Home — Marcus Hill
import Link from 'next/link';
import { getDb } from '@/lib/db';
import { RoleHomeShell } from '@/components/role-home';
import { StatusPill, Tag } from '@/components/ui';
import { formatDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default function ShippingHome() {
  const db = getDb();
  const me = db.prepare(`SELECT * FROM users WHERE primary_role='shipping' LIMIT 1`).get() as any;

  // Packed rolls ready to ship, grouped by order
  const readyToShip = db.prepare(`
    SELECT o.id, o.order_number, c.name as company_name, o.adt_promised_date, o.is_blind_ship,
           o.is_rush, COUNT(r.id) as roll_count, SUM(r.yards) as total_yards
    FROM pr_rolls r
    JOIN print_requests pr ON r.pr_id = pr.id
    JOIN order_lines ol ON pr.order_line_id = ol.id
    JOIN orders o ON ol.order_id = o.id
    JOIN companies c ON o.company_id = c.id
    WHERE r.ship_status = 'packed'
    GROUP BY o.id
    ORDER BY o.adt_promised_date ASC
    LIMIT 15
  `).all() as any[];

  const packedRolls = db.prepare(`SELECT COUNT(*) as n FROM pr_rolls WHERE ship_status='packed'`).get() as any;
  const shippedToday = db.prepare(`
    SELECT COUNT(*) as n FROM pr_rolls WHERE date(shipped_at) = date('now') AND ship_status='shipped'
  `).get() as any;

  return (
    <RoleHomeShell
      userName={me?.full_name ?? 'Marcus'}
      userRole="Shipping"
      greeting="Packed and waiting — rolls ready to label, manifest, and walk out the door."
      kpis={[
        { label: 'Packed rolls', value: packedRolls?.n ?? 0, accent: 'yellow' },
        { label: 'Orders ready to ship', value: readyToShip.length, accent: 'blue' },
        { label: 'Shipped today', value: shippedToday?.n ?? 0, accent: 'green' },
      ]}
      queueTitle="Orders Ready to Ship"
      queueSubtitle="Promised-date order; flagged for rush + blind-ship handling"
      queue={
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
              <tr>
                <th className="text-left px-4 py-2.5">Order</th>
                <th className="text-left px-4 py-2.5">Customer</th>
                <th className="text-left px-4 py-2.5">Rolls</th>
                <th className="text-left px-4 py-2.5">Yards</th>
                <th className="text-left px-4 py-2.5">Promised</th>
                <th className="text-left px-4 py-2.5">Flags</th>
              </tr>
            </thead>
            <tbody>
              {readyToShip.map((o) => (
                <tr key={o.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-2.5 font-mono text-xs">
                    <Link href={`/orders/${o.id}`} className="text-navy-700 font-semibold hover:underline">{o.order_number}</Link>
                  </td>
                  <td className="px-4 py-2.5">{o.company_name}</td>
                  <td className="px-4 py-2.5 font-mono text-xs">{o.roll_count}</td>
                  <td className="px-4 py-2.5 font-mono text-xs">{(o.total_yards ?? 0).toFixed(0)}</td>
                  <td className="px-4 py-2.5 text-xs">{o.adt_promised_date ? formatDate(o.adt_promised_date) : <span className="text-gray-300">—</span>}</td>
                  <td className="px-4 py-2.5 space-x-1">
                    {o.is_rush ? <Tag color="red">Rush</Tag> : null}
                    {o.is_blind_ship ? <Tag color="purple">Blind</Tag> : null}
                  </td>
                </tr>
              ))}
              {readyToShip.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-500 italic">Nothing waiting to ship.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      }
      activityTitle="Recently shipped rolls"
      activity={
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
              <tr>
                <th className="text-left px-4 py-2.5">Roll #</th>
                <th className="text-left px-4 py-2.5">PR</th>
                <th className="text-left px-4 py-2.5">Yards</th>
                <th className="text-left px-4 py-2.5">Shipped</th>
              </tr>
            </thead>
            <tbody>
              {(db.prepare(`
                SELECT r.roll_number, r.yards, r.shipped_at, pr.pr_number, pr.id as pr_id
                FROM pr_rolls r JOIN print_requests pr ON r.pr_id = pr.id
                WHERE r.ship_status='shipped'
                ORDER BY r.shipped_at DESC LIMIT 10
              `).all() as any[]).map((r) => (
                <tr key={r.roll_number} className="border-t border-gray-100">
                  <td className="px-4 py-2.5 font-mono text-xs font-semibold">{r.roll_number}</td>
                  <td className="px-4 py-2.5 font-mono text-xs"><Link href={`/print-requests/${r.pr_id}`} className="text-navy-700 hover:underline">{r.pr_number}</Link></td>
                  <td className="px-4 py-2.5 font-mono text-xs">{r.yards}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-500">{r.shipped_at ? new Date(r.shipped_at).toLocaleString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      }
      crossLinks={[
        { label: 'Shipping Dashboard', href: '/shipping', description: 'Full per-order shipping flow' },
        { label: 'Created Rolls', href: '/rolls', description: 'All rolls registry' },
        { label: 'Returns', href: '/returns', description: 'RMA / inspection' },
      ]}
    />
  );
}
