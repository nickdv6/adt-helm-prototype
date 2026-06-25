import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDb } from '@/lib/db';
import { Card, CardHeader, Tag, StatusPill, Button } from '@/components/ui';
import { formatDate, formatPromised } from '@/lib/utils';
import { Plus, Download, Printer, Trash2, Pencil } from 'lucide-react';

// /customers/[id] — DASH-style customer detail
// Six focused tabs: Company Info / Contacts / Orders / Open PRs / Designs / Completed PRs
// Each list tab: result count, search, sort, per-page, Export to Excel, Add New where relevant.
// All operational entities for this customer are reachable via these tabs.

type SP = {
  tab?: string;
  q?: string; q2?: string;
  sort?: string; dir?: string;
  per?: string; page?: string;
};

const FINISHED_PR_STATUSES = ['Complete', 'Cancelled'];
const PER_PAGE_OPTIONS = [10, 25, 50, 100];

export default function CustomerDetail({ params, searchParams }: { params: { id: string }; searchParams: SP }) {
  const db = getDb();
  const id = parseInt(params.id);
  const co = db.prepare('SELECT * FROM companies WHERE id = ?').get(id) as any;
  if (!co) notFound();

  const tab = searchParams?.tab ?? 'info';
  const q = (searchParams?.q ?? '').trim();
  const q2 = (searchParams?.q2 ?? '').trim();
  const sort = searchParams?.sort ?? 'default';
  const dir = (searchParams?.dir ?? 'desc') === 'asc' ? 'asc' : 'desc';
  const per = Math.max(10, Math.min(100, parseInt(searchParams?.per ?? '25')));
  const page = Math.max(1, parseInt(searchParams?.page ?? '1'));
  const offset = (page - 1) * per;

  // Tab badge counts
  const counts = {
    contacts: (db.prepare('SELECT COUNT(*) as c FROM contacts WHERE company_id = ?').get(id) as any).c,
    orders_open: (db.prepare(`SELECT COUNT(*) as c FROM orders WHERE company_id = ? AND status NOT IN ('Closed','Shipped','Invoiced','Cancelled')`).get(id) as any).c,
    orders_past: (db.prepare(`SELECT COUNT(*) as c FROM orders WHERE company_id = ? AND status IN ('Closed','Shipped','Invoiced','Cancelled')`).get(id) as any).c,
    open_prs: (db.prepare(`SELECT COUNT(*) as c FROM print_requests pr JOIN order_lines ol ON pr.order_line_id = ol.id JOIN orders o ON ol.order_id = o.id WHERE o.company_id = ? AND pr.status NOT IN ('Complete','Cancelled')`).get(id) as any).c,
    designs: (db.prepare(`SELECT COUNT(*) as c FROM designs d LEFT JOIN colorways cw ON cw.design_id = d.id WHERE d.company_id = ?`).get(id) as any).c,
    completed_prs: (db.prepare(`SELECT COUNT(*) as c FROM print_requests pr JOIN order_lines ol ON pr.order_line_id = ol.id JOIN orders o ON ol.order_id = o.id WHERE o.company_id = ? AND (pr.status IN ('Complete','Cancelled') OR o.status IN ('Shipped','Invoiced','Closed'))`).get(id) as any).c,
  };
  const totalOrders = counts.orders_open + counts.orders_past;

  return (
    <div className="max-w-7xl mx-auto pb-12">
      <header className="mb-5">
        <Link href="/customers" className="text-sm text-gray-500 hover:underline">← Customers</Link>
        <div className="flex items-center gap-3 mt-1">
          <h1 className="text-2xl font-bold text-navy-900">{co.name}</h1>
          {co.is_credit_hold ? <Tag color="red">Credit Hold</Tag> : null}
          {co.is_third_party_billed ? <Tag color="yellow">3rd-Party Billed</Tag> : null}
          {co.is_blind_ship_default ? <Tag color="green">Blind Ship Default</Tag> : null}
        </div>
      </header>

      {/* Tab navigation */}
      <div className="border-b border-gray-200 flex flex-wrap gap-1 mb-4">
        <TabLink href={`/customers/${id}?tab=info`} label="Company Info" active={tab === 'info'} />
        <TabLink href={`/customers/${id}?tab=contacts`} label="Contacts" active={tab === 'contacts'} count={counts.contacts} />
        <TabLink href={`/customers/${id}?tab=orders`} label="Orders" active={tab === 'orders'} count={totalOrders} />
        <TabLink href={`/customers/${id}?tab=open_prs`} label="Open Print Requests" active={tab === 'open_prs'} count={counts.open_prs} accent="blue" />
        <TabLink href={`/customers/${id}?tab=designs`} label="Designs / Colorways" active={tab === 'designs'} count={counts.designs} />
        <TabLink href={`/customers/${id}?tab=completed_prs`} label="Completed Print Requests" active={tab === 'completed_prs'} count={counts.completed_prs} />
      </div>

      {tab === 'info' && <CompanyInfoTab co={co} />}
      {tab === 'contacts' && <ContactsTab customerId={id} q={q} sort={sort} dir={dir} per={per} page={page} offset={offset} totalCount={counts.contacts} />}
      {tab === 'orders' && <OrdersTab customerId={id} q={q} sort={sort} dir={dir} per={per} page={page} offset={offset} openCount={counts.orders_open} pastCount={counts.orders_past} />}
      {tab === 'open_prs' && <PrintRequestsTab customerId={id} which="open" q={q} q2={q2} sort={sort} dir={dir} per={per} page={page} offset={offset} totalCount={counts.open_prs} />}
      {tab === 'designs' && <DesignsTab customerId={id} q={q} q2={q2} sort={sort} dir={dir} per={per} page={page} offset={offset} totalCount={counts.designs} />}
      {tab === 'completed_prs' && <PrintRequestsTab customerId={id} which="completed" q={q} q2={q2} sort={sort} dir={dir} per={per} page={page} offset={offset} totalCount={counts.completed_prs} />}
    </div>
  );
}

// =====================================================================
// TAB 1 — Company Info (form view, mirrors DASH)
// =====================================================================

function CompanyInfoTab({ co }: { co: any }) {
  return (
    <Card>
      <div className="px-6 py-5 grid grid-cols-2 gap-x-12 gap-y-3 text-sm">
        <Field label="Company Name" value={co.name} bold />
        <Field label="Phone" value={co.phone || ''} />
        <Field label="Street Address" value={co.street1 || ''} />
        <Field label="Other Phone" value={co.phone_secondary || ''} />
        <Field label="Suite/Apt #" value={co.street2 || ''} />
        <Field label="Website" value={co.website || ''} />
        <Field label="City" value={co.city || ''} />
        <Field label="Term" value={co.payment_terms || ''} bold />
        <Field label="State" value={co.state || ''} />
        <Field label="FedEx Account #" value={co.is_third_party_billed && co.carrier_account_carrier === 'FedEx' ? co.carrier_account_number : ''} mono />
        <Field label="Postal Code" value={co.postal_code || ''} />
        <Field label="UPS Account #" value={co.is_third_party_billed && co.carrier_account_carrier === 'UPS' ? co.carrier_account_number : ''} mono />
        <Field label="Country" value={co.country || 'USA'} />
        <Field label="Bill To Contact" value="" />
        <div></div>
        <Field label="Ship To Contact" value="" />
      </div>
      <div className="px-6 py-3 border-t border-gray-100 flex justify-end">
        <Button size="sm"><Pencil className="w-3.5 h-3.5 mr-1" />Edit</Button>
      </div>
      <div className="border-t border-gray-200 px-6 py-5 bg-gray-50/50">
        <div className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-3">
          Customer Fulfillment Profile · flags + free-text rules
        </div>
        <div className="flex flex-wrap items-center gap-2 mb-4 text-xs">
          <span className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mr-1">Flags:</span>
          <Tag color={co.fold_and_ship ? 'blue' : 'gray'}>{co.fold_and_ship ? 'Fold & Ship' : 'Fold & Ship: off'}</Tag>
          <Tag color={co.fulfill_from_customer_inventory ? 'purple' : 'gray'}>{co.fulfill_from_customer_inventory ? 'Fulfill from Customer Inventory' : 'Fulfill from Customer Inventory: off'}</Tag>
          <Tag color={co.is_blind_ship_default ? 'green' : 'gray'}>{co.is_blind_ship_default ? 'Blind Ship Default' : 'Blind Ship: off'}</Tag>
          <Tag color={co.is_third_party_billed ? 'yellow' : 'gray'}>{co.is_third_party_billed ? `3rd-Party Billing (${co.carrier_account_carrier})` : '3rd-Party Billing: off'}</Tag>
        </div>
        <div className="grid grid-cols-2 gap-x-12 gap-y-3 text-sm">
          <div>
            <div className="text-xs font-semibold text-gray-700 mb-1">Substitution Notes</div>
            {co.substitution_notes
              ? <div className="text-sm text-gray-800 bg-white border border-gray-200 rounded px-3 py-2 italic">{co.substitution_notes}</div>
              : <div className="text-xs text-gray-400 italic">No substitution rules captured. Default: no substitutions without Megan approval.</div>}
          </div>
          <div>
            <div className="text-xs font-semibold text-gray-700 mb-1">Fulfillment Notes</div>
            {co.fulfillment_notes
              ? <div className="text-sm text-gray-800 bg-white border border-gray-200 rounded px-3 py-2 italic">{co.fulfillment_notes}</div>
              : <div className="text-xs text-gray-400 italic">No special fulfillment rules captured.</div>}
          </div>
        </div>
        <div className="text-[11px] text-gray-500 italic mt-3">
          Phase 1.15 minimum surface. Flags + free-text per Ali kickoff (#33). No rules engine — substitution decisions
          are too varied to encode. Full CFP entity (~14 fields per Ali spec) expands in Wave 2.
        </div>
      </div>
    </Card>
  );
}

function Field({ label, value, bold, mono }: { label: string; value: string; bold?: boolean; mono?: boolean }) {
  return (
    <div className="grid grid-cols-2 gap-3 items-baseline">
      <div className="text-xs text-gray-500 text-right">{label}</div>
      <div className={`${bold ? 'font-semibold' : ''} ${mono ? 'font-mono text-xs' : ''}`}>
        {value || <span className="text-gray-300">—</span>}
      </div>
    </div>
  );
}

// =====================================================================
// TAB 2 — Contacts
// =====================================================================

function ContactsTab({ customerId, q, sort, dir, per, page, offset, totalCount }: any) {
  const db = getDb();
  let where = 'company_id = ?';
  const params: any[] = [customerId];
  if (q) {
    where += ` AND (first_name LIKE ? OR last_name LIKE ? OR email LIKE ?)`;
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  const orderCol = sort === 'name' ? 'last_name' : sort === 'email' ? 'email' : 'id';
  const contacts = db.prepare(`
    SELECT * FROM contacts WHERE ${where}
    ORDER BY is_primary DESC, ${orderCol} ${dir} LIMIT ? OFFSET ?
  `).all(...params, per, offset) as any[];

  const filteredCount = q ? (db.prepare(`SELECT COUNT(*) as c FROM contacts WHERE ${where}`).get(...params) as any).c : totalCount;
  const totalPages = Math.max(1, Math.ceil(filteredCount / per));

  return (
    <>
      <ListToolbar
        baseUrl="contacts"
        countLabel={`${filteredCount.toLocaleString()} contact${filteredCount !== 1 ? 's' : ''}`}
        searchPlaceholder="Search by first or last name…"
        q={q}
        sortOptions={[
          { value: 'id', label: 'Contact #' },
          { value: 'name', label: 'Name' },
          { value: 'email', label: 'Email' },
        ]}
        sort={sort === 'default' ? 'id' : sort}
        dir={dir}
        per={per}
        page={page}
        totalPages={totalPages}
        addNewLabel="+ Add Contact"
      />
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-gray-500 uppercase tracking-wider border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="text-left px-3 py-2">Contact #</th>
                <th className="text-left px-3 py-2">First Name</th>
                <th className="text-left px-3 py-2">Last Name</th>
                <th className="text-left px-3 py-2">Job Title</th>
                <th className="text-left px-3 py-2">Email</th>
                <th className="text-left px-3 py-2">Phone</th>
                <th className="text-left px-3 py-2">City</th>
                <th className="text-left px-3 py-2">State</th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody>
              {contacts.length === 0 && (
                <tr><td colSpan={9} className="text-center py-10 text-gray-400">No contacts match the search.</td></tr>
              )}
              {contacts.map((c) => (
                <tr key={c.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-3 py-1.5 font-mono">{c.id}</td>
                  <td className="px-3 py-1.5">
                    {c.first_name}
                    {c.is_primary ? <Tag color="blue">Primary</Tag> : null}
                  </td>
                  <td className="px-3 py-1.5">{c.last_name || <span className="text-gray-300">—</span>}</td>
                  <td className="px-3 py-1.5">{c.job_title || <span className="text-gray-300">—</span>}</td>
                  <td className="px-3 py-1.5">
                    {c.email ? <a href={`mailto:${c.email}`} className="text-navy-700 hover:underline">{c.email}</a> : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-3 py-1.5 font-mono">{c.phone || <span className="text-gray-300">—</span>}</td>
                  <td className="px-3 py-1.5">{c.city || <span className="text-gray-300">—</span>}</td>
                  <td className="px-3 py-1.5">{c.state || <span className="text-gray-300">—</span>}</td>
                  <td className="px-3 py-1.5">
                    <button title="Delete" className="text-gray-300 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}

// =====================================================================
// TAB 3 — Orders (Open + Past, two sections)
// =====================================================================

function OrdersTab({ customerId, q, sort, dir, per, page, offset, openCount, pastCount }: any) {
  const db = getDb();
  const openOrders = db.prepare(`
    SELECT id, order_number, po_number, status, adt_promised_date, estimated_ship_date, is_rush, roadmap
    FROM orders
    WHERE company_id = ? AND status NOT IN ('Closed','Shipped','Invoiced','Cancelled')
    ${q ? "AND (order_number LIKE ? OR po_number LIKE ?)" : ""}
    ORDER BY COALESCE(date(adt_promised_date), date(estimated_ship_date)) ASC, created_at DESC
    LIMIT 50
  `).all(...(q ? [customerId, `%${q}%`, `%${q}%`] : [customerId])) as any[];
  const pastOrders = db.prepare(`
    SELECT id, order_number, po_number, status, adt_promised_date, estimated_ship_date, is_rush, roadmap
    FROM orders
    WHERE company_id = ? AND status IN ('Closed','Shipped','Invoiced','Cancelled')
    ${q ? "AND (order_number LIKE ? OR po_number LIKE ?)" : ""}
    ORDER BY created_at DESC LIMIT 50
  `).all(...(q ? [customerId, `%${q}%`, `%${q}%`] : [customerId])) as any[];

  return (
    <>
      <ListToolbar
        baseUrl="orders"
        countLabel={`${openCount} open · ${pastCount} past`}
        searchPlaceholder="Search by Order # or PO #…"
        q={q}
        sortOptions={[]}
        sort=""
        dir=""
        per={per}
        page={page}
        totalPages={1}
        hideSort
        hidePagination
      />
      <Card className="mb-4">
        <CardHeader title={`Open Orders (${openCount})`} subtitle="Active orders that still require work" />
        <OrderTable orders={openOrders} emptyText="No open orders." />
      </Card>
      <Card>
        <CardHeader title={`Past Orders (${pastCount})`} subtitle="Completed, shipped, invoiced, closed, or cancelled" />
        <OrderTable orders={pastOrders} emptyText="No past orders." dim />
      </Card>
    </>
  );
}

function OrderTable({ orders, emptyText, dim }: { orders: any[]; emptyText: string; dim?: boolean }) {
  return (
    <table className={`w-full text-sm ${dim ? 'opacity-75' : ''}`}>
      <thead className="text-xs text-gray-500 uppercase tracking-wider border-b border-gray-200 bg-gray-50">
        <tr>
          <th className="text-left px-3 py-2">Order #</th>
          <th className="text-left px-3 py-2">PO #</th>
          <th className="text-left px-3 py-2">Roadmap</th>
          <th className="text-left px-3 py-2">Status</th>
          <th className="text-left px-3 py-2 pr-5">Promised / Est. ship</th>
        </tr>
      </thead>
      <tbody>
        {orders.length === 0 && <tr><td colSpan={5} className="px-3 py-6 text-center text-gray-400">{emptyText}</td></tr>}
        {orders.map((o) => {
          const date = formatPromised(o.adt_promised_date || o.estimated_ship_date);
          return (
            <tr key={o.id} className="border-t border-gray-100 hover:bg-gray-50">
              <td className="px-3 py-1.5">
                <Link href={`/orders/${o.id}`} className="font-mono text-navy-700 hover:underline">{o.order_number}</Link>
                {o.is_rush ? <Tag color="red">Rush</Tag> : null}
              </td>
              <td className="px-3 py-1.5 font-mono text-xs text-gray-500">{o.po_number || '—'}</td>
              <td className="px-3 py-1.5 font-mono text-xs">{o.roadmap}</td>
              <td className="px-3 py-1.5"><StatusPill status={o.status} /></td>
              <td className="px-3 py-1.5 text-xs pr-5">
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

// =====================================================================
// TABS 4 + 6 — Open Print Requests / Completed Print Requests (shared component)
// =====================================================================

function PrintRequestsTab({ customerId, which, q, q2, sort, dir, per, page, offset, totalCount }: any) {
  const db = getDb();
  // Open = PR status not finished
  // Completed = PR status finished OR parent order shipped/closed/invoiced
  const statusFilter = which === 'completed'
    ? `(pr.status IN ('Complete','Cancelled') OR o.status IN ('Shipped','Invoiced','Closed'))`
    : `pr.status NOT IN ('Complete','Cancelled')`;
  let where = `o.company_id = ? AND ${statusFilter}`;
  const params: any[] = [customerId];
  if (q) {
    // q1 = Plant Number; q2 = PR Number — match DASH's two-search layout
    where += ` AND d.plant_number LIKE ?`;
    params.push(`%${q}%`);
  }
  if (q2) {
    where += ` AND pr.pr_number LIKE ?`;
    params.push(`%${q2}%`);
  }
  const orderCol = sort === 'plant' ? 'd.plant_number'
                 : sort === 'fabric' ? 'f.name'
                 : sort === 'colorist' ? 'u.full_name'
                 : sort === 'promised' ? "COALESCE(date(o.adt_promised_date), date(o.estimated_ship_date))"
                 : 'pr.pr_number';
  const prs = db.prepare(`
    SELECT pr.id, pr.pr_number, pr.status, pr.planned_yardage, pr.printed_yardage,
           pr.print_process, pr.internal_proof_status,
           ol.order_id, o.order_number, o.po_number, o.adt_promised_date, o.estimated_ship_date, o.is_rush,
           d.name as design_name, d.plant_number,
           cw.name as colorway_name,
           f.name as fabric_name,
           p.name as printer_name,
           u.full_name as colorist_name
    FROM print_requests pr
    JOIN order_lines ol ON pr.order_line_id = ol.id
    JOIN orders o ON ol.order_id = o.id
    LEFT JOIN designs d ON ol.design_id = d.id
    LEFT JOIN colorways cw ON ol.colorway_id = cw.id
    LEFT JOIN fabrics f ON pr.fabric_id = f.id
    LEFT JOIN printers p ON pr.printer_id = p.id
    LEFT JOIN users u ON pr.assigned_to_user_id = u.id
    WHERE ${where}
    ORDER BY ${orderCol} ${dir} LIMIT ? OFFSET ?
  `).all(...params, per, offset) as any[];

  const filteredCount = (q || q2)
    ? (db.prepare(`SELECT COUNT(*) as c FROM print_requests pr JOIN order_lines ol ON pr.order_line_id = ol.id JOIN orders o ON ol.order_id = o.id LEFT JOIN designs d ON ol.design_id = d.id WHERE ${where}`).get(...params) as any).c
    : totalCount;
  const totalPages = Math.max(1, Math.ceil(filteredCount / per));

  return (
    <>
      <ListToolbar
        baseUrl={which === 'open' ? 'open_prs' : 'completed_prs'}
        countLabel={`${filteredCount.toLocaleString()} ${which === 'open' ? 'open' : 'completed'} PR${filteredCount !== 1 ? 's' : ''}`}
        searchPlaceholder="Search by Plant Number…"
        secondarySearchPlaceholder="Search by PR Number…"
        q={q}
        q2={q2}
        sortOptions={[
          { value: 'pr', label: 'Print Request #' },
          { value: 'plant', label: 'Plant Number' },
          { value: 'fabric', label: 'Fabric' },
          { value: 'colorist', label: 'Colorist' },
          { value: 'promised', label: 'Promised / Est. ship' },
        ]}
        sort={sort === 'default' ? 'pr' : sort}
        dir={dir}
        per={per}
        page={page}
        totalPages={totalPages}
      />
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-gray-500 uppercase tracking-wider border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="text-left px-3 py-2">PR #</th>
                <th className="text-left px-3 py-2">Order #</th>
                <th className="text-left px-3 py-2">PO #</th>
                <th className="text-left px-3 py-2">Plant #</th>
                <th className="text-left px-3 py-2">Design / Colorway</th>
                <th className="text-left px-3 py-2">Fabric</th>
                <th className="text-right px-3 py-2">Qty</th>
                <th className="text-left px-3 py-2">Status</th>
                <th className="text-left px-3 py-2">Colorist</th>
                <th className="text-left px-3 py-2">Printer</th>
                <th className="text-left px-3 py-2">Promised / Est.</th>
                <th className="w-8"></th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody>
              {prs.length === 0 && (
                <tr><td colSpan={13} className="text-center py-10 text-gray-400">No print requests match the search.</td></tr>
              )}
              {prs.map((pr) => {
                const date = formatPromised(pr.adt_promised_date || pr.estimated_ship_date);
                return (
                  <tr key={pr.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-3 py-1.5">
                      <Link href={`/print-requests/${pr.id}`} className="font-mono text-navy-700 hover:underline font-semibold">{pr.pr_number}</Link>
                    </td>
                    <td className="px-3 py-1.5">
                      <Link href={`/orders/${pr.order_id}`} className="font-mono text-navy-700 hover:underline">{pr.order_number}</Link>
                    </td>
                    <td className="px-3 py-1.5 font-mono text-gray-500">{pr.po_number || <span className="text-gray-300">—</span>}</td>
                    <td className="px-3 py-1.5 font-mono">{pr.plant_number || <span className="text-gray-300">—</span>}</td>
                    <td className="px-3 py-1.5">
                      <div className="font-semibold">{pr.design_name || '—'}</div>
                      {pr.colorway_name && <div className="text-[10px] text-gray-500">{pr.colorway_name}</div>}
                    </td>
                    <td className="px-3 py-1.5">{pr.fabric_name || <span className="text-gray-300">—</span>}</td>
                    <td className="px-3 py-1.5 text-right font-mono">{pr.planned_yardage}</td>
                    <td className="px-3 py-1.5">
                      <StatusPill status={pr.status} />
                      {pr.is_rush ? <Tag color="red">Rush</Tag> : null}
                    </td>
                    <td className="px-3 py-1.5">{pr.colorist_name || <span className="text-gray-300">—</span>}</td>
                    <td className="px-3 py-1.5">{pr.printer_name || <span className="text-gray-300">—</span>}</td>
                    <td className="px-3 py-1.5 text-xs">
                      {date.label}
                      {!pr.adt_promised_date && <span className="text-[10px] text-gray-400 ml-1.5 uppercase tracking-wider">est.</span>}
                    </td>
                    <td className="px-3 py-1.5">
                      <button title="Reprint packing slip" className="text-yellow-600 hover:text-yellow-700"><Printer className="w-3.5 h-3.5" /></button>
                    </td>
                    <td className="px-3 py-1.5">
                      <button title="Delete" className="text-gray-300 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}

// =====================================================================
// TAB 5 — Designs / Colorways (one row per design+colorway)
// =====================================================================

function DesignsTab({ customerId, q, q2, sort, dir, per, page, offset, totalCount }: any) {
  const db = getDb();
  let where = 'd.company_id = ?';
  const params: any[] = [customerId];
  if (q) {
    where += ` AND d.plant_number LIKE ?`;
    params.push(`%${q}%`);
  }
  if (q2) {
    where += ` AND d.name LIKE ?`;
    params.push(`%${q2}%`);
  }
  const orderCol = sort === 'name' ? 'd.name'
                 : sort === 'colorway' ? 'cw.name'
                 : 'd.plant_number';
  const rows = db.prepare(`
    SELECT d.id as design_id, d.name as design_name, d.plant_number, d.lifecycle_status, d.created_at,
           cw.id as colorway_id, cw.name as colorway_name, cw.color_code,
           (SELECT s.adt_sku FROM skus s LIMIT 1) as sku_placeholder
    FROM designs d
    LEFT JOIN colorways cw ON cw.design_id = d.id
    WHERE ${where}
    ORDER BY ${orderCol} ${dir}, cw.name ASC
    LIMIT ? OFFSET ?
  `).all(...params, per, offset) as any[];

  const filteredCount = (q || q2)
    ? (db.prepare(`SELECT COUNT(*) as c FROM designs d LEFT JOIN colorways cw ON cw.design_id = d.id WHERE ${where}`).get(...params) as any).c
    : totalCount;
  const totalPages = Math.max(1, Math.ceil(filteredCount / per));

  return (
    <>
      <ListToolbar
        baseUrl="designs"
        countLabel={`${filteredCount.toLocaleString()} design+colorway entr${filteredCount !== 1 ? 'ies' : 'y'}`}
        searchPlaceholder="Search by Plant Number…"
        secondarySearchPlaceholder="Search by Design Name…"
        q={q}
        q2={q2}
        sortOptions={[
          { value: 'plant', label: 'Plant Number' },
          { value: 'name', label: 'Design Name' },
          { value: 'colorway', label: 'Colorway' },
        ]}
        sort={sort === 'default' ? 'plant' : sort}
        dir={dir}
        per={per}
        page={page}
        totalPages={totalPages}
        addNewLabel="+ Add Design / Colorway"
        addNewHref="/designs"
        extraButton={{ label: 'Company Design Report', icon: 'pdf' }}
      />
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-gray-500 uppercase tracking-wider border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="text-left px-3 py-2">Plant Number</th>
                <th className="text-left px-3 py-2">Design Name</th>
                <th className="text-left px-3 py-2">Colorway</th>
                <th className="text-left px-3 py-2">Color Code</th>
                <th className="text-left px-3 py-2">Status</th>
                <th className="text-left px-3 py-2">Created</th>
                <th className="w-8"></th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={8} className="text-center py-10 text-gray-400">No designs match the search.</td></tr>
              )}
              {rows.map((r, i) => (
                <tr key={`${r.design_id}-${r.colorway_id ?? 'no-cw'}-${i}`} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-3 py-1.5 font-mono text-navy-700">{r.plant_number}</td>
                  <td className="px-3 py-1.5 font-semibold">{r.design_name}</td>
                  <td className="px-3 py-1.5">{r.colorway_name || <span className="text-gray-300 italic">no colorway</span>}</td>
                  <td className="px-3 py-1.5 font-mono">{r.color_code || <span className="text-gray-300">—</span>}</td>
                  <td className="px-3 py-1.5">
                    <Tag color={r.lifecycle_status === 'Active' ? 'green' : r.lifecycle_status === 'Archived' ? 'gray' : 'yellow'}>
                      {r.lifecycle_status}
                    </Tag>
                  </td>
                  <td className="px-3 py-1.5">{formatDate(r.created_at)}</td>
                  <td className="px-3 py-1.5">
                    <button title="Reprint label" className="text-yellow-600 hover:text-yellow-700"><Printer className="w-3.5 h-3.5" /></button>
                  </td>
                  <td className="px-3 py-1.5">
                    <button title="Delete" className="text-gray-300 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}

// =====================================================================
// Shared ListToolbar — search/sort/page/export pattern across list tabs
// =====================================================================

function ListToolbar({
  baseUrl, countLabel, q, q2, sort, dir, per, page, totalPages,
  searchPlaceholder, secondarySearchPlaceholder,
  sortOptions, addNewLabel, addNewHref, extraButton, hideSort, hidePagination,
}: {
  baseUrl: string;
  countLabel: string;
  q?: string;
  q2?: string;
  sort?: string;
  dir?: string;
  per?: number;
  page?: number;
  totalPages?: number;
  searchPlaceholder: string;
  secondarySearchPlaceholder?: string;
  sortOptions: { value: string; label: string }[];
  addNewLabel?: string;
  addNewHref?: string;
  extraButton?: { label: string; icon?: string };
  hideSort?: boolean;
  hidePagination?: boolean;
}) {
  return (
    <div className="mb-3 space-y-2">
      {/* Top row: count + Add New + extra + Export */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="text-sm text-gray-700">
          <strong className="font-mono">{countLabel}</strong>
        </div>
        <div className="flex items-center gap-2">
          {addNewLabel && (
            addNewHref ? (
              <Link href={addNewHref}><Button size="sm"><Plus className="w-3.5 h-3.5 mr-1" />{addNewLabel.replace('+ ', '')}</Button></Link>
            ) : (
              <Button size="sm"><Plus className="w-3.5 h-3.5 mr-1" />{addNewLabel.replace('+ ', '')}</Button>
            )
          )}
          {extraButton && <Button variant="secondary" size="sm" className="bg-yellow-500 text-white border-yellow-500 hover:bg-yellow-600">{extraButton.label}</Button>}
          <Button variant="secondary" size="sm"><Download className="w-3.5 h-3.5 mr-1" />Export to Excel</Button>
        </div>
      </div>

      {/* Filter + search row */}
      <form className="bg-white border border-gray-200 rounded p-3 grid grid-cols-12 gap-3 items-end">
        <input type="hidden" name="tab" value={baseUrl} />
        {!hidePagination && !hideSort && (
          <>
            <div className="col-span-2">
              <label className="block text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-1">Results per page</label>
              <select name="per" defaultValue={per} className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm bg-white">
                {PER_PAGE_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-1">Sort by</label>
              <select name="sort" defaultValue={sort} className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm bg-white">
                {sortOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-1">Sort order</label>
              <select name="dir" defaultValue={dir} className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm bg-white">
                <option value="desc">Desc</option>
                <option value="asc">Asc</option>
              </select>
            </div>
          </>
        )}
        <div className={secondarySearchPlaceholder ? 'col-span-3' : 'col-span-5'}>
          <label className="block text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-1">Search</label>
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder={searchPlaceholder}
            className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
          />
        </div>
        {secondarySearchPlaceholder && (
          <div className="col-span-3">
            <label className="block text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-1">Search</label>
            <input
              type="text"
              name="q2"
              defaultValue={q2}
              placeholder={secondarySearchPlaceholder}
              className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
            />
          </div>
        )}
        <div className={`${hideSort ? 'col-span-7' : 'col-span-1'} flex gap-1.5`}>
          <Button size="sm" type="submit" className="w-full">Apply</Button>
        </div>
      </form>

      {/* Pagination */}
      {!hidePagination && totalPages && totalPages > 1 && (
        <div className="flex items-center justify-end gap-2 text-xs text-gray-600">
          <Button variant="secondary" size="sm" disabled={page === 1}>← Previous</Button>
          <span className="px-2">Page <strong>{page}</strong> of <strong>{totalPages.toLocaleString()}</strong></span>
          <Button variant="secondary" size="sm" disabled={page === totalPages}>Next →</Button>
        </div>
      )}
    </div>
  );
}

// =====================================================================
// Tab nav primitive
// =====================================================================

function TabLink({ href, label, active, count, accent }: { href: string; label: string; active: boolean; count?: number; accent?: 'blue' }) {
  const cls = active
    ? 'border-navy-700 text-navy-900'
    : 'border-transparent text-gray-500 hover:text-navy-700 hover:border-gray-300';
  const badgeCls = accent === 'blue' && count !== undefined && count > 0 && !active
    ? 'bg-helm-blue text-navy-700'
    : active ? 'bg-navy-100 text-navy-700' : 'bg-gray-100 text-gray-600';
  return (
    <Link href={href} className={`px-4 py-2.5 border-b-2 text-sm font-semibold flex items-center gap-2 ${cls}`}>
      {label}
      {count !== undefined && (
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${badgeCls}`}>{count.toLocaleString()}</span>
      )}
    </Link>
  );
}
