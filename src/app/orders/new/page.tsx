'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Copy, Trash2, Plus, Save } from 'lucide-react';
import { Button } from '@/components/ui';

// /orders/new — Create Order
// First-pass port of the ADT DASH Create Order page (per Nick: pleased with current shape; iterate UX later
// for large orders and bulk new-design intake). Structure mirrors DASH exactly: header + top fields,
// then dynamic Order Requests panel (Print Requests + Finished Product Requests), then Shipper /
// Bill Shipping To / Additional Services. Price field is preserved on PRs because Order Entry is
// where pricing is captured — operational dashboards still don't surface it (per prior pricing-strip).

// --- Mock data for select options (replaces live DB lookups for prototype) ---
const COMPANIES = [
  'St. Frank', 'Inside / Havenly', 'Laura Park Designs', 'House of MBR',
  'Lemieux Et Cie', 'Elliston House', 'Elizabeth Speert',
];
const CONTACTS = ['Anna Larsen', 'Brian Cho', 'Camille Reyes', 'Devon Patel', 'Emily Park'];
const ORDER_TYPES = ['Production', 'Sample', 'Reorder', 'Internal'];
const PR_STATUSES = ['New', 'Awaiting Artwork', 'Awaiting Approval', 'Ready for Scheduling', 'On Hold'];
const COLORISTS = ['Jeannine Rivera', 'Maya Chen'];
const FINISHING = ['Standard', 'Pigment', 'Outdoor Treated', 'Specialty'];
const LIGHTING = ['D65', 'D50', 'A (Incandescent)', 'F2 (Cool Fluorescent)'];
const COLOR_MATCH = ['Standard', 'Pantone Match', 'Customer Reference'];
const FABRICS = [
  'Cotton Sateen 110-thread', 'Cotton Sateen 90-thread', 'Linen Blend Natural',
  'Velvet Cotton', 'Heavy Twill', 'Performance Outdoor', 'Customer Supplied',
];
const DESIGNS = ['Marigold', 'Cypress', 'Indigo Waves', 'Sage Block', 'Coral Bloom', 'Other (add to customer)…'];
const UOM = ['Yards', 'Meters', 'Square Feet'];
const FP_TYPES = ['Curtain', 'Tablecloth', 'Tablerunner', 'Throw Pillow'];
const PILLOW_SIZES = ['12×20', '14×14', '14×24', '16×16', '18×18', '20×20', '22×22', '24×24'];
const ZIPPER_GUIDE = ['Hidden Bottom', 'Hidden Side', 'Exposed', 'None'];
const ZIPPER_LENGTH = ['12"', '14"', '16"', '18"', '20"', '22"'];
const INSERT_TYPE = ['Down', 'Down Alternative', 'Polyfill', 'Customer Supplied'];
const INSERT_SIZE = ['12×20', '14×14', '14×24', '16×16', '18×18', '20×20', '22×22', '24×24'];
const WELT_TYPE = ['None', 'Self-Welt', 'Contrast Welt', 'Piping'];
const BAR_TACK = ['Yes', 'No'];
const SHIPPING_TYPE = ['UPS Ground', 'UPS 2-Day', 'UPS Next Day', 'FedEx Ground', 'FedEx 2-Day', 'USPS Priority', 'Customer Pickup'];
const FP_STATUSES = ['New', 'Awaiting Artwork', 'Ready for Cut/Sew', 'On Hold'];

// --- Types ---
type PR = {
  kind: 'PR';
  id: string;
};
type FPR = {
  kind: 'FPR';
  id: string;
  product_type: string;
};
type Request = PR | FPR;

let nextId = 1;
const mkId = () => `req-${nextId++}`;

// --- Component ---
export default function CreateOrder() {
  const [requests, setRequests] = useState<Request[]>([]);
  const [billTo, setBillTo] = useState<'customer' | 'adt' | 'thirdparty'>('customer');

  const addPR = () => setRequests((r) => [...r, { kind: 'PR', id: mkId() }]);
  const addFPR = () => setRequests((r) => [...r, { kind: 'FPR', id: mkId(), product_type: '' }]);
  const removeRequest = (id: string) => setRequests((r) => r.filter((x) => x.id !== id));
  const copyRequest = (id: string) => {
    const idx = requests.findIndex((r) => r.id === id);
    if (idx < 0) return;
    const original = requests[idx];
    setRequests((r) => {
      const copy: Request = { ...original, id: mkId() } as Request;
      return [...r.slice(0, idx + 1), copy, ...r.slice(idx + 1)];
    });
  };
  const setFPRType = (id: string, product_type: string) =>
    setRequests((r) => r.map((x) => (x.id === id && x.kind === 'FPR' ? { ...x, product_type } : x)));

  return (
    <div className="max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-navy-900">Create Order</h1>
        <Button size="sm"><Save className="w-3.5 h-3.5 mr-1.5" /> Save</Button>
      </div>

      {/* Top order header fields — 4-col grid mirroring DASH */}
      <section className="grid grid-cols-4 gap-x-4 gap-y-3 mb-6 border-b border-gray-200 pb-6">
        <Field label="Company" required>
          <Select options={COMPANIES} />
        </Field>
        <Field label="Order #">
          <ReadOnlyValue value="New Order" />
        </Field>
        <Field label="PO #">
          <Text />
        </Field>
        <Field label="Order Date">
          <Text defaultValue="06/18/2026" />
        </Field>

        <Field label="Order Contact">
          <Select options={CONTACTS} />
        </Field>
        <Field label="Ship To Contact" trailing={<><AddBtn /><RefreshBtn /></>}>
          <Select options={CONTACTS} />
        </Field>
        <Field label="Estimated Ship Date">
          <Text defaultValue="06/18/2026" />
        </Field>
        <Field label="Promised Ship Date">
          <Text defaultValue="06/18/2026" />
        </Field>
      </section>

      {/* Order Requests — toolbar */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-navy-900">Order Requests</h2>
        <div className="flex gap-2">
          <button onClick={addFPR} className="px-3 py-1.5 text-xs font-semibold rounded bg-cyan-500 text-white hover:bg-cyan-600">
            Add Finished Product Request
          </button>
          <button onClick={addPR} className="px-3 py-1.5 text-xs font-semibold rounded bg-cyan-500 text-white hover:bg-cyan-600">
            Add Print Request
          </button>
        </div>
      </div>

      {/* Request panels — render in order added */}
      {requests.length === 0 && (
        <div className="border border-dashed border-gray-300 rounded p-8 text-center text-sm text-gray-500 mb-6">
          No requests yet. Use the buttons above to add a Print Request or Finished Product Request.
        </div>
      )}

      {requests.map((r) =>
        r.kind === 'PR' ? (
          <PrintRequestPanel key={r.id} onCopy={() => copyRequest(r.id)} onDelete={() => removeRequest(r.id)} />
        ) : (
          <FinishedProductPanel
            key={r.id}
            product_type={r.product_type}
            onTypeChange={(t) => setFPRType(r.id, t)}
            onCopy={() => copyRequest(r.id)}
            onDelete={() => removeRequest(r.id)}
          />
        )
      )}

      {/* Bottom 3-column section: Shipper / Billing / Additional Services */}
      <section className="grid grid-cols-3 gap-4 mt-8">
        {/* Shipper Notes */}
        <div className="border border-gray-300 rounded p-4">
          <h3 className="text-base font-bold mb-3">Shipper Notes</h3>
          <textarea
            rows={3}
            className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-sm mb-3"
          />
          <Field label="Shipping Type" required>
            <Select options={SHIPPING_TYPE} />
          </Field>
          <Field label="Order Discount %">
            <Text />
          </Field>
        </div>

        {/* Bill Shipping To */}
        <div className="border border-gray-300 rounded p-4">
          <h3 className="text-base font-bold mb-3">Bill Shipping To</h3>
          <div className="grid grid-cols-2 gap-x-4 text-sm">
            <div className="space-y-1.5">
              <label className="flex items-center gap-2">
                <input type="radio" checked={billTo === 'customer'} onChange={() => setBillTo('customer')} />
                Customer
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" checked={billTo === 'adt'} onChange={() => setBillTo('adt')} />
                ADT
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" checked={billTo === 'thirdparty'} onChange={() => setBillTo('thirdparty')} />
                3rd Party
              </label>
            </div>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-xs">
                <span className="w-20">FedEx Acct:</span>
                <input
                  type="text"
                  disabled={billTo !== 'thirdparty'}
                  className="flex-1 border border-gray-300 rounded px-2 py-1 text-xs disabled:bg-gray-100"
                />
              </label>
              <label className="flex items-center gap-2 text-xs">
                <span className="w-20">UPS Acct:</span>
                <input
                  type="text"
                  disabled={billTo !== 'thirdparty'}
                  className="flex-1 border border-gray-300 rounded px-2 py-1 text-xs disabled:bg-gray-100"
                />
              </label>
            </div>
          </div>
        </div>

        {/* Additional Services */}
        <div className="border border-gray-300 rounded p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-bold">Additional Services</h3>
            <button className="w-6 h-6 rounded bg-cyan-500 text-white flex items-center justify-center text-sm hover:bg-cyan-600">
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-500">
                <th className="text-left py-1 font-semibold">Additional Service</th>
                <th className="text-right py-1 font-semibold">Quantity</th>
              </tr>
            </thead>
            <tbody>
              <tr><td colSpan={2} className="py-4 text-center text-gray-400 italic">No services added.</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Note for Ali: which DASH features are preserved as-is vs which Helm changes underneath */}
      <div className="mt-10 px-4 py-3 bg-navy-50 border-l-4 border-navy-500 text-xs text-gray-700 rounded-r">
        <strong className="text-navy-900">Prototype note for vendor review.</strong> This page is a first-pass port of the existing ADT DASH "Create Order" screen. ADT is satisfied with the field set and overall structure; the UI/UX optimizations (bulk new-design intake, large-order entry ergonomics, draft autosave, customer-master inline-add) come in a later pass. Behind the scenes, Helm adds: always-ask validation discipline, OD-3 approval-gate evaluation on Submit, OD-9 strike-off classification per PR, optimistic concurrency, audit events on every field change, and routing through C9 (Design File Routing + Hot Folder + Strike-Off Initiation) downstream from this entry point.
      </div>
    </div>
  );
}

// =====================================================================
// Print Request panel (matches DASH "New PR" sub-card)
// =====================================================================
function PrintRequestPanel({ onCopy, onDelete }: { onCopy: () => void; onDelete: () => void }) {
  return (
    <div className="border border-gray-300 rounded mb-4 bg-white">
      <div className="bg-gray-100 px-4 py-2 border-b border-gray-300 flex items-center justify-between">
        <h3 className="font-bold text-sm">New PR</h3>
        <div className="flex gap-1">
          <button onClick={onCopy} title="Copy" className="w-7 h-7 rounded bg-cyan-500 text-white flex items-center justify-center hover:bg-cyan-600">
            <Copy className="w-3.5 h-3.5" />
          </button>
          <button onClick={onDelete} title="Delete" className="w-7 h-7 rounded bg-red-600 text-white flex items-center justify-center hover:bg-red-700">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <div className="p-4 grid grid-cols-4 gap-x-4 gap-y-3">
        <Field label="Order Type" required><Select options={ORDER_TYPES} /></Field>
        <Field label="Status" required><Select options={PR_STATUSES} /></Field>
        <Field label="Colorist" required><Select options={COLORISTS} /></Field>
        <Field label="Estimated Ship Date"><Text defaultValue="06/18/2026" /></Field>

        <Field label="Finishing" required><Select options={FINISHING} /></Field>
        <Field label="Lighting"><Select options={LIGHTING} /></Field>
        <Field label="Color Match" required><Select options={COLOR_MATCH} /></Field>
        <Field label="GHL #"><Text /></Field>

        <Field label="Fabric" required trailing={<AddBtn href="/fabrics/new" title="Add new fabric" />}>
          <Select options={FABRICS} />
        </Field>
        <Field label="Design/Colorway" required trailing={<AddBtn href="/designs/new" title="Add new design" />}>
          <Select options={DESIGNS} />
        </Field>
        <Field label="Quantity" required><Text /></Field>
        <Field label="Unit of Measure" required><Select options={UOM} /></Field>

        <Field label="Outdoor Print">
          <label className="flex items-center"><input type="checkbox" className="w-4 h-4" /></label>
        </Field>
        <Field label="Pigment">
          <label className="flex items-center"><input type="checkbox" className="w-4 h-4" /></label>
        </Field>
        <Field label="Printer Notes" className="col-span-1"><Text /></Field>
        <Field label="Price"><Text /></Field>

        <Field label="Inspection Notes" className="col-span-2">
          <textarea rows={2} className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-sm" />
        </Field>
        <Field label="Studio Notes" className="col-span-2">
          <textarea rows={2} className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-sm" />
        </Field>
      </div>
    </div>
  );
}

// =====================================================================
// Finished Product Request panel
// =====================================================================
function FinishedProductPanel({
  product_type, onTypeChange, onCopy, onDelete,
}: {
  product_type: string;
  onTypeChange: (t: string) => void;
  onCopy: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="border border-gray-300 rounded mb-4 bg-white">
      <div className="bg-gray-100 px-4 py-2 border-b border-gray-300 flex items-center justify-between">
        <h3 className="font-bold text-sm">New Finished Product Request</h3>
        <div className="flex gap-1">
          <button onClick={onCopy} title="Copy" className="w-7 h-7 rounded bg-cyan-500 text-white flex items-center justify-center hover:bg-cyan-600">
            <Copy className="w-3.5 h-3.5" />
          </button>
          <button onClick={onDelete} title="Delete" className="w-7 h-7 rounded bg-red-600 text-white flex items-center justify-center hover:bg-red-700">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <div className="p-4 grid grid-cols-4 gap-x-4 gap-y-3">
        <Field label="Product Type" required>
          <select
            value={product_type}
            onChange={(e) => onTypeChange(e.target.value)}
            className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-sm"
          >
            <option value=""></option>
            {FP_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="Status" required><Select options={FP_STATUSES} /></Field>

        {product_type === 'Throw Pillow' && (
          <>
            {/* spacer for cols 3+4 of first row */}
            <div className="col-span-2"></div>

            <Field label="Quantity" required><Text /></Field>
            <Field label="Pillow Size" required><Select options={PILLOW_SIZES} /></Field>
            <Field label="Face Fabric" required><Select options={FABRICS} /></Field>
            <Field label="Back Fabric" required><Select options={FABRICS} /></Field>

            <Field label="Zipper Guideline" required><Select options={ZIPPER_GUIDE} /></Field>
            <Field label="Zipper Length" required><Select options={ZIPPER_LENGTH} /></Field>
            <div>
              <Field label="Insert Type" required><Select options={INSERT_TYPE} /></Field>
              <div className="mt-2">
                <Field label="Insert Size"><Select options={INSERT_SIZE} /></Field>
              </div>
            </div>
            <div></div>

            <Field label="Welt Type" required><Select options={WELT_TYPE} /></Field>
            <Field label="Bar Tack" required><Select options={BAR_TACK} /></Field>
            <Field label="Cut/Sew Notes" className="col-span-2">
              <textarea rows={2} className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-sm" />
            </Field>
          </>
        )}
      </div>
    </div>
  );
}

// =====================================================================
// Small reusable form bits
// =====================================================================
function Field({
  label, required, hint, trailing, className, children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  trailing?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <label className="block text-xs text-gray-700 mb-1">
        {label}{required && <span className="text-red-600 ml-0.5">*</span>}{hint && <span className="ml-1 text-gray-400">{hint}</span>}
      </label>
      <div className="flex gap-1 items-stretch">
        <div className="flex-1">{children}</div>
        {trailing}
      </div>
    </div>
  );
}

function Select({ options }: { options: string[] }) {
  return (
    <select className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-sm bg-white">
      <option value="">Select…</option>
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

function Text({ defaultValue }: { defaultValue?: string }) {
  return (
    <input
      type="text"
      defaultValue={defaultValue}
      className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-sm"
    />
  );
}

function ReadOnlyValue({ value }: { value: string }) {
  return (
    <div className="px-2.5 py-1.5 text-sm font-semibold">{value}</div>
  );
}

function AddBtn({ href, title = 'Add new (inline)' }: { href?: string; title?: string }) {
  const cls = "px-2 py-1 rounded bg-green-500 text-white text-xs hover:bg-green-600 flex items-center";
  if (href) {
    return (
      <Link href={href} title={title} className={cls} target="_blank" rel="noreferrer">
        <Plus className="w-3.5 h-3.5" />
      </Link>
    );
  }
  return (
    <button type="button" title={title} className={cls}>
      <Plus className="w-3.5 h-3.5" />
    </button>
  );
}

function RefreshBtn() {
  return (
    <button
      type="button"
      title="Refresh contacts"
      className="px-2 py-1 rounded bg-gray-900 text-white text-xs hover:bg-gray-700 flex items-center"
    >
      ↻
    </button>
  );
}
