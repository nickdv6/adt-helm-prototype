'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Card, CardHeader, Tag, Button } from '@/components/ui';

type OwnerType = 'customer' | 'adt';
type Absorbency = 'pass' | 'fail' | '';
// Phase 1.15 — Receipt 5-outcome inspection per Ali clarification #35 (NICK-confirmed).
type InspectionOutcome = '' | 'accept' | 'accept_with_notes' | 'hold_for_review' | 'reject' | 'supervisor_review';

export function ReceiveForm({ customers }: { customers: { id: number; name: string }[] }) {
  // Owner + delivery
  const [ownerType, setOwnerType] = useState<OwnerType>('customer');
  const [customerId, setCustomerId] = useState<string>('');
  const [supplierName, setSupplierName] = useState('');
  const [millName, setMillName] = useState('');
  const [ghlLot, setGhlLot] = useState('');
  const [poReference, setPoReference] = useState('');
  const [yardage, setYardage] = useState('');
  const [rollCount, setRollCount] = useState('');
  const [conditionNotes, setConditionNotes] = useState('');
  const [sampleTaken, setSampleTaken] = useState(false);
  // Phase 1.15 — 5-outcome inspection per Ali #35 (NICK-confirmed)
  const [inspectionOutcome, setInspectionOutcome] = useState<InspectionOutcome>('');

  // Sample testing (optional at submit — can be filled later by whichever dept runs the test)
  const [labL, setLabL] = useState('');
  const [labA, setLabA] = useState('');
  const [labB, setLabB] = useState('');
  const [absorbency, setAbsorbency] = useState<Absorbency>('');

  const [submitted, setSubmitted] = useState<null | {
    receiptCode: string;
    summary: string;
    lab: { L: string; a: string; b: string } | null;
    absorbency: Absorbency;
  }>(null);

  // Validation — test fields NOT required (can be entered later)
  const ownerOk = ownerType === 'customer' ? !!customerId : !!supplierName.trim();
  const yardsOk = yardage.trim().length > 0 && Number(yardage) > 0;
  const rollsOk = rollCount.trim().length > 0 && Number(rollCount) > 0;
  const sampleOk = sampleTaken;
  const allOk = ownerOk && yardsOk && rollsOk && sampleOk;

  // White-point requires all three or none — if you start filling, you finish
  const labStarted = !!labL || !!labA || !!labB;
  const labComplete = !!labL && !!labA && !!labB;
  const labInvalid = labStarted && !labComplete;

  const canSubmit = allOk && !labInvalid;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    const code = `INB-${String(Math.floor(3000 + Math.random() * 999)).padStart(4, '0')}`;
    const customerName = customers.find((c) => String(c.id) === customerId)?.name ?? '';
    const owner = ownerType === 'customer' ? `Customer-supplied · ${customerName}` : `ADT-owned · ${supplierName}`;
    const summary = `${owner} · ${rollCount} rolls / ${yardage} yds${millName ? ` · ${millName}` : ''}${ghlLot ? ` · GHL LOT# ${ghlLot}` : ''}`;
    setSubmitted({
      receiptCode: code,
      summary,
      lab: labComplete ? { L: labL, a: labA, b: labB } : null,
      absorbency,
    });
  }

  function reset() {
    setOwnerType('customer');
    setCustomerId('');
    setSupplierName('');
    setMillName('');
    setGhlLot('');
    setPoReference('');
    setYardage('');
    setRollCount('');
    setConditionNotes('');
    setSampleTaken(false);
    setLabL(''); setLabA(''); setLabB('');
    setAbsorbency('');
    setSubmitted(null);
  }

  if (submitted) {
    const fullyTested = submitted.lab && submitted.absorbency;
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <header>
          <Link href="/receiving-home" className="text-sm text-gray-500 hover:underline">← Receiving Home</Link>
          <h1 className="text-2xl font-bold text-navy-900 mt-1">Receipt logged</h1>
        </header>
        <Card>
          <div className="p-6 border-l-4 border-green-500 bg-green-50">
            <div className="text-lg font-bold text-green-900">✓ {submitted.receiptCode} — saved</div>
            <div className="text-sm text-green-800 mt-2">{submitted.summary}</div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <ResultBlock title="White Point (L*a*b*)">
                {submitted.lab ? (
                  <div className="font-mono text-sm">
                    L* {submitted.lab.L} · a* {submitted.lab.a} · b* {submitted.lab.b}
                  </div>
                ) : (
                  <Tag color="yellow">Pending test</Tag>
                )}
              </ResultBlock>
              <ResultBlock title="Absorbency">
                {submitted.absorbency === 'pass' ? <Tag color="green">PASS</Tag>
                  : submitted.absorbency === 'fail' ? <Tag color="red">FAIL</Tag>
                  : <Tag color="yellow">Pending test</Tag>}
              </ResultBlock>
            </div>

            <div className="text-xs text-green-700 mt-4 italic">
              {fullyTested
                ? 'Sample fully tested at receipt — record is complete and routed for next-step processing.'
                : 'Sample swatch on hand. Test result fields can be filled in later by whichever department runs the test.'}
              {' '}
              Prototype mock — in production this writes a row to <code className="font-mono">material_receipts</code>{!fullyTested && ' and stays in the "Awaiting Test" queue until L*a*b* + absorbency are entered'}.
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
        <p className="text-sm text-gray-600 mt-0.5">Log a single inbound delivery. Test results can be entered now or filled in later once the sample is measured.</p>
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
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <Field label="Mill name (optional)">
                <input type="text" value={millName} onChange={(e) => setMillName(e.target.value)}
                  placeholder="e.g. Patzeria Mill — Italy" className="text-sm border border-gray-300 rounded px-2 py-1.5 w-full" />
              </Field>
              <Field label="GHL LOT# (optional)">
                <input type="text" value={ghlLot} onChange={(e) => setGhlLot(e.target.value)}
                  placeholder="e.g. GHL-25048-A" className="text-sm border border-gray-300 rounded px-2 py-1.5 w-full font-mono" />
              </Field>
              <Field label="PO reference (optional)">
                <input type="text" value={poReference} onChange={(e) => setPoReference(e.target.value)}
                  placeholder="PO-#### or cust-supply" className="text-sm border border-gray-300 rounded px-2 py-1.5 w-full font-mono" />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Total yardage *">
                <input type="number" min="0" step="0.1" value={yardage} onChange={(e) => setYardage(e.target.value)}
                  placeholder="e.g. 320.5" className="text-sm border border-gray-300 rounded px-2 py-1.5 w-full font-mono" />
              </Field>
              <Field label="Number of rolls *">
                <input type="number" min="0" step="1" value={rollCount} onChange={(e) => setRollCount(e.target.value)}
                  placeholder="e.g. 4" className="text-sm border border-gray-300 rounded px-2 py-1.5 w-full font-mono" />
              </Field>
            </div>
          </div>
        </Card>

        {/* Inspection */}
        <Card>
          <CardHeader title="Inspection" subtitle="5-outcome model per Ali clarification #35 — cost-bearing rules apply per fabric source" />
          <div className="p-5 space-y-4">
            <Field label="Inspection outcome *">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                {([
                  { value: 'accept',             label: 'Accept',              detail: 'Material clean. Allocate and move to inventory.' },
                  { value: 'accept_with_notes',  label: 'Accept with Notes',   detail: 'Usable but note condition (logged for analytics).' },
                  { value: 'hold_for_review',    label: 'Hold for Review',     detail: 'Park inbound; raise exception for Megan or supervisor.' },
                  { value: 'reject',             label: 'Reject',              detail: 'Return to supplier/mill. Cost-bearer captured.' },
                  { value: 'supervisor_review',  label: 'Supervisor Review',   detail: 'Escalation path — Nick/Megan decides disposition.' },
                ] as const).map((o) => {
                  const checked = inspectionOutcome === o.value;
                  return (
                    <label key={o.value}
                      className={`flex items-start gap-2 border rounded px-3 py-2 cursor-pointer hover:bg-gray-50 ${
                        checked ? 'border-navy-700 bg-navy-50/40' : 'border-gray-200'
                      }`}>
                      <input
                        type="radio"
                        name="inspection_outcome"
                        value={o.value}
                        checked={checked}
                        onChange={() => setInspectionOutcome(o.value)}
                        className="mt-0.5"
                      />
                      <div>
                        <div className="font-semibold">{o.label}</div>
                        <div className="text-xs text-gray-600">{o.detail}</div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </Field>
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
                  <div className="text-xs text-gray-600 mt-0.5">Confirm a swatch was cut from the end of one roll for white-point + absorbency testing.</div>
                </div>
              </label>
            </div>
          </div>
        </Card>

        {/* Sample Testing — optional now, can be filled in later */}
        <Card>
          <CardHeader title="Sample Testing"
            subtitle="Fill in now if you've already measured the swatch, or leave blank and a follow-up task stays in the Awaiting Test queue." />
          <div className="p-5 space-y-5">
            {/* White Point */}
            <div>
              <div className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-2">
                White Point — CIE L*a*b*
                {labInvalid && <span className="ml-2 text-helm-red normal-case tracking-normal">All three values required if any is entered</span>}
              </div>
              <div className="grid grid-cols-3 gap-3 max-w-md">
                <LabField label="L*" placeholder="0–100" value={labL} onChange={setLabL} />
                <LabField label="a*" placeholder="±128" value={labA} onChange={setLabA} />
                <LabField label="b*" placeholder="±128" value={labB} onChange={setLabB} />
              </div>
              <div className="text-[10px] text-gray-500 mt-1">L* = lightness · a* = green↔red · b* = blue↔yellow</div>
            </div>

            {/* Absorbency */}
            <div>
              <div className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-2">Absorbency</div>
              <div className="flex gap-3">
                <label className={`flex items-center gap-2 px-3 py-2 border rounded cursor-pointer text-sm ${absorbency === 'pass' ? 'border-green-500 bg-green-50 text-green-900' : 'border-gray-300 hover:bg-gray-50'}`}>
                  <input type="radio" name="absorbency" checked={absorbency === 'pass'} onChange={() => setAbsorbency('pass')} />
                  <span className="font-semibold">PASS</span>
                </label>
                <label className={`flex items-center gap-2 px-3 py-2 border rounded cursor-pointer text-sm ${absorbency === 'fail' ? 'border-red-500 bg-red-50 text-red-900' : 'border-gray-300 hover:bg-gray-50'}`}>
                  <input type="radio" name="absorbency" checked={absorbency === 'fail'} onChange={() => setAbsorbency('fail')} />
                  <span className="font-semibold">FAIL</span>
                </label>
                {absorbency !== '' && (
                  <button type="button" onClick={() => setAbsorbency('')}
                    className="text-xs text-gray-500 hover:underline px-2">
                    Clear
                  </button>
                )}
              </div>
            </div>
          </div>
        </Card>

        {/* Submit */}
        <div className="flex items-center justify-between">
          <div className="text-xs text-gray-500">
            {canSubmit ? (
              <Tag color="green">Ready to submit</Tag>
            ) : labInvalid ? (
              <span className="text-helm-red">Complete all three L*a*b* values or clear them.</span>
            ) : (
              <span>Required: owner, yardage, roll count, sample cut taken.</span>
            )}
          </div>
          <div className="flex gap-2">
            <Link href="/receiving-home" className="inline-flex items-center px-3.5 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded">
              Cancel
            </Link>
            <Button type="submit" disabled={!canSubmit}>Log receipt</Button>
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

function LabField({ label, placeholder, value, onChange }: { label: string; placeholder: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-xs font-bold text-navy-700 mb-1">{label}</label>
      <input
        type="number"
        step="0.01"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="text-sm border border-gray-300 rounded px-2 py-1.5 w-full font-mono text-center"
      />
    </div>
  );
}

function ResultBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-green-200 rounded p-3">
      <div className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-1">{title}</div>
      {children}
    </div>
  );
}
