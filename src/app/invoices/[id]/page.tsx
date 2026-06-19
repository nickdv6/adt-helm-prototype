// S36a Invoice Detail
// Uses the order_id as the invoice key in the prototype (1:1 order:invoice for MVP).
import Link from 'next/link';
import { getDb } from '@/lib/db';
import { Card, CardHeader, Tag, Button } from '@/components/ui';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function InvoiceDetail({ params }: { params: { id: string } }) {
  const db = getDb();
  const orderId = parseInt(params.id);
  const order = db.prepare(`
    SELECT o.*, c.name as company_name, c.terms, c.id as company_id
    FROM orders o JOIN companies c ON o.company_id = c.id WHERE o.id = ?
  `).get(orderId) as any;
  if (!order) notFound();

  const lines = db.prepare(`
    SELECT ol.*, s.adt_sku, s.product_type, d.plant_number, cw.name as colorway_name, f.name as fabric_name
    FROM order_lines ol
    JOIN skus s ON ol.sku_id = s.id
    LEFT JOIN designs d ON ol.design_id = d.id
    LEFT JOIN colorways cw ON ol.colorway_id = cw.id
    LEFT JOIN fabrics f ON ol.fabric_id = f.id
    WHERE ol.order_id = ?
  `).all(orderId) as any[];

  const subtotal = lines.reduce((s, l) => s + (l.unit_price ?? 0) * (l.quantity ?? 0), 0);
  const tax = 0; // mock — no tax logic in prototype
  const total = subtotal + tax;

  const invoiceNumber = `INV-${30000 + orderId}`;
  const qbId = order.status === 'Invoiced' || order.status === 'Closed' ? `QB:${30000 + orderId}` : null;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <header className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Link href="/accounting-home" className="text-sm text-gray-500 hover:underline">← Accounting Home</Link>
            <span className="text-gray-300">/</span>
            <h1 className="text-2xl font-bold text-navy-900 font-mono">{invoiceNumber}</h1>
            <Tag color={qbId ? 'green' : 'yellow'}>{qbId ? 'Synced to QB' : 'Not yet pushed'}</Tag>
          </div>
          <div className="text-sm text-gray-600">
            For order <Link href={`/orders/${order.id}`} className="font-mono hover:underline text-navy-700">{order.order_number}</Link>
            {' · '}<Link href={`/customers/${order.company_id}`} className="hover:underline">{order.company_name}</Link>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary">Print / PDF</Button>
          <Button variant="secondary">Email Customer</Button>
          {!qbId && <Button>Push to QuickBooks</Button>}
        </div>
      </header>

      <Card>
        <div className="p-6">
          <div className="grid grid-cols-2 gap-6 mb-6">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-1">Bill to</div>
              <div className="font-semibold">{order.company_name}</div>
              <div className="text-xs text-gray-500 mt-1">Terms: {order.terms ?? 'Net 30'}</div>
              {order.po_number && <div className="text-xs text-gray-500">Your PO: <span className="font-mono">{order.po_number}</span></div>}
            </div>
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-1">Invoice</div>
              <div className="font-mono font-semibold">{invoiceNumber}</div>
              <div className="text-xs text-gray-500 mt-1">Order: <span className="font-mono">{order.order_number}</span></div>
              {qbId && <div className="text-xs text-gray-500">QB ID: <span className="font-mono">{qbId}</span></div>}
            </div>
          </div>

          <table className="w-full text-sm border-t border-gray-200">
            <thead>
              <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
                <th className="text-left px-3 py-2">SKU</th>
                <th className="text-left px-3 py-2">Description</th>
                <th className="text-right px-3 py-2">Qty</th>
                <th className="text-right px-3 py-2">Unit</th>
                <th className="text-right px-3 py-2">Total</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => {
                const lineTotal = (l.unit_price ?? 0) * (l.quantity ?? 0);
                return (
                  <tr key={l.id} className="border-t border-gray-100">
                    <td className="px-3 py-2.5 font-mono text-xs">{l.adt_sku}</td>
                    <td className="px-3 py-2.5">
                      <div className="text-sm">{l.product_type}</div>
                      <div className="text-xs text-gray-500">
                        {[l.plant_number, l.colorway_name, l.fabric_name].filter(Boolean).join(' · ')}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-xs">{l.quantity} {l.quantity_unit}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-xs">${(l.unit_price ?? 0).toFixed(2)}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-xs font-semibold">${lineTotal.toFixed(2)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-300">
                <td colSpan={3} className="px-3 py-2"></td>
                <td className="px-3 py-2 text-right text-xs uppercase tracking-wider text-gray-500 font-semibold">Subtotal</td>
                <td className="px-3 py-2 text-right font-mono text-sm font-semibold">${subtotal.toFixed(2)}</td>
              </tr>
              <tr>
                <td colSpan={3}></td>
                <td className="px-3 py-1 text-right text-xs uppercase tracking-wider text-gray-500">Tax</td>
                <td className="px-3 py-1 text-right font-mono text-xs">${tax.toFixed(2)}</td>
              </tr>
              <tr className="bg-navy-50">
                <td colSpan={3}></td>
                <td className="px-3 py-2.5 text-right text-xs uppercase tracking-wider text-navy-700 font-bold">Total</td>
                <td className="px-3 py-2.5 text-right font-mono text-base font-bold text-navy-900">${total.toFixed(2)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      <Card>
        <CardHeader title="QuickBooks Sync History" />
        <div className="p-5 text-sm">
          {qbId ? (
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <Tag color="green">Synced</Tag>
                <span>Successfully pushed to QuickBooks Online as <span className="font-mono">{qbId}</span></span>
              </div>
              <div className="text-xs text-gray-500">Last sync: 3 hours ago by Diana Park</div>
            </div>
          ) : (
            <div className="text-xs text-gray-500 italic">Not yet synced. Click <strong>Push to QuickBooks</strong> above to send.</div>
          )}
        </div>
      </Card>
    </div>
  );
}
