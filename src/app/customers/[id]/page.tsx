import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDb } from '@/lib/db';
import { Card, CardHeader, Tag, StatusPill, Button } from '@/components/ui';
import { formatDate, formatCurrency, relativeTime } from '@/lib/utils';

// /customers/[id] — Customer 360
// Surfaces: company info, contacts, ship-to addresses, recent orders, packaging profiles for this customer,
// customer materials (per_pr + open_bank per Megan C1), intake config if any.

export default function CustomerDetail({ params }: { params: { id: string } }) {
  const db = getDb();
  const id = parseInt(params.id);
  const co = db.prepare('SELECT * FROM companies WHERE id = ?').get(id) as any;
  if (!co) notFound();

  const contacts = db.prepare('SELECT * FROM contacts WHERE company_id = ? ORDER BY is_primary DESC').all(id) as any[];
  const addresses = db.prepare('SELECT * FROM ship_to_addresses WHERE company_id = ? ORDER BY is_default DESC').all(id) as any[];
  const orders = db.prepare(`
    SELECT id, order_number, status, adt_promised_date, subtotal, is_rush
    FROM orders WHERE company_id = ? ORDER BY created_at DESC LIMIT 15
  `).all(id) as any[];
  const profiles = db.prepare('SELECT id, name, product_type, packaging_type, is_default_for_combo FROM packaging_profiles WHERE company_id = ? ORDER BY product_type').all(id) as any[];
  const materials = db.prepare(`SELECT * FROM customer_materials WHERE company_id = ? LIMIT 10`).all(id) as any[];
  const intake = db.prepare(`SELECT * FROM intake_configs WHERE company_id = ?`).get(id) as any;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <header>
        <div className="flex items-center gap-3 mb-1">
          <Link href="/customers" className="text-sm text-gray-500 hover:underline">← Customers</Link>
          <span className="text-gray-300">/</span>
          <h1 className="text-2xl font-bold text-navy-900">{co.name}</h1>
          {co.is_credit_hold ? <Tag color="red">Credit Hold</Tag> : null}
          {co.is_third_party_billed ? <Tag color="yellow">3rd-Party Billed</Tag> : null}
          {co.is_blind_ship_default ? <Tag color="green">Blind Ship Default</Tag> : null}
        </div>
        <div className="text-sm text-gray-600">
          {co.industry || 'No industry'} · {co.payment_terms}
          {co.hubspot_owner_email ? <> · HubSpot owner {co.hubspot_owner_email}</> : null}
        </div>
      </header>

      {intake && (
        <Card>
          <CardHeader title="Auto-Intake Configured" subtitle={`Per S42b — ${intake.intake_mode} (${intake.file_format.toUpperCase()})${intake.auto_route_enabled ? ' · auto-route ON' : ''}`} />
          <div className="px-5 py-3 text-sm">
            Source: <span className="font-mono text-xs">{intake.source_path}</span>
            {intake.auto_route_enabled ? <Tag color="blue">Auto-route to hot folder (S23-S32.61)</Tag> : null}
          </div>
        </Card>
      )}

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          <Card>
            <CardHeader title="Recent Orders" />
            <table className="w-full text-sm">
              <thead className="text-xs text-gray-500 uppercase tracking-wider border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-2">Order #</th>
                  <th className="text-left px-4 py-2">Status</th>
                  <th className="text-left px-4 py-2">Promised</th>
                  <th className="text-right px-4 py-2 pr-5">Value</th>
                </tr>
              </thead>
              <tbody>
                {orders.length === 0 && <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-400">No orders.</td></tr>}
                {orders.map((o) => (
                  <tr key={o.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-2">
                      <Link href={`/orders/${o.id}`} className="font-mono text-navy-700 hover:underline">{o.order_number}</Link>
                      {o.is_rush ? <Tag color="red">Rush</Tag> : null}
                    </td>
                    <td className="px-4 py-2"><StatusPill status={o.status} /></td>
                    <td className="px-4 py-2 text-xs">{formatDate(o.adt_promised_date)}</td>
                    <td className="px-4 py-2 text-right font-mono pr-5">{formatCurrency(o.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <Card>
            <CardHeader title="Packaging Profiles (S40c)" subtitle="Customer × product type combos · OD-7 22-field profile" />
            <div className="divide-y divide-gray-100">
              {profiles.length === 0 && <div className="px-5 py-6 text-sm text-gray-400">No packaging profiles defined yet.</div>}
              {profiles.map((p) => (
                <div key={p.id} className="px-5 py-2.5 flex items-center gap-3 text-sm">
                  <div className="flex-1">
                    <div className="font-semibold">{p.name}</div>
                    <div className="text-xs text-gray-500 capitalize">{p.product_type} · {p.packaging_type}</div>
                  </div>
                  {p.is_default_for_combo ? <Tag color="blue">Default</Tag> : null}
                </div>
              ))}
            </div>
          </Card>

          {materials.length > 0 && (
            <Card>
              <CardHeader title="Customer Materials (per S23-S32.50 + Megan C1)" subtitle="Per-PR + open-bank inventory" />
              <table className="w-full text-sm">
                <thead className="text-xs text-gray-500 uppercase tracking-wider border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-2">Type</th>
                    <th className="text-left px-4 py-2">Fabric</th>
                    <th className="text-left px-4 py-2">Status</th>
                    <th className="text-right px-4 py-2 pr-5">On Hand</th>
                  </tr>
                </thead>
                <tbody>
                  {materials.map((m) => (
                    <tr key={m.id} className="border-t border-gray-100">
                      <td className="px-4 py-2"><Tag color={m.material_type === 'open_bank' ? 'green' : 'gray'}>{m.material_type}</Tag></td>
                      <td className="px-4 py-2 text-xs">{m.fabric_description}</td>
                      <td className="px-4 py-2"><StatusPill status={m.status} /></td>
                      <td className="px-4 py-2 text-right font-mono pr-5">{m.remaining_qty}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Contacts" action={<Button variant="ghost">+</Button>} />
            <div className="divide-y divide-gray-100">
              {contacts.map((c) => (
                <div key={c.id} className="px-5 py-2.5 text-sm">
                  <div className="font-semibold">{c.first_name} {c.last_name} {c.is_primary ? <Tag color="blue">Primary</Tag> : null}</div>
                  <div className="text-xs text-gray-500">{c.job_title}</div>
                  <div className="text-xs text-gray-600 truncate">{c.email}</div>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader title="Ship-to Addresses" action={<Button variant="ghost">+</Button>} />
            <div className="divide-y divide-gray-100">
              {addresses.map((a) => (
                <div key={a.id} className="px-5 py-2.5 text-sm">
                  <div className="font-semibold">{a.name} {a.is_default ? <Tag color="blue">Default</Tag> : null}</div>
                  <div className="text-xs text-gray-500">{a.street1}<br />{a.city}, {a.state} {a.postal_code}</div>
                </div>
              ))}
            </div>
          </Card>

          {co.is_third_party_billed && (
            <Card>
              <CardHeader title="3rd-Party Billing" />
              <div className="px-5 py-3 text-sm">
                {co.carrier_account_carrier} account <span className="font-mono">#{co.carrier_account_number}</span>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
