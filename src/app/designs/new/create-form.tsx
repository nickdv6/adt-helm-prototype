'use client';
import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Card, CardHeader, Tag, Button } from '@/components/ui';
import { Trash2, Upload, Plus } from 'lucide-react';

type Colorway = {
  id: number;            // local ID for React key
  name: string;
  file: File | null;     // customer-supplied artwork
  fileNotes: string;
  sku: string;
};

let cwCounter = 1;
const newCw = (): Colorway => ({ id: cwCounter++, name: '', file: null, fileNotes: '', sku: '' });

export function CreateDesignForm({ customers, nextPlant }: { customers: { id: number; name: string }[]; nextPlant: string }) {
  // Design-level
  const [customerId, setCustomerId] = useState<string>('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [designName, setDesignName] = useState('');
  const [description, setDescription] = useState('');
  const [repeatH, setRepeatH] = useState('');
  const [repeatV, setRepeatV] = useState('');

  // Colorways — start with 2 empty rows like DASH
  const [colorways, setColorways] = useState<Colorway[]>([newCw(), newCw()]);

  const [submitted, setSubmitted] = useState<null | {
    plantNumber: string;
    designName: string;
    customerName: string;
    colorwayCount: number;
    filesUploaded: number;
  }>(null);

  // Filter customer dropdown via search box
  const filteredCustomers = useMemo(() => {
    const q = customerSearch.trim().toLowerCase();
    if (!q) return customers.slice(0, 50);
    return customers.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 50);
  }, [customerSearch, customers]);

  const customerName = customers.find((c) => String(c.id) === customerId)?.name ?? '';

  // Validation
  const ownerOk = !!customerId;
  const nameOk = designName.trim().length > 0;
  // Each non-empty colorway row must have a name; empty rows are ignored.
  const validColorways = colorways.filter((c) => c.name.trim() || c.file || c.fileNotes.trim() || c.sku.trim());
  const colorwayRowsHaveName = validColorways.every((c) => c.name.trim().length > 0);
  const atLeastOneColorway = validColorways.length > 0 && validColorways.some((c) => c.name.trim().length > 0);
  const allOk = ownerOk && nameOk && colorwayRowsHaveName && atLeastOneColorway;

  function updateCw(id: number, patch: Partial<Colorway>) {
    setColorways((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }
  function addCw() {
    setColorways((prev) => [...prev, newCw()]);
  }
  function removeCw(id: number) {
    setColorways((prev) => prev.length === 1 ? prev : prev.filter((c) => c.id !== id));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!allOk) return;
    const filled = validColorways.filter((c) => c.name.trim().length > 0);
    setSubmitted({
      plantNumber: nextPlant,
      designName: designName.trim(),
      customerName,
      colorwayCount: filled.length,
      filesUploaded: filled.filter((c) => !!c.file).length,
    });
  }

  function reset() {
    setCustomerId('');
    setCustomerSearch('');
    setDesignName('');
    setDescription('');
    setRepeatH('');
    setRepeatV('');
    setColorways([newCw(), newCw()]);
    setSubmitted(null);
  }

  if (submitted) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <header>
          <Link href="/designs" className="text-sm text-gray-500 hover:underline">← Design Dashboard</Link>
          <h1 className="text-2xl font-bold text-navy-900 mt-1">Design created</h1>
        </header>
        <Card>
          <div className="p-6 border-l-4 border-green-500 bg-green-50">
            <div className="text-lg font-bold text-green-900">✓ {submitted.plantNumber} — &quot;{submitted.designName}&quot;</div>
            <div className="text-sm text-green-800 mt-2 space-y-1">
              <div>Owner: <strong>{submitted.customerName}</strong></div>
              <div>{submitted.colorwayCount} colorway{submitted.colorwayCount === 1 ? '' : 's'} created</div>
              <div>{submitted.filesUploaded} customer file{submitted.filesUploaded === 1 ? '' : 's'} uploaded</div>
            </div>
            <div className="text-xs text-green-700 mt-3 italic">
              Prototype mock — in production this writes rows to <code className="font-mono">designs</code>, <code className="font-mono">colorways</code>, and <code className="font-mono">artwork_files</code> in a single transaction, then queues files for the NAS at <code className="font-mono">\\nas\artwork\{submitted.plantNumber}\…</code>.
            </div>
          </div>
        </Card>
        <div className="flex gap-2">
          <Button onClick={reset}>Create another design</Button>
          <Link href="/designs" className="inline-flex items-center px-3.5 py-2 text-sm font-semibold text-navy-700 bg-white border border-gray-300 hover:bg-gray-50 rounded">
            Back to Design Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <header className="flex items-start justify-between">
        <div>
          <Link href="/designs" className="text-sm text-gray-500 hover:underline">← Design Dashboard</Link>
          <h1 className="text-2xl font-bold text-navy-900 mt-1">Create Design</h1>
          <p className="text-sm text-gray-600 mt-0.5">
            Adds one design with one or more colorways. PLANT# is auto-assigned. For bulk uploads,
            use <Link href="/designs/import" className="text-navy-700 underline">Bulk Import CSV</Link> instead.
          </p>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">Next PLANT#</div>
          <div className="font-mono text-xl font-bold text-navy-700">{nextPlant}</div>
          <div className="text-[10px] text-gray-400">Auto-assigned on save</div>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Design-level */}
        <Card>
          <CardHeader title="Design Information" />
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Owner *">
                {customerId ? (
                  <div className="flex items-center gap-2 text-sm border border-gray-300 rounded px-2 py-1.5 bg-gray-50">
                    <span className="font-semibold">{customerName}</span>
                    <button type="button" onClick={() => { setCustomerId(''); setCustomerSearch(''); }}
                      className="ml-auto text-xs text-gray-500 hover:text-helm-red underline">
                      change
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <input type="text" value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)}
                      placeholder="Type to search…"
                      className="text-sm border border-gray-300 rounded px-2 py-1.5 w-full" />
                    {customerSearch && (
                      <div className="absolute z-10 mt-1 w-full max-h-60 overflow-y-auto bg-white border border-gray-300 rounded shadow-lg">
                        {filteredCustomers.length === 0 ? (
                          <div className="px-3 py-2 text-xs text-gray-500 italic">No matches</div>
                        ) : (
                          filteredCustomers.map((c) => (
                            <button key={c.id} type="button"
                              onClick={() => { setCustomerId(String(c.id)); setCustomerSearch(''); }}
                              className="w-full text-left px-3 py-1.5 text-sm hover:bg-navy-50">
                              {c.name}
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )}
              </Field>

              <Field label="Design Name *">
                <input type="text" value={designName} onChange={(e) => setDesignName(e.target.value)}
                  placeholder="e.g. Daisy Trellis"
                  className="text-sm border border-gray-300 rounded px-2 py-1.5 w-full" />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Description (optional)">
                <input type="text" value={description} onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Block print floral, 18in repeat"
                  className="text-sm border border-gray-300 rounded px-2 py-1.5 w-full" />
              </Field>
              <Field label="Pattern repeat (optional)">
                <div className="flex items-center gap-2">
                  <input type="number" min="0" step="0.1" value={repeatH} onChange={(e) => setRepeatH(e.target.value)}
                    placeholder="H″" className="text-sm border border-gray-300 rounded px-2 py-1.5 w-20 font-mono" />
                  <span className="text-gray-400 text-sm">×</span>
                  <input type="number" min="0" step="0.1" value={repeatV} onChange={(e) => setRepeatV(e.target.value)}
                    placeholder="V″" className="text-sm border border-gray-300 rounded px-2 py-1.5 w-20 font-mono" />
                  <span className="text-xs text-gray-500">inches</span>
                </div>
              </Field>
            </div>
          </div>
        </Card>

        {/* Colorways */}
        <Card>
          <CardHeader
            title="Colorway Information"
            subtitle={`${validColorways.filter((c) => c.name.trim()).length} colorway(s) named · upload customer-supplied artwork file per colorway`}
            action={
              <Button type="button" size="sm" variant="secondary" onClick={addCw}>
                <Plus className="w-3.5 h-3.5 mr-1" />Add Colorway
              </Button>
            }
          />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-2.5 w-44"><span className="text-helm-red">*</span> Name</th>
                  <th className="text-left px-4 py-2.5 w-72">Customer-supplied file</th>
                  <th className="text-left px-4 py-2.5">File Notes</th>
                  <th className="text-left px-4 py-2.5 w-32">SKU</th>
                  <th className="px-2 py-2.5 w-8"></th>
                </tr>
              </thead>
              <tbody>
                {colorways.map((c, idx) => (
                  <tr key={c.id} className="border-t border-gray-100">
                    <td className="px-4 py-2 align-top">
                      <input type="text" value={c.name} onChange={(e) => updateCw(c.id, { name: e.target.value })}
                        placeholder="Colorway Name"
                        className="text-sm border border-gray-300 rounded px-2 py-1.5 w-full" />
                    </td>
                    <td className="px-4 py-2 align-top">
                      <FileUpload value={c.file} onChange={(file) => updateCw(c.id, { file })} />
                    </td>
                    <td className="px-4 py-2 align-top">
                      <input type="text" value={c.fileNotes} onChange={(e) => updateCw(c.id, { fileNotes: e.target.value })}
                        placeholder="Color tweak notes, mill ref, etc."
                        className="text-sm border border-gray-300 rounded px-2 py-1.5 w-full" />
                    </td>
                    <td className="px-4 py-2 align-top">
                      <input type="text" value={c.sku} onChange={(e) => updateCw(c.id, { sku: e.target.value })}
                        placeholder="SKU"
                        className="text-sm border border-gray-300 rounded px-2 py-1.5 w-full font-mono" />
                    </td>
                    <td className="px-2 py-2 align-top text-right">
                      <button type="button" onClick={() => removeCw(c.id)}
                        disabled={colorways.length === 1}
                        title={colorways.length === 1 ? 'Need at least one row' : 'Remove this colorway'}
                        className="text-gray-300 hover:text-helm-red disabled:hover:text-gray-300 disabled:cursor-not-allowed">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3 border-t border-gray-100 flex justify-end">
            <Button type="button" size="sm" variant="secondary" onClick={addCw}>
              <Plus className="w-3.5 h-3.5 mr-1" />Add Colorway
            </Button>
          </div>
        </Card>

        {/* Submit */}
        <div className="flex items-center justify-between">
          <div className="text-xs text-gray-500">
            {allOk ? (
              <Tag color="green">Ready to save</Tag>
            ) : !ownerOk ? (
              <span>Select an owner (customer).</span>
            ) : !nameOk ? (
              <span>Enter a design name.</span>
            ) : !atLeastOneColorway ? (
              <span>Add at least one colorway with a name.</span>
            ) : (
              <span>Every used colorway row needs a name.</span>
            )}
          </div>
          <div className="flex gap-2">
            <Link href="/designs" className="inline-flex items-center px-3.5 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded">
              Cancel
            </Link>
            <Button type="submit" disabled={!allOk}>Save Design</Button>
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

function FileUpload({ value, onChange }: { value: File | null; onChange: (file: File | null) => void }) {
  if (value) {
    return (
      <div className="flex items-center gap-2 text-xs border border-gray-300 rounded px-2 py-1.5 bg-gray-50">
        <span className="font-mono truncate flex-1">{value.name}</span>
        <span className="text-gray-500 whitespace-nowrap">{(value.size / 1024).toFixed(0)} KB</span>
        <button type="button" onClick={() => onChange(null)}
          className="text-gray-400 hover:text-helm-red">
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    );
  }
  return (
    <label className="flex items-center gap-2 text-xs border border-dashed border-gray-300 rounded px-2 py-1.5 bg-white hover:bg-navy-50/30 hover:border-navy-700/30 cursor-pointer">
      <Upload className="w-3.5 h-3.5 text-gray-400" />
      <span className="text-gray-500">Choose file (.tiff/.psd/.pdf/.ai/.png/.jpg)</span>
      <input type="file" className="hidden"
        accept=".tiff,.tif,.psd,.pdf,.ai,.png,.jpg,.jpeg"
        onChange={(e) => onChange(e.target.files?.[0] ?? null)} />
    </label>
  );
}
