// S35a Shipment Detail
// Mock — no shipments table in schema yet. Surface uses recent shipped rolls
// grouped under a synthetic shipment id (uses an order_id as the lookup key).
import Link from 'next/link';
import { getDb } from '@/lib/db';
import { Card, CardHeader, Tag, Button, StatusPill } from '@/components/ui';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function ShipmentDetail({ params }: { params: { id: string } }) {
  const db = getDb();
  const orderId = parseInt(params.id);
  const order = db.prepare(`
    SELECT o.*, c.name as company_name, c.is_third_party_billed, c.carrier_account_number, c.carrier_account_carrier
    FROM orders o JOIN companies c ON o.company_id = c.id WHERE o.id = ?
  `).get(orderId) as any;
  if (!order) notFound();

  const rolls = db.prepare(`
    SELECT r.*, pr.pr_number, ol.id as line_id, s.adt_sku, s.product_type, f.name as fabric_name
    FROM pr_rolls r
    JOIN print_requests pr ON r.pr_id = pr.id
    JOIN order_lines ol ON pr.order_line_id = ol.id
    JOIN skus s ON ol.sku_id = s.id
    LEFT JOIN fabrics f ON pr.fabric_id = f.id
    WHERE ol.order_id = ? AND r.ship_status IN ('packed','shipped')
    ORDER BY r.roll_number
  `).all(orderId) as any[];

  const shipped = rolls.filter((r) => r.ship_status === 'shipped').length;
  const packed = rolls.filter((r) => r.ship_status === 'packed').length;
  const totalYards = rolls.reduce((s, r) => s + (r.yards ?? 0), 0);
  const isComplete = packed === 0 && rolls.length > 0;

  // Mock shipment metadata (would come from a shipments table tied to EasyPost in production)
  const shipmentNumber = `SHP-${String(orderId).padStart(6, '0')}`;
  const trackingNumber = isComplete ? `1Z${order.order_number.replace(/[^0-9]/g, '').padEnd(15, '0').slice(0, 15)}` : null;
  const carrier = order.is_third_party_billed ? order.carrier_account_carrier : 'UPS';

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <header className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Link href="/shipping" className="text-sm text-gray-500 hover:underline">← Shipping</Link>
            <span className="text-gray-300">/</span>
            <h1 className="text-2xl font-bold text-navy-900 font-mono">{shipmentNumber}</h1>
            <Tag color={isComplete ? 'green' : packed > 0 ? 'yellow' : 'gray'}>
              {isComplete ? 'Shipped' : packed > 0 ? 'In Pack-out' : 'Empty'}
            </Tag>
            {order.is_rush ? <Tag color="red">Rush</Tag> : null}
            {order.is_blind_ship ? <Tag color="purple">Blind Ship</Tag> : null}
            {order.requires_cad_services ? <Tag color="blue">CAD Services</Tag> : null}
            {order.insure_package ? <Tag color="yellow">Insure Package</Tag> : null}
          </div>
          <div className="text-sm text-gray-600">
            {order.company_name} · Order <Link href={`/orders/${order.id}`} className="font-mono hover:underline text-navy-700">{order.order_number}</Link>
          </div>
        </div>
        <div className="flex gap-2">
          {!isComplete && <Button>Generate Label</Button>}
          {trackingNumber && <Button variant="secondary">Track on {carrier}</Button>}
        </div>
      </header>

      <div className="grid grid-cols-4 gap-4">
        <Stat label="Rolls in shipment" value={rolls.length} />
        <Stat label="Packed" value={packed} accent={packed > 0 ? 'yellow' : 'gray'} />
        <Stat label="Shipped" value={shipped} accent={shipped > 0 ? 'green' : 'gray'} />
        <Stat label="Total yards" value={totalYards.toFixed(0)} />
      </div>

      <div className="grid grid-cols-3 gap-6">
        <Card className="col-span-2">
          <CardHeader title="Rolls in this shipment" />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-2.5">Roll #</th>
                  <th className="text-left px-4 py-2.5">PR</th>
                  <th className="text-left px-4 py-2.5">Product</th>
                  <th className="text-left px-4 py-2.5">Fabric</th>
                  <th className="text-left px-4 py-2.5">Yards</th>
                  <th className="text-left px-4 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody>
                {rolls.map((r) => (
                  <tr key={r.id} className="border-t border-gray-100">
                    <td className="px-4 py-2.5 font-mono text-xs font-semibold">{r.roll_number}</td>
                    <td className="px-4 py-2.5 font-mono text-xs">
                      <Link href={`/print-requests/${r.pr_id}`} className="text-navy-700 hover:underline">{r.pr_number}</Link>
                    </td>
                    <td className="px-4 py-2.5 text-xs">{r.product_type}</td>
                    <td className="px-4 py-2.5 text-xs">{r.fabric_name}</td>
                    <td className="px-4 py-2.5 font-mono text-xs">{r.yards}</td>
                    <td className="px-4 py-2.5">
                      <Tag color={r.ship_status === 'shipped' ? 'green' : 'yellow'}>{r.ship_status}</Tag>
                    </td>
                  </tr>
                ))}
                {rolls.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-500 italic">No packed rolls for this shipment yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <CardHeader title="Label & Manifest" />
          <div className="p-5 space-y-3 text-sm">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-0.5">Carrier</div>
              <div className="font-semibold">{carrier}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-0.5">Tracking #</div>
              {trackingNumber ? (
                <div className="font-mono text-sm">{trackingNumber}</div>
              ) : (
                <div className="text-xs text-gray-400 italic">Generated on label creation</div>
              )}
            </div>
            {order.is_third_party_billed && (
              <div>
                <div className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-0.5">3rd-Party Billing</div>
                <div className="text-xs">
                  Bills to customer&apos;s {order.carrier_account_carrier} account
                  <div className="font-mono mt-0.5">#{order.carrier_account_number}</div>
                </div>
              </div>
            )}
            <div className="border-t border-gray-200 pt-3 mt-3">
              <div className="aspect-[4/5] bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-200 rounded flex items-center justify-center text-gray-400 text-xs">
                [Shipping label preview]
              </div>
              <Button size="sm" variant="secondary" className="w-full mt-2">Print / Reprint Label</Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: any; accent?: 'green' | 'yellow' | 'gray' }) {
  const cls = accent === 'green' ? 'text-green-700'
    : accent === 'yellow' ? 'text-yellow-700'
    : accent === 'gray' ? 'text-gray-400'
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
