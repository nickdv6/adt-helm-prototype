'use client';
import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardHeader, Tag, Button } from '@/components/ui';
import { FileText } from 'lucide-react';
import { TechSheetPreview } from './tech-sheet-preview';

type OwnerType = 'company' | 'adt';

const COUNTRIES = ['USA', 'Italy', 'Spain', 'India', 'China', 'Turkey', 'Portugal', 'Mexico', 'Vietnam', 'United Kingdom', 'France', 'Belgium', 'South Korea'];

// 1 oz/yd² ≈ 33.906 g/m²
const OZ_TO_GSM = 33.906;

export function CreateFabricForm({ customers }: { customers: { id: number; name: string }[] }) {
  // Identification
  const [name, setName] = useState('');
  const [abbreviation, setAbbreviation] = useState('');
  const [ownerType, setOwnerType] = useState<OwnerType>('adt');
  const [ownerId, setOwnerId] = useState<string>('');
  const [supplier, setSupplier] = useState('');

  // Construction
  const [width, setWidth] = useState('');
  const [printWidth, setPrintWidth] = useState('');
  const [country, setCountry] = useState('');
  const [perThouWeight, setPerThouWeight] = useState('');

  // Composition
  const [content1, setContent1] = useState('');
  const [pct1, setPct1] = useState('');
  const [content2, setContent2] = useState('');
  const [pct2, setPct2] = useState('');
  const [content3, setContent3] = useState('');
  const [pct3, setPct3] = useState('');

  // Performance
  const [wyzenbeek, setWyzenbeek] = useState('');
  const [martindale, setMartindale] = useState('');
  const [weightOz, setWeightOz] = useState('');
  const [weightGsm, setWeightGsm] = useState('');
  const [editingGsm, setEditingGsm] = useState(false);

  // Compliance
  const [nfpa701, setNfpa701] = useState(false);
  const [nfpa260, setNfpa260] = useState(false);
  const [ca117, setCa117] = useState(false);

  // Pricing
  const [salePrice, setSalePrice] = useState('');

  // Preview modal
  const [showPreview, setShowPreview] = useState(false);
  const [submitted, setSubmitted] = useState<null | { fabricCode: string; summary: string }>(null);

  // Auto-default Print Width to Width − 2 when Width changes and Print Width is blank
  useEffect(() => {
    if (width && !printWidth) {
      const w = Number(width);
      if (!isNaN(w) && w > 2) setPrintWidth(String(w - 2));
    }
  }, [width, printWidth]);

  // Auto-convert oz/yd² ↔ g/m²
  useEffect(() => {
    if (editingGsm) return;
    if (weightOz) {
      const n = Number(weightOz);
      if (!isNaN(n)) setWeightGsm((n * OZ_TO_GSM).toFixed(0));
    } else setWeightGsm('');
  }, [weightOz, editingGsm]);
  useEffect(() => {
    if (!editingGsm) return;
    if (weightGsm) {
      const n = Number(weightGsm);
      if (!isNaN(n)) setWeightOz((n / OZ_TO_GSM).toFixed(2));
    } else setWeightOz('');
  }, [weightGsm, editingGsm]);

  const customerName = customers.find((c) => String(c.id) === ownerId)?.name ?? '';

  // Validation
  const nameOk = name.trim().length > 0;
  const ownerOk = ownerType === 'adt' || !!ownerId;
  const widthOk = width.trim().length > 0 && Number(width) > 0;
  const content1Ok = content1.trim().length > 0 && pct1.trim().length > 0;
  const pctSum = [pct1, pct2, pct3].reduce((s, v) => s + (Number(v) || 0), 0);
  const pctSumOk = !pct1 || !pct2 || pctSum === 100; // tolerate single-content (skip sum check)
  const pctSumStrictOk = pctSum === 100 || (!pct2 && !pct3 && Number(pct1) === 100);
  const compositionWarn = pct1 && (pct2 || pct3) && pctSum !== 100;

  const allOk = nameOk && ownerOk && widthOk && content1Ok && pctSumStrictOk;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!allOk) return;
    const code = `FAB-${String(Math.floor(2000 + Math.random() * 999)).padStart(4, '0')}`;
    const ownerLabel = ownerType === 'adt' ? 'ADT-common (shared)' : customerName;
    const contentSummary = [
      content1 && pct1 ? `${pct1}% ${content1}` : '',
      content2 && pct2 ? `${pct2}% ${content2}` : '',
      content3 && pct3 ? `${pct3}% ${content3}` : '',
    ].filter(Boolean).join(' · ');
    setSubmitted({ fabricCode: code, summary: `${name} · ${ownerLabel} · ${width}" wide · ${contentSummary}` });
  }

  function reset() {
    setName(''); setAbbreviation(''); setOwnerType('adt'); setOwnerId(''); setSupplier('');
    setWidth(''); setPrintWidth(''); setCountry(''); setPerThouWeight('');
    setContent1(''); setPct1(''); setContent2(''); setPct2(''); setContent3(''); setPct3('');
    setWyzenbeek(''); setMartindale(''); setWeightOz(''); setWeightGsm(''); setEditingGsm(false);
    setNfpa701(false); setNfpa260(false); setCa117(false); setSalePrice('');
    setSubmitted(null);
  }

  const fabricSnapshot = useMemo(() => ({
    name, abbreviation, ownerType, ownerName: customerName, supplier,
    width, printWidth, country, perThouWeight,
    content1, pct1, content2, pct2, content3, pct3,
    wyzenbeek, martindale, weightOz, weightGsm,
    nfpa701, nfpa260, ca117, salePrice,
  }), [name, abbreviation, ownerType, customerName, supplier, width, printWidth, country, perThouWeight,
       content1, pct1, content2, pct2, content3, pct3, wyzenbeek, martindale, weightOz, weightGsm,
       nfpa701, nfpa260, ca117, salePrice]);

  if (submitted) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <header>
          <Link href="/fabrics" className="text-sm text-gray-500 hover:underline">← Fabrics</Link>
          <h1 className="text-2xl font-bold text-navy-900 mt-1">Fabric created</h1>
        </header>
        <Card>
          <div className="p-6 border-l-4 border-green-500 bg-green-50">
            <div className="text-lg font-bold text-green-900">✓ {submitted.fabricCode} — saved</div>
            <div className="text-sm text-green-800 mt-2">{submitted.summary}</div>
            <div className="text-xs text-green-700 mt-3 italic">
              Prototype mock — in production this writes to <code className="font-mono">fabrics</code> + extended <code className="font-mono">fabric_specs</code> sub-table and generates the Tech Sheet PDF on demand.
            </div>
          </div>
        </Card>
        <div className="flex gap-2">
          <Button onClick={reset}>Create another fabric</Button>
          <Link href="/fabrics" className="inline-flex items-center px-3.5 py-2 text-sm font-semibold text-navy-700 bg-white border border-gray-300 hover:bg-gray-50 rounded">
            Back to Fabrics
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <header className="flex items-start justify-between">
        <div>
          <Link href="/fabrics" className="text-sm text-gray-500 hover:underline">← Fabrics</Link>
          <h1 className="text-2xl font-bold text-navy-900 mt-1">Create Fabric</h1>
          <p className="text-sm text-gray-600 mt-0.5">All specs below populate the standardized Tech Sheet PDF that can be sent to customers.</p>
        </div>
        <Button type="button" variant="secondary" onClick={() => setShowPreview(true)} disabled={!nameOk}>
          <FileText className="w-3.5 h-3.5 mr-1" />Preview Tech Sheet
        </Button>
      </header>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Identification */}
        <Card>
          <CardHeader title="Identification" />
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Name *">
                <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Performance Velvet 300gsm"
                  className="text-sm border border-gray-300 rounded px-2 py-1.5 w-full" />
              </Field>
              <Field label="Abbreviation">
                <input type="text" value={abbreviation} onChange={(e) => setAbbreviation(e.target.value)}
                  placeholder="e.g. PV300"
                  className="text-sm border border-gray-300 rounded px-2 py-1.5 w-full font-mono" />
              </Field>
            </div>

            <div className="space-y-2">
              <label className="block text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-1">Owner Type *</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="radio" checked={ownerType === 'company'} onChange={() => setOwnerType('company')} />
                  Company-specific
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="radio" checked={ownerType === 'adt'} onChange={() => { setOwnerType('adt'); setOwnerId(''); }} />
                  ADT — common to all companies
                </label>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {ownerType === 'company' ? (
                <Field label="Owner *">
                  <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)}
                    className="text-sm border border-gray-300 rounded px-2 py-1.5 w-full">
                    <option value="">Select customer…</option>
                    {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </Field>
              ) : <div />}
              <Field label="Supplier">
                <input type="text" value={supplier} onChange={(e) => setSupplier(e.target.value)}
                  placeholder="e.g. Patzeria Mill — Italy"
                  className="text-sm border border-gray-300 rounded px-2 py-1.5 w-full" />
              </Field>
            </div>
          </div>
        </Card>

        {/* Construction */}
        <Card>
          <CardHeader title="Construction" />
          <div className="p-5 grid grid-cols-4 gap-4">
            <Field label="Width (in) *">
              <input type="number" min="0" step="0.1" value={width} onChange={(e) => setWidth(e.target.value)}
                placeholder="e.g. 56" className="text-sm border border-gray-300 rounded px-2 py-1.5 w-full font-mono" />
            </Field>
            <Field label="Print Width (in)">
              <input type="number" min="0" step="0.1" value={printWidth} onChange={(e) => setPrintWidth(e.target.value)}
                placeholder="auto: Width − 2" className="text-sm border border-gray-300 rounded px-2 py-1.5 w-full font-mono" />
            </Field>
            <Field label="Country of Origin">
              <select value={country} onChange={(e) => setCountry(e.target.value)}
                className="text-sm border border-gray-300 rounded px-2 py-1.5 w-full">
                <option value="">—</option>
                {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Per Thousand Weight (lbs)">
              <input type="number" min="0" step="0.1" value={perThouWeight} onChange={(e) => setPerThouWeight(e.target.value)}
                placeholder="lbs per 1000 yds" className="text-sm border border-gray-300 rounded px-2 py-1.5 w-full font-mono" />
            </Field>
          </div>
        </Card>

        {/* Composition */}
        <Card>
          <CardHeader title="Composition" subtitle="At least Content 1 is required. If using multiple, percentages must sum to 100." />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-2.5">#</th>
                  <th className="text-left px-4 py-2.5">Material</th>
                  <th className="text-left px-4 py-2.5 w-32">% *</th>
                </tr>
              </thead>
              <tbody>
                <ContentRow n={1} required content={content1} setContent={setContent1} pct={pct1} setPct={setPct1} />
                <ContentRow n={2} content={content2} setContent={setContent2} pct={pct2} setPct={setPct2} />
                <ContentRow n={3} content={content3} setContent={setContent3} pct={pct3} setPct={setPct3} />
              </tbody>
              <tfoot className="bg-gray-50 border-t border-gray-200">
                <tr>
                  <td colSpan={2} className="px-4 py-2 text-right text-xs uppercase tracking-wider text-gray-500 font-semibold">Sum</td>
                  <td className="px-4 py-2">
                    <span className={`font-mono text-sm font-bold ${compositionWarn ? 'text-helm-red' : pctSum === 100 ? 'text-green-700' : 'text-gray-500'}`}>
                      {pctSum}%
                    </span>
                    {compositionWarn && <span className="text-[10px] text-helm-red ml-2">must sum to 100%</span>}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>

        {/* Performance */}
        <Card>
          <CardHeader title="Performance" subtitle="Abrasion tests + weight. Weight fields auto-convert between oz/yd² and g/m²." />
          <div className="p-5 grid grid-cols-4 gap-4">
            <Field label="Wyzenbeek (double rubs)">
              <input type="number" min="0" step="1000" value={wyzenbeek} onChange={(e) => setWyzenbeek(e.target.value)}
                placeholder="e.g. 30000" className="text-sm border border-gray-300 rounded px-2 py-1.5 w-full font-mono" />
            </Field>
            <Field label="Martindale (cycles)">
              <input type="number" min="0" step="1000" value={martindale} onChange={(e) => setMartindale(e.target.value)}
                placeholder="e.g. 40000" className="text-sm border border-gray-300 rounded px-2 py-1.5 w-full font-mono" />
            </Field>
            <Field label="Weight (oz/yd²)">
              <input type="number" min="0" step="0.1" value={weightOz}
                onFocus={() => setEditingGsm(false)}
                onChange={(e) => setWeightOz(e.target.value)}
                placeholder="e.g. 8.8" className="text-sm border border-gray-300 rounded px-2 py-1.5 w-full font-mono" />
            </Field>
            <Field label="Weight (g/m²)">
              <input type="number" min="0" step="1" value={weightGsm}
                onFocus={() => setEditingGsm(true)}
                onChange={(e) => setWeightGsm(e.target.value)}
                placeholder="auto" className="text-sm border border-gray-300 rounded px-2 py-1.5 w-full font-mono" />
            </Field>
          </div>
        </Card>

        {/* Compliance */}
        <Card>
          <CardHeader title="Flammability Compliance" />
          <div className="p-5 grid grid-cols-3 gap-4">
            <Checkbox label="NFPA 701" value={nfpa701} onChange={setNfpa701}
              help="Interior fabrics (drapes, curtains, hangings)" />
            <Checkbox label="NFPA 260" value={nfpa260} onChange={setNfpa260}
              help="Upholstered furniture cigarette ignition" />
            <Checkbox label="CA 117" value={ca117} onChange={setCa117}
              help="California furniture flammability" />
          </div>
        </Card>

        {/* Pricing */}
        <Card>
          <CardHeader title="Pricing" />
          <div className="p-5 grid grid-cols-3 gap-4">
            <Field label="Sale Price ($/yd)">
              <input type="number" min="0" step="0.01" value={salePrice} onChange={(e) => setSalePrice(e.target.value)}
                placeholder="0.00" className="text-sm border border-gray-300 rounded px-2 py-1.5 w-full font-mono" />
            </Field>
          </div>
        </Card>

        {/* Submit */}
        <div className="flex items-center justify-between">
          <div className="text-xs text-gray-500">
            {allOk ? <Tag color="green">Ready to save</Tag>
              : !nameOk ? <span>Fabric name is required.</span>
              : !ownerOk ? <span>Select an owner for the company-specific fabric.</span>
              : !widthOk ? <span>Width is required.</span>
              : !content1Ok ? <span>Content 1 + percentage required.</span>
              : !pctSumStrictOk ? <span className="text-helm-red">Composition percentages must sum to 100%.</span>
              : null}
          </div>
          <div className="flex gap-2">
            <Link href="/fabrics" className="inline-flex items-center px-3.5 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded">
              Cancel
            </Link>
            <Button type="button" variant="secondary" onClick={() => setShowPreview(true)} disabled={!nameOk}>
              Preview Tech Sheet
            </Button>
            <Button type="submit" disabled={!allOk}>Save Fabric</Button>
          </div>
        </div>
      </form>

      {showPreview && (
        <TechSheetPreview fabric={fabricSnapshot} onClose={() => setShowPreview(false)} />
      )}
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

function ContentRow({ n, required, content, setContent, pct, setPct }: {
  n: number; required?: boolean; content: string; setContent: (v: string) => void; pct: string; setPct: (v: string) => void;
}) {
  return (
    <tr className="border-t border-gray-100">
      <td className="px-4 py-2 font-mono text-xs text-gray-500">{n}</td>
      <td className="px-4 py-2">
        <input type="text" value={content} onChange={(e) => setContent(e.target.value)}
          placeholder={n === 1 ? 'e.g. Cotton (required)' : 'e.g. Polyester (optional)'}
          className="text-sm border border-gray-300 rounded px-2 py-1.5 w-full" />
      </td>
      <td className="px-4 py-2">
        <div className="flex items-center gap-1">
          <input type="number" min="0" max="100" step="1" value={pct} onChange={(e) => setPct(e.target.value)}
            className="text-sm border border-gray-300 rounded px-2 py-1.5 w-20 font-mono text-right" />
          <span className="text-gray-400 text-sm">%</span>
        </div>
      </td>
    </tr>
  );
}

function Checkbox({ label, value, onChange, help }: { label: string; value: boolean; onChange: (v: boolean) => void; help?: string }) {
  return (
    <label className="flex items-start gap-2 text-sm cursor-pointer">
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} className="mt-0.5" />
      <div>
        <div className="font-semibold">{label}</div>
        {help && <div className="text-[10px] text-gray-500 leading-tight mt-0.5">{help}</div>}
      </div>
    </label>
  );
}
