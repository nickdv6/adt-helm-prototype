'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Card, CardHeader, Tag, Button } from '@/components/ui';

type OwnerType = 'customer' | 'adt';
type RouteTo = 'studio' | 'finishing' | '';

export function ReceiveForm({ customers }: { customers: { id: number; name: string }[] }) {
  const [ownerType, setOwnerType] = useState<OwnerType>('customer');
  const [customerId, setCustomerId] = useState<string>('');
  const [supplierName, setSupplierName] = useState('');
  const [millName, setMillName] = useState('');
  const [yardage, setYardage] = useState('');
  const [rollCount, setRollCount] = useState('');
  const [conditionNotes, setConditionNotes] = useState('');
  const [sampleTaken, setSampleTaken] = useState(false);
  const [routeTo, setRouteTo] = useState<RouteTo>('');
  const [poReference, setPoReference] = useState('');
  const [submitted, setSubmitted] = useState<null | {
    receiptCode: string;
    routedTo: RouteTo;
    summary: string;
  }>(null);

  // Validation
  const ownerOk = ownerType === 'customer' ? !!customerId : !!supplierName.trim();
  const yardsOk = yardage.trim().length > 0 && Number(yardage) > 0;
  const rollsOk = rollCount.trim().length > 0 && Number(rollCount) > 0;
  const sampleOk = sampleTaken;
  const routeOk = routeTo !== '';
  const allOk = ownerOk && yardsOk && rollsOk && sampleOk && routeOk;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!allOk) return;
    // Mock: in production this POSTs to a server action that inserts into
    // material_receipts + creates a hand-off task for Studio or Finishing.
    const code = `INB-${String(Math.floor(3000 + Math.random() * 999)).padStart(4, '0')}`;
    const customerName = customers.find((c) => String(c.id) === customerId)?.name ?? '';
    const owner = ownerType === 'customer' ? `Customer-supplied · ${customerName}` : `ADT-owned · ${supplierName}`;
    const summary = `${owner} · ${rollCount} rolls / ${yardage} yds${millName ? ` · ${millName}` : ''}`;
    setSubmitted({ receiptCode: code, routedTo: routeTo, summary });
  }

  function reset() {
    setOwnerType('customer');
    setCustomerId('');
    setSupplierName('');
    setMillName('');
    setYardage('');
    setRollCount('');
    setConditionNotes('');
    setSampleTaken(false);
    setRouteTo('');
    setPoReference('');
    setSubmitted(null);
  }

  if (submitted) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <header>
          <Link href="/receiving-home" className="text-sm text-gray-500 hover:underline">← Receiving Home</Link>
          <h1 className="text-2xl font-bold text-navy-900 mt-1">Receipt logged</h1>
        </header>
        <Card>
          <div className="p-6 border-l-4 border-green-500 bg-green-50">
            <div className="text-lg font-bold text-green-900">✓ {submitted.receiptCode} — saved &amp; routed</div>
            <div className="text-sm text-green-800 mt-2">{submitted.summary}</div>
            <div className="text-sm text-green-800 mt-1">
              Sample cut taken · routed to <strong>{submitted.routedTo === 'studio' ? 'Studio (white-point measurement)' : 'Finishing (absorbency / pretreatment check)'}</strong>
            </div>
            <div className="text-xs text-green-700 mt-3 italic">
              Prototype mock — in production this writes a row to <code className="font-mono">material_receipts</code> and creates a hand-off task in the {submitted.routedTo === 'studio' ? 'Studio' : 'Finishing'} queue.
            </div>
          </div>
        </Card>
        <div className="flex gap-2">
          <Button onClick={reset}>Receive another</Button>
          <Link href="/receiving-home" className="inline-flex items-center px-3.5 py-2 text-sm font-semibold text-navy-700 bg-white border border-gray-300 hover:bg-gray-50 rounded">
            Back to Receiving Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <header>
        <Link href="/receiving-home" className="text-sm text-gray-500 hover:underline">← Receiving Home</Link>
        <h1 className="text-2xl font-bold text-navy-900 mt-1">Receive Fabric</h1>
        <p className="text-sm text-gray-600 mt-0.5">Log a single inbound delivery at the dock. Sample cut is required before routing to next step.</p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Fabric Owner */}
        <Card>
          <CardHeader title="Fabric Owner" subtitle="Who does this fabric belong to?" />
          <div className="p-5 space-y-3">
            <div className="flex gap-3">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="radio" name="owner-type" checked={ownerType === 'customer'} onChange={() => setOwnerType('customer')} />
                Customer-supplied
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="radio" name="owner-type" checked={ownerType === 'adt'} onChange={() => setOwnerType('adt')} />
                ADT-owned (purchased)
              </label>
            </div>

            {ownerType === 'customer' ? (
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-1">Customer *</label>
                <select
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  className="text-sm border border-gray-300 rounded px-2 py-1.5 w-full max-w-md"
                >
                  <option value="">Select customer…</option>
                  {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <div className="text-[10px] text-gray-500 mt-1">Will be logged to the customer&apos;s Open Bank.</div>
              </div>
            ) : (
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-1">Supplier name *</label>
                <input
                  type="text"
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  placeholder="e.g. MillCo Textiles"
                  className="text-sm border border-gray-300 rounded px-2 py-1.5 w-full max-w-md"
                />
              </div>
            )}
          </div>
        </Card>

        {/* Quantities */}
        <Card>
          <CardHeader title="Delivery details" />
          <div className="p-5 grid grid-cols-2 gap-4">
            <Field label="Mill name (optional)">
              <input type="text" value={millName} onChange={(e) => setMillName(e.target.value)}
                placeholder="e.g. Patzeria Mill — Italy" className="text-sm border border-gray-300 rounded px-2 py-1.5 w-full" />
            </Field>
            <Field label="PO reference (optional)">
              <input type="text" value={poReference} onChange={(e) => setPoReference(e.target.value)}
                placeholder="PO-#### or cust-supply" className="text-sm border border-gray-300 rounded px-2 py-1.5 w-full font-mono" />
            </Field>
            <Field label="Total yardage *">
              <input type="number" min="0" step="0.1" value={yardage} onChange={(e) => setYardage(e.target.value)}
                placeholder="e.g. 320.5" className="text-sm border border-gray-300 rounded px-2 py-1.5 w-full font-mono" />
            </Field>
            <Field label="Number of rolls *">
              <input type="number" min="0" step="1" value={rollCount} onChange={(e) => setRollCount(e.target.value)}
                placeholder="e.g. 4" className="text-sm border border-gray-300 rounded px-2 py-1.5 w-full font-mono" />
            </Field>
          </div>
        </Card>

        {/* Condition + sample */}
        <Card>
          <CardHeader title="Inspection" />
          <div className="p-5 space-y-4">
            <Field label="Condition notes (any damage, staining, packaging issues, missing tags)">
              <textarea
                rows={3}
                value={conditionNotes}
                onChange={(e) => setConditionNotes(e.target.value)}
                placeholder="e.g. 2 rolls have minor crease damage along edge; tube intact; tags present."
                className="text-sm border border-gray-300 rounded px-2 py-1.5 w-full"
              />
            </Field>

            <div className="border border-gray-200 rounded p-3 bg-gray-50">
              <label className="flex items-start gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={sampleTaken}
                  onChange={(e) => setSampleTaken(e.target.checked)}
                  className="mt-0.5"
                />
                <div>
                  <div className="font-semibold">Sample cut taken *</div>
                  <div className="text-xs text-gray-600 mt-0.5">Confirm a swatch was cut from the end of one roll for white-point measurement and absorbency testing.</div>
                </div>
              </label>
            </div>
          </div>
        </Card>

        {/* Route to */}
        <Card>
          <CardHeader title="Route sample to" subtitle="Where does the swatch go next?" />
          <div className="p-5 grid grid-cols-2 gap-3">
            <label className={`border rounded p-4 cursor-pointer transition-colors ${routeTo === 'studio' ? 'border-navy-700 bg-navy-50' : 'border-gray-200 hover:border-gray-400'}`}>
              <input type="radio" name="route-to" checked={routeTo === 'studio'} onChange={() => setRouteTo('studio')} className="mr-2" />
              <span className="font-semibold text-sm">Studio</span>
              <div className="text-xs text-gray-600 mt-1">White-point measurement, color base reference.</div>
            </label>
            <label className={`border rounded p-4 cursor-pointer transition-colors ${routeTo === 'finishing' ? 'border-navy-700 bg-navy-50' : 'border-gray-200 hover:border-gray-400'}`}>
              <input type="radio" name="route-to" checked={routeTo === 'finishing'} onChange={() => setRouteTo('finishing')} className="mr-2" />
              <span className="font-semibold text-sm">Finishing</span>
              <div className="text-xs text-gray-600 mt-1">Absorbency check, pretreatment requirement assessment.</div>
            </label>
          </div>
        </Card>

        {/* Submit */}
        <div className="flex items-center justify-between">
          <div className="text-xs text-gray-500">
            {allOk ? (
              <Tag color="green">Ready to submit</Tag>
            ) : (
              <span>Required: owner, yardage, roll count, sample cut, routing destination.</span>
            )}
          </div>
          <div className="flex gap-2">
            <Link href="/receiving-home" className="inline-flex items-center px-3.5 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded">
              Cancel
            </Link>
            <Button type="submit" disabled={!allOk}>Log receipt &amp; route sample</Button>
          </div>
        </div>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-1">{label}</label>
      {children}
    </div>
  );
}
