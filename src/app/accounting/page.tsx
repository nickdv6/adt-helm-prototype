// S36 Accounting / QuickBooks Workflows
import Link from 'next/link';
import { getDb } from '@/lib/db';
import { Card, CardHeader, Tag, Button, StatusPill } from '@/components/ui';
import { formatDate, relativeTime } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default function AccountingWorkflows() {
  const db = getDb();

  // Ready to invoice (Shipped not yet Invoiced)
  const ready = db.prepare(`
    SELECT o.id, o.order_number, o.subtotal, c.name as company_name, c.terms,
           o.po_number
    FROM orders o JOIN companies c ON o.company_id = c.id
    WHERE o.status = 'Shipped'
    ORDER BY o.id DESC LIMIT 30
  `).all() as any[];

  // Recently invoiced
  const invoiced = db.prepare(`
    SELECT o.id, o.order_number, o.subtotal, c.name as company_name
    FROM orders o JOIN companies c ON o.company_id = c.id
    WHERE o.status IN ('Invoiced','Closed')
    ORDER BY o.id DESC LIMIT 15
  `).all() as any[];

  // On hold (accounting-relevant)
  const onHold = db.prepare(`
    SELECT o.id, o.order_number, o.hold_status, o.subtotal, c.name as company_name
    FROM orders o JOIN companies c ON o.company_id = c.id
    WHERE o.hold_status IS NOT NULL AND o.status NOT IN ('Cancelled','Closed')
  `).all() as any[];

  // Mock QB sync queue
  const mockSyncQueue = [
    { entity: 'Invoice', ref: 'INV-30421', customer: 'St Frank', status: 'queued', queued: '3m ago' },
    { entity: 'Invoice', ref: 'INV-30420', customer: 'Inside', status: 'queued', queued: '12m ago' },
    { entity: 'Customer', ref: 'New customer: Atelier Vivienne', customer: '—', status: 'syncing', queued: '14m ago' },
    { entity: 'Invoice', ref: 'INV-30419', customer: 'Lemieux Et Cie', status: 'failed', queued: '32m ago', error: 'Customer not found in QB — link required' },
    { entity: 'Payment', ref: '$2,840 received from Acme Interiors', customer: 'Acme Interiors', status: 'queued', queued: '1h ago' },
  ];

  const totalReadyValue = ready.reduce((s, o) => s + (o.subtotal ?? 0), 0);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Accounting · QuickBooks Workflows</h1>
          <p className="text-sm text-gray-600 mt-0.5">Ready-to-invoice queue, QB sync status, holds. Wave 1 = manual QB push from a button; Wave 2 = automatic.</p>
        </div>
        <Button>+ Manual Invoice</Button>
      </header>

      <div className="grid grid-cols-5 gap-4">
        <Stat label="Ready to invoice" value={ready.length} accent="yellow" />
        <Stat label="Ready value" value={`$${totalReadyValue.toFixed(0)}`} />
        <Stat label="Invoiced lifetime" value={invoiced.length} accent="green" />
        <Stat label="On hold" value={onHold.length} accent={onHold.length > 0 ? 'red' : 'green'} />
        <Stat label="QB sync queue" value={mockSyncQueue.filter((q) => q.status !== 'failed').length} accent="blue" />
      </div>

      <Card>
        <CardHeader title="Ready to Invoice" subtitle="Shipped orders awaiting invoicing — select rows then push to QuickBooks" />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
              <tr>
                <th className="text-left px-4 py-2.5 w-8"><input type="checkbox" /></th>
                <th className="text-left px-4 py-2.5">Order</th>
                <th className="text-left px-4 py-2.5">Customer</th>
                <th className="text-left px-4 py-2.5">PO #</th>
                <th className="text-left px-4 py-2.5">Terms</th>
                <th className="text-left px-4 py-2.5">Subtotal</th>
                <th className="text-left px-4 py-2.5">Action</th>
              </tr>
            </thead>
            <tbody>
              {ready.map((o) => (
                <tr key={o.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-2.5"><input type="checkbox" /></td>
                  <td className="px-4 py-2.5 font-mono text-xs">
                    <Link href={`/orders/${o.id}`} className="text-navy-700 font-semibold hover:underline">{o.order_number}</Link>
                  </td>
                  <td className="px-4 py-2.5">{o.company_name}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-gray-500">{o.po_number ?? <span className="text-gray-300">—</span>}</td>
                  <td className="px-4 py-2.5"><Tag>{o.terms ?? 'Net 30'}</Tag></td>
                  <td className="px-4 py-2.5 font-mono text-xs">${(o.subtotal ?? 0).toFixed(2)}</td>
                  <td className="px-4 py-2.5">
                    <Button size="sm" variant="secondary">Push to QB</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-6">
        <Card>
          <CardHeader title="QuickBooks Sync Queue" subtitle="Real-time outbound to QB Online" />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-2.5">Entity</th>
                  <th className="text-left px-4 py-2.5">Ref</th>
                  <th className="text-left px-4 py-2.5">Status</th>
                  <th className="text-left px-4 py-2.5">Queued</th>
                </tr>
              </thead>
              <tbody>
                {mockSyncQueue.map((q, i) => (
                  <tr key={i} className="border-t border-gray-100">
                    <td className="px-4 py-2.5"><Tag>{q.entity}</Tag></td>
                    <td className="px-4 py-2.5 text-xs">
                      <div>{q.ref}</div>
                      {q.error && <div className="text-[10px] text-helm-red mt-0.5">⚠ {q.error}</div>}
                    </td>
                    <td className="px-4 py-2.5">
                      <Tag color={q.status === 'failed' ? 'red' : q.status === 'syncing' ? 'blue' : 'yellow'}>{q.status}</Tag>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-500">{q.queued}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <CardHeader title="On Hold" subtitle="Orders blocked from invoicing pending accounting review" />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-2.5">Order</th>
                  <th className="text-left px-4 py-2.5">Customer</th>
                  <th className="text-left px-4 py-2.5">Reason</th>
                  <th className="text-left px-4 py-2.5">Value</th>
                </tr>
              </thead>
              <tbody>
                {onHold.map((o) => (
                  <tr key={o.id} className="border-t border-gray-100">
                    <td className="px-4 py-2.5 font-mono text-xs">
                      <Link href={`/orders/${o.id}`} className="text-navy-700 hover:underline">{o.order_number}</Link>
                    </td>
                    <td className="px-4 py-2.5 text-xs">{o.company_name}</td>
                    <td className="px-4 py-2.5"><Tag color="red">{o.hold_status}</Tag></td>
                    <td className="px-4 py-2.5 font-mono text-xs">${(o.subtotal ?? 0).toFixed(2)}</td>
                  </tr>
                ))}
                {onHold.length === 0 && (
                  <tr><td colSpan={4} className="px-4 py-6 text-center text-sm text-gray-500 italic">No holds.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader title="Recently Invoiced" />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
              <tr>
                <th className="text-left px-4 py-2.5">Order</th>
                <th className="text-left px-4 py-2.5">Customer</th>
                <th className="text-left px-4 py-2.5">Status</th>
                <th className="text-left px-4 py-2.5">Subtotal</th>
                <th className="text-left px-4 py-2.5">View</th>
              </tr>
            </thead>
            <tbody>
              {invoiced.map((o) => (
                <tr key={o.id} className="border-t border-gray-100">
                  <td className="px-4 py-2.5 font-mono text-xs">{o.order_number}</td>
                  <td className="px-4 py-2.5 text-xs">{o.company_name}</td>
                  <td className="px-4 py-2.5"><Tag color="green">Invoiced</Tag></td>
                  <td className="px-4 py-2.5 font-mono text-xs">${(o.subtotal ?? 0).toFixed(2)}</td>
                  <td className="px-4 py-2.5">
                    <Link href={`/invoices/${o.id}`} className="text-xs text-navy-700 font-semibold hover:underline">Invoice →</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: any; accent?: 'green' | 'yellow' | 'red' | 'blue' }) {
  const cls = accent === 'green' ? 'text-green-700'
    : accent === 'yellow' ? 'text-yellow-700'
    : accent === 'red' ? 'text-helm-red'
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
