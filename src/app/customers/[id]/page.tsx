import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDb } from '@/lib/db';
import { Card, CardHeader, Tag, StatusPill, Button } from '@/components/ui';
import { formatDate, formatPromised } from '@/lib/utils';

// /customers/[id] — Customer 360 with tabbed navigation
// Tabs: Overview (Open + Past Orders, packaging, materials, intake)
//       Customer Designs (designs assigned to this customer with colorways)
//       Contacts (full contact roster)

export default function CustomerDetail({ params, searchParams }: { params: { id: string }; searchParams: { tab?: string } }) {
  const db = getDb();
  const id = parseInt(params.id);
  const co = db.prepare('SELECT * FROM companies WHERE id = ?').get(id) as any;
  if (!co) notFound();

  const tab = searchParams?.tab ?? 'overview';

  const contacts = db.prepare('SELECT * FROM contacts WHERE company_id = ? ORDER BY is_primary DESC').all(id) as any[];
  const addresses = db.prepare('SELECT * FROM ship_to_addresses WHERE company_id = ? ORDER BY is_default DESC').all(id) as any[];
  const intake = db.prepare(`SELECT * FROM intake_configs WHERE company_id = ?`).get(id) as any;
  const profiles = db.prepare('SELECT id, name, product_type, packaging_type, is_default_for_combo FROM packaging_profiles WHERE company_id = ? ORDER BY product_type').all(id) as any[];

  // Open vs Past orders — Open = active operational work; Past = terminal lifecycle states
  const openOrders = db.prepare(`
    SELECT id, order_number, status, adt_promised_date, estimated_ship_date, is_rush
    FROM orders
    WHERE company_id = ?
      AND status NOT IN ('Closed','Shipped','Invoiced','Cancelled')
    ORDER BY COALESCE(date(adt_promised_date), date(estimated_ship_date)) ASC, created_at DESC
    LIMIT 25
  `).all(id) as any[];
  const pastOrders = db.prepare(`
    SELECT id, order_number, status, adt_promised_date, estimated_ship_date, is_rush
    FROM orders
    WHERE company_id = ?
      AND status IN ('Closed','Shipped','Invoiced','Cancelled')
    ORDER BY created_at DESC LIMIT 25
  `).all(id) as any[];

  const designs = db.prepare(`
    SELECT d.id, d.name, d.plant_number, d.status, d.created_at,
           (SELECT COUNT(*) FROM colorways cw WHERE cw.design_id = d.id) as colorway_count
    FROM designs d
    WHERE d.company_id = ?
    ORDER BY d.created_at DESC LIMIT 100
  `).all(id) as any[];

  const counts = {
    open: openOrders.length,
    past: pastOrders.length,
    designs: designs.length,
    contacts: contacts.length,
  };

  return (
    <div className="max-w-7xl mx-auto space-y-5 pb-12">
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

      {/* Tab navigation */}
      <div className="border-b border-gray-200 flex gap-1">
        <TabLink href={`/customers/${id}?tab=overview`} label="Overview" active={tab === 'overview'} count={counts.open + counts.past} />
        <TabLink href={`/customers/${id}?tab=designs`} label="Customer Designs" active={tab === 'designs'} count={counts.designs} />
        <TabLink href={`/customers/${id}?tab=contacts`} label="Contacts" active={tab === 'contacts'} count={counts.contacts} />
      </div>

      {tab === 'overview' && (
        <>
          {intake && (
            <Card>
              <CardHeader title="Auto-Intake Configured" subtitle={`${intake.intake_mode} (${intake.file_format.toUpperCase()})${intake.auto_route_enabled ? ' · auto-route ON' : ''}`} />
              <div className="px-5 py-3 text-sm">
                Source: <span className="font-mono text-xs">{intake.source_path}</span>
                {intake.auto_route_enabled ? <Tag color="blue">Auto-route to hot folder</Tag> : null}
              </div>
            </Card>
          )}

          <div className="grid grid-cols-3 gap-6">
            <div className="col-span-2 space-y-5">
              <Card>
                <CardHeader
                  title={`Open Orders (${counts.open})`}
                  subtitle="Active orders that still require work"
                />
                <OrderTable orders={openOrders} emptyText="No open orders." />
              </Card>

              <Card>
                <CardHeader
                  title={`Past Orders (${counts.past})`}
                  subtitle="Completed, shipped, invoiced, closed, or cancelled"
                />
                <OrderTable orders={pastOrders} emptyText="No past orders." dim />
              </Card>

              <Card>
                <CardHeader title="Packaging Profiles" subtitle="Customer × product type combos" />
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
            </div>

            <div className="space-y-5">
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
        </>
      )}

      {tab === 'designs' && (
        <Card>
          <CardHeader
            title={`Customer Designs (${counts.designs})`}
            subtitle="Designs assigned to this customer · click into a design to see colorways and files"
            action={
              <Link href={`/designs?customer=${id}`}>
                <Button size="sm">+ Add Design</Button>
              </Link>
            }
          />
          <table className="w-full text-sm">
            <thead className="text-xs text-gray-500 uppercase tracking-wider border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-2.5">Plant #</th>
                <th className="text-left px-4 py-2.5">Design Name</th>
                <th className="text-right px-4 py-2.5">Colorways</th>
                <th className="text-left px-4 py-2.5">Status</th>
                <th className="text-left px-4 py-2.5 pr-5">Created</th>
              </tr>
            </thead>
            <tbody>
              {designs.length === 0 && <tr><td colSpan={5} className="text-center py-10 text-gray-400">No designs on file for this customer yet.</td></tr>}
              {designs.map((d) => (
                <tr key={d.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-2.5 font-mono text-xs text-navy-700">{d.plant_number || '—'}</td>
                  <td className="px-4 py-2.5 font-semibold">{d.name}</td>
                  <td className="px-4 py-2.5 text-right font-mono">{d.colorway_count}</td>
                  <td className="px-4 py-2.5">{d.status ? <Tag color="gray">{d.status}</Tag> : <span className="text-gray-400">—</span>}</td>
                  <td className="px-4 py-2.5 text-xs pr-5">{formatDate(d.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 py-2 border-t border-gray-100 text-[11px] text-gray-500 italic">
            For full design management (file uploads, multi-colorway editing, batch operations), use the <Link href="/designs" className="text-navy-700 hover:underline font-semibold">Design Dashboard</Link>.
          </div>
        </Card>
      )}

      {tab === 'contacts' && (
        <Card>
          <CardHeader
            title={`Contacts (${counts.contacts})`}
            subtitle="All contacts for this customer · primary contact appears first"
            action={<Button size="sm">+ Add Contact</Button>}
          />
          <table className="w-full text-sm">
            <thead className="text-xs text-gray-500 uppercase tracking-wider border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-2.5">Name</th>
                <th className="text-left px-4 py-2.5">Title / Role</th>
                <th className="text-left px-4 py-2.5">Email</th>
                <th className="text-left px-4 py-2.5">Phone</th>
                <th className="text-left px-4 py-2.5 pr-5">Notes</th>
              </tr>
            </thead>
            <tbody>
              {contacts.length === 0 && <tr><td colSpan={5} className="text-center py-10 text-gray-400">No contacts on file.</td></tr>}
              {contacts.map((c) => (
                <tr key={c.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{c.first_name} {c.last_name}</span>
                      {c.is_primary ? <Tag color="blue">Primary</Tag> : null}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-xs">{c.job_title || <span className="text-gray-400">—</span>}</td>
                  <td className="px-4 py-2.5 text-xs">
                    {c.email ? <a href={`mailto:${c.email}`} className="text-navy-700 hover:underline">{c.email}</a> : <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-4 py-2.5 text-xs font-mono">{c.phone || <span className="text-gray-400">—</span>}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-500 pr-5">{c.notes || <span className="text-gray-400 italic">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

function OrderTable({ orders, emptyText, dim }: { orders: any[]; emptyText: string; dim?: boolean }) {
  return (
    <table className={`w-full text-sm ${dim ? 'opacity-75' : ''}`}>
      <thead className="text-xs text-gray-500 uppercase tracking-wider border-b border-gray-200">
        <tr>
          <th className="text-left px-4 py-2">Order #</th>
          <th className="text-left px-4 py-2">Status</th>
          <th className="text-left px-4 py-2 pr-5">Promised / Est. ship</th>
        </tr>
      </thead>
      <tbody>
        {orders.length === 0 && <tr><td colSpan={3} className="px-4 py-6 text-center text-gray-400">{emptyText}</td></tr>}
        {orders.map((o) => {
          const date = formatPromised(o.adt_promised_date || o.estimated_ship_date);
          return (
            <tr key={o.id} className="border-t border-gray-100 hover:bg-gray-50">
              <td className="px-4 py-2">
                <Link href={`/orders/${o.id}`} className="font-mono text-navy-700 hover:underline">{o.order_number}</Link>
                {o.is_rush ? <Tag color="red">Rush</Tag> : null}
              </td>
              <td className="px-4 py-2"><StatusPill status={o.status} /></td>
              <td className="px-4 py-2 text-xs pr-5">
                {date.label}
                {!o.adt_promised_date && <span className="text-[10px] text-gray-400 ml-1.5 uppercase tracking-wider">est.</span>}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function TabLink({ href, label, active, count }: { href: string; label: string; active: boolean; count: number }) {
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
