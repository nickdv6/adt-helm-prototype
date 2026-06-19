import Link from 'next/link';
import { getDb } from '@/lib/db';
import { Card, CardHeader, StatusPill, Tag, Button } from '@/components/ui';
import { formatDate, formatPromised } from '@/lib/utils';
import { ShippingOrderRow } from '@/components/shipping-order-row';

// Pack & Ship — expandable orders with per-PR ship + partial-ship confirmation.
// Supports search by Order # / PO # / Customer / Roll #.
// Three shipment paths distinguished: Complete order / Partial / Individual PR.

export default function Shipping({ searchParams }: { searchParams: { tab?: string; q?: string } }) {
  const db = getDb();
  const tab = searchParams?.tab ?? 'ready';
  const q = (searchParams?.q ?? '').trim();

  // Build the Ready-to-Ship query with optional search across order #, PO #, customer name, OR roll #
  let readyWhere = "o.status = 'Ready to Ship'";
  const readyParams: any[] = [];
  if (q) {
    readyWhere += ` AND (o.order_number LIKE ? OR o.po_number LIKE ? OR c.name LIKE ?
                          OR EXISTS (SELECT 1 FROM print_requests pr2 JOIN order_lines ol2 ON pr2.order_line_id = ol2.id
                                     WHERE ol2.order_id = o.id AND pr2.roll_number LIKE ?))`;
    readyParams.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
  }
  const readyToShip = db.prepare(`
    SELECT o.id, o.order_number, o.po_number, c.name as company_name, o.adt_promised_date,
           o.is_rush, o.is_blind_ship, c.is_third_party_billed,
           c.carrier_account_carrier, c.carrier_account_number
    FROM orders o JOIN companies c ON o.company_id = c.id
    WHERE ${readyWhere}
    ORDER BY o.is_rush DESC, date(o.adt_promised_date) ASC LIMIT 30
  `).all(...readyParams) as any[];

  // Pull child PRs for the expandable section
  const orderIds = readyToShip.map((o) => o.id);
  const prsRaw = orderIds.length > 0
    ? db.prepare(`
        SELECT pr.id, pr.pr_number, pr.roll_number, pr.status, pr.planned_yardage, pr.printed_yardage,
               ol.order_id, d.name as design_name, cw.name as colorway_name
        FROM print_requests pr
        JOIN order_lines ol ON pr.order_line_id = ol.id
        LEFT JOIN designs d ON ol.design_id = d.id
        LEFT JOIN colorways cw ON ol.colorway_id = cw.id
        WHERE ol.order_id IN (${orderIds.map(() => '?').join(',')})
        ORDER BY pr.pr_number
      `).all(...orderIds) as any[]
    : [];
  const prsByOrder = new Map<number, any[]>();
  prsRaw.forEach((pr) => {
    if (!prsByOrder.has(pr.order_id)) prsByOrder.set(pr.order_id, []);
    prsByOrder.get(pr.order_id)!.push(pr);
  });

  const recentShipped = db.prepare(`
    SELECT o.id, o.order_number, c.name as company_name, o.adt_promised_date,
           c.is_third_party_billed, c.carrier_account_carrier, c.carrier_account_number
    FROM orders o JOIN companies c ON o.company_id = c.id
    WHERE o.status IN ('Shipped','Invoiced')
    ORDER BY o.id DESC LIMIT 20
  `).all() as any[];

  const counts = {
    ready: readyToShip.length,
    rush: readyToShip.filter((o) => o.is_rush).length,
    third_party: readyToShip.filter((o) => o.is_third_party_billed).length,
    blind: readyToShip.filter((o) => o.is_blind_ship).length,
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-navy-900">Pack & Ship — Lucio Hernandez</h1>
        <p className="text-sm text-gray-500 mt-1">S35 · Auto-rated at Ready-to-Ship · 3rd-party billing per S35-S36.35</p>
      </header>

      <div className="grid grid-cols-4 gap-4">
        <Stat label="Ready to Ship" value={counts.ready} accent="blue" />
        <Stat label="Rush in Queue" value={counts.rush} accent="red" />
        <Stat label="3rd-Party Billed" value={counts.third_party} accent="yellow" />
        <Stat label="Blind Ship" value={counts.blind} accent="green" />
      </div>

      <div className="border-b border-gray-200 flex gap-1">
        <TabLink href="/shipping?tab=ready" label="Ready to Ship" count={counts.ready} active={tab === 'ready'} />
        <TabLink href="/shipping?tab=shipped" label="Recently Shipped" count={recentShipped.length} active={tab === 'shipped'} />
        <TabLink href="/shipping?tab=returns" label="Returns (S35b)" count={3} active={tab === 'returns'} />
      </div>

      {tab === 'ready' && (
        <>
          {/* Search bar — Order #, PO #, customer company, or roll # */}
          <Card>
            <form className="p-4 flex items-end gap-3" action="/shipping">
              <input type="hidden" name="tab" value="ready" />
              <div className="flex-1">
                <label className="block text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-1">Search</label>
                <input
                  type="text"
                  name="q"
                  defaultValue={q}
                  placeholder="Order #, PO #, customer company, or roll #…"
                  className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
                />
              </div>
              <Button size="sm" type="submit">Search</Button>
              {q && <Link href="/shipping?tab=ready" className="px-3 py-1.5 text-xs text-gray-500 hover:text-navy-700 border border-gray-300 rounded">Clear</Link>}
            </form>
          </Card>

          <Card>
            <CardHeader
              title="Ready to Ship Queue"
              subtitle="Click chevron to expand and ship individual PRs · partial shipments prompt for confirmation"
            />
            <table className="w-full text-sm">
              <thead className="text-xs text-gray-500 uppercase tracking-wider border-b border-gray-200">
                <tr>
                  <th className="px-3 py-2.5 w-8"></th>
                  <th className="text-left px-3 py-2.5">Order #</th>
                  <th className="text-left px-3 py-2.5">Customer</th>
                  <th className="text-left px-3 py-2.5">Promised</th>
                  <th className="text-left px-3 py-2.5">Flags / PRs</th>
                  <th className="text-left px-3 py-2.5">Billing</th>
                  <th className="text-right px-3 py-2.5 pr-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {readyToShip.length === 0 && (
                  <tr><td colSpan={7} className="text-center py-10 text-gray-400">Queue is clear.</td></tr>
                )}
                {readyToShip.map((o) => {
                  const promised = formatPromised(o.adt_promised_date);
                  return (
                    <ShippingOrderRow
                      key={o.id}
                      order={{
                        id: o.id,
                        order_number: o.order_number,
                        company_name: o.company_name,
                        promised_label: promised.label,
                        is_rush: o.is_rush,
                        is_blind_ship: o.is_blind_ship,
                        is_third_party_billed: o.is_third_party_billed,
                        carrier_account_carrier: o.carrier_account_carrier,
                        carrier_account_number: o.carrier_account_number,
                      }}
                      prs={prsByOrder.get(o.id) || []}
                    />
                  );
                })}
              </tbody>
            </table>
            <div className="px-4 py-2 border-t border-gray-100 text-[11px] text-gray-500 italic">
              <strong>Three shipment paths:</strong> "Ship full order" ships everything · "Ship selected" with all PRs checked also ships everything (no prompt) · partial selections OR "Ship just this PR" on a multi-PR order trigger the confirmation prompt and log a partial shipment. Parent order stays open until remaining PRs ship.
            </div>
          </Card>
        </>
      )}

      {tab === 'shipped' && (
        <Card>
          <CardHeader title="Recently Shipped" subtitle="Last 20 shipments — tracking + customer notification status" />
          <table className="w-full text-sm">
            <thead className="text-xs text-gray-500 uppercase tracking-wider border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-2.5">Order #</th>
                <th className="text-left px-4 py-2.5">Customer</th>
                <th className="text-left px-4 py-2.5">Promised</th>
                <th className="text-left px-4 py-2.5 pr-5">Billing</th>
              </tr>
            </thead>
            <tbody>
              {recentShipped.map((o) => (
                <tr key={o.id} className="border-t border-gray-100">
                  <td className="px-4 py-2.5">
                    <Link href={`/orders/${o.id}`} className="font-mono text-navy-700 hover:underline">{o.order_number}</Link>
                  </td>
                  <td className="px-4 py-2.5">{o.company_name}</td>
                  <td className="px-4 py-2.5 text-xs">{formatDate(o.adt_promised_date)}</td>
                  <td className="px-4 py-2.5 text-xs pr-5">
                    {o.is_third_party_billed
                      ? <Tag color="yellow">3rd-Party</Tag>
                      : <span className="text-gray-500">ADT</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {tab === 'returns' && (
        <Card>
          <CardHeader title="Returns Dashboard (S35b)" subtitle="Per Megan B5 — split out from main shipping flow" />
          <div className="px-5 py-4 text-sm space-y-3">
            <div className="p-3 bg-amber-50 border border-amber-200 rounded text-amber-900">
              <strong className="block mb-1">Prototype data not seeded yet.</strong>
              Returns workflow surfaces: incoming RMA, reason code, original order link, refund/replacement decision, restock action, accounting credit memo trigger. Wave 2 build.
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Status counts">
                Awaiting Inspection: <strong>0</strong><br />
                Inspected · Awaiting Decision: <strong>0</strong><br />
                Refund Issued: <strong>0</strong><br />
                Replacement Re-Routed: <strong>0</strong><br />
              </Field>
              <Field label="Reason mix (last 90d)">
                Quality issue: <strong>0</strong><br />
                Wrong item shipped: <strong>0</strong><br />
                Customer-requested cancel: <strong>0</strong><br />
                Damaged in transit: <strong>0</strong><br />
              </Field>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

function TabLink({ href, label, count, active }: { href: string; label: string; count: number; active: boolean }) {
  const cls = active
    ? 'border-navy-700 text-navy-900'
    : 'border-transparent text-gray-500 hover:text-navy-700 hover:border-gray-300';
  return (
    <Link href={href} className={`px-4 py-2.5 border-b-2 text-sm font-semibold flex items-center gap-2 ${cls}`}>
      {label}
      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${active ? 'bg-navy-100 text-navy-700' : 'bg-gray-100 text-gray-600'}`}>{count}</span>
    </Link>
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-1">{label}</div>
      <div className="text-sm">{children}</div>
    </div>
  );
}
