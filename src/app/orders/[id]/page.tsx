import Link from 'next/link';
import { getDb } from '@/lib/db';
import { Card, CardHeader, StatusPill, Tag, Button } from '@/components/ui';
import { formatDate, relativeTime } from '@/lib/utils';
import { notFound } from 'next/navigation';

// S21 Order Detail
// Per S23-S32.48 (Megan A3): simplified top summary — Customer + Order# + ADT Promised + single status badge + exception count
// Per S19-S22.4 revised: per-line subway maps below; worst-position-wins detail collapsed by default

export default function OrderDetail({ params }: { params: { id: string } }) {
  const db = getDb();
  const id = parseInt(params.id);
  const order = db.prepare(`
    SELECT o.*, c.name as company_name, c.is_third_party_billed, c.carrier_account_number, c.carrier_account_carrier
    FROM orders o JOIN companies c ON o.company_id = c.id WHERE o.id = ?
  `).get(id) as any;

  if (!order) notFound();

  const lines = db.prepare(`
    SELECT ol.*, s.adt_sku, s.product_type, d.plant_number, cw.name as colorway_name, f.name as fabric_name
    FROM order_lines ol
    JOIN skus s ON ol.sku_id = s.id
    LEFT JOIN designs d ON ol.design_id = d.id
    LEFT JOIN colorways cw ON ol.colorway_id = cw.id
    LEFT JOIN fabrics f ON ol.fabric_id = f.id
    WHERE ol.order_id = ?
  `).all(id) as any[];

  const prs = db.prepare(`
    SELECT pr.*, ol.id as line_id
    FROM print_requests pr
    JOIN order_lines ol ON pr.order_line_id = ol.id
    WHERE ol.order_id = ?
  `).all(id) as any[];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Simplified top summary per S23-S32.48 */}
      <header className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Link href="/orders" className="text-sm text-gray-500 hover:underline">← Orders</Link>
            <span className="text-gray-300">/</span>
            <h1 className="text-2xl font-bold text-navy-900 font-mono">{order.order_number}</h1>
            <StatusPill status={order.status} />
            {order.is_rush ? <Tag color="red">Rush</Tag> : null}
            {order.approval_required ? <Tag color="yellow">Megan Approval</Tag> : null}
          </div>
          <div className="text-sm text-gray-600">
            {order.company_name} · ADT Promised <strong>{formatDate(order.adt_promised_date)}</strong>
            {order.po_number ? <> · PO {order.po_number}</> : null}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary">Edit</Button>
          <Button variant="ghost">Put on Hold</Button>
        </div>
      </header>

      {/* Quick stats row */}
      <div className="grid grid-cols-3 gap-4">
        <Stat label="Roadmap" value={order.roadmap} />
        <Stat label="Lines" value={lines.length} />
        <Stat label="PRs" value={prs.length} />
      </div>

      {/* OD-3 approval gate detail if triggered */}
      {order.approval_required ? (
        <Card>
          <CardHeader title="Approval Gate (OD-3)" />
          <div className="px-5 py-4 grid grid-cols-2 gap-y-2 gap-x-6 text-sm">
            <div><strong className="text-gray-500 text-xs uppercase tracking-wider block">Trigger Reason</strong>{order.trigger_reason || '—'}</div>
            <div><strong className="text-gray-500 text-xs uppercase tracking-wider block">Trigger Source</strong>{order.trigger_source || '—'}</div>
            <div><strong className="text-gray-500 text-xs uppercase tracking-wider block">Approval Status</strong>
              {order.approval_completed_at ? `Approved ${relativeTime(order.approval_completed_at)}` : 'Pending Megan review'}
            </div>
            <div><strong className="text-gray-500 text-xs uppercase tracking-wider block">Approved By</strong>
              {order.approved_by_user_id ? 'Megan Burleson' : '—'}
            </div>
          </div>
        </Card>
      ) : null}

      {/* Order Lines + per-line PR breakdown */}
      <Card>
        <CardHeader title="Order Lines" subtitle="Per-line subway maps + child PRs" />
        <div className="divide-y divide-gray-200">
          {lines.map((line) => {
            const linePRs = prs.filter((p) => p.line_id === line.id);
            return (
              <div key={line.id} className="px-5 py-4">
                <div className="flex items-center gap-4 mb-3">
                  <div className="font-mono text-xs text-gray-500">{line.adt_sku}</div>
                  <div className="font-semibold">{line.product_type}</div>
                  <div className="text-sm text-gray-600">{line.fabric_name}</div>
                  {line.plant_number && <Tag color="blue">{line.plant_number}</Tag>}
                  {line.colorway_name && <Tag>{line.colorway_name}</Tag>}
                  <div className="ml-auto text-sm font-mono">
                    {line.quantity} {line.quantity_unit}
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <Tag color={line.strike_off_classification === 'Customer Strike-Off Required' ? 'yellow' : 'gray'}>
                    {line.strike_off_classification}
                  </Tag>
                  {line.is_click_and_print ? <Tag color="purple">Click-and-Print</Tag> : null}
                </div>
                {linePRs.length > 0 && (
                  <div className="mt-3 pl-4 border-l-2 border-gray-200 space-y-1.5">
                    {linePRs.map((pr) => (
                      <Link key={pr.id} href={`/print-requests/${pr.id}`}
                        className="flex items-center gap-2 text-xs hover:bg-gray-50 -mx-2 px-2 py-1 rounded">
                        <span className="font-mono font-semibold text-navy-700">{pr.pr_number}</span>
                        <StatusPill status={pr.status} />
                        {pr.is_click_and_print ? <Tag color="purple">C+P</Tag> : null}
                        {pr.was_csv_auto_routed ? <Tag color="blue">Auto-routed</Tag> : null}
                        {pr.internal_proof_status === 'pending' ? <Tag color="yellow">Proof pending</Tag> : null}
                        {pr.internal_proof_status === 'approved' ? <Tag color="green">Proof approved</Tag> : null}
                        {pr.printed_yardage ? <span className="text-gray-500">{pr.printed_yardage}/{pr.planned_yardage} yds</span> : null}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* 3rd-party billing visibility per S35-S36.35 */}
      {order.is_third_party_billed && order.carrier_account_number ? (
        <Card>
          <CardHeader title="3rd-Party Billing" />
          <div className="px-5 py-3 text-sm">
            Shipping billed to customer's <strong>{order.carrier_account_carrier}</strong> account
            <span className="font-mono ml-2">#{order.carrier_account_number}</span>.
            Carrier-account note carried on the shipping record (no ADT-billed freight line).
          </div>
        </Card>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: any }) {
  return (
    <Card>
      <div className="p-4">
        <div className="text-xs uppercase tracking-wider text-gray-500 mb-1">{label}</div>
        <div className="text-xl font-bold text-navy-900">{value}</div>
      </div>
    </Card>
  );
}
