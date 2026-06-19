'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Card, CardHeader, Tag, Button } from '@/components/ui';

type Row = {
  rowNum: number;          // 1-based, header excluded
  design_name: string;
  colorway_name: string;
  file_path: string;
  design_description?: string;
  repeat_h?: string;
  repeat_v?: string;
  // Computed
  errors: string[];
  warnings: string[];
  plant_number?: string;   // assigned in preview
  is_new_design?: boolean; // first row for this design name in the CSV
};

const TEMPLATE_HEADERS = ['design_name', 'colorway_name', 'file_path', 'design_description', 'repeat_h_inches', 'repeat_v_inches'];

const TEMPLATE_CSV =
  TEMPLATE_HEADERS.join(',') + '\n'
  + 'Daisy Trellis,Navy,\\\\nas\\artwork\\incoming\\inside-spring-25\\daisy_navy.tiff,Block print floral 18in repeat,18,18\n'
  + 'Daisy Trellis,Coral,\\\\nas\\artwork\\incoming\\inside-spring-25\\daisy_coral.tiff,,18,18\n'
  + 'Daisy Trellis,Sage,\\\\nas\\artwork\\incoming\\inside-spring-25\\daisy_sage.tiff,,18,18\n'
  + 'Linen Stripe,Putty,\\\\nas\\artwork\\incoming\\inside-spring-25\\linenstripe_putty.tiff,Horizontal stripe 4in,4,\n';

function isUncPath(s: string): boolean {
  return /^\\\\[\w.-]+\\[^\\].*\.(tiff|tif|psd|pdf|ai|png|jpg|jpeg)$/i.test(s.trim());
}

function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.replace(/\r\n/g, '\n').split('\n').filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };
  // Naive CSV: split by comma. Doesn't handle quoted commas — fine for the prototype flow.
  const headers = lines[0].split(',').map((h) => h.trim());
  const rows = lines.slice(1).map((line) => line.split(',').map((c) => c.trim()));
  return { headers, rows };
}

export function ImportFlow({
  companies,
  existingByCustomer,
  nextPlantSerial,
  year,
}: {
  companies: { id: number; name: string }[];
  existingByCustomer: Record<string, string[]>;
  nextPlantSerial: number;
  year: string;
}) {
  const [customerId, setCustomerId] = useState<string>('');
  const [csvText, setCsvText] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [committed, setCommitted] = useState<{ designs: number; colorways: number; artwork: number } | null>(null);

  const existingNames = useMemo(() => {
    const set = new Set<string>();
    if (customerId && existingByCustomer[customerId]) {
      existingByCustomer[customerId].forEach((n) => set.add(n));
    }
    return set;
  }, [customerId, existingByCustomer]);

  const customerName = companies.find((c) => String(c.id) === customerId)?.name ?? '';

  const parsed = useMemo<{ headers: string[]; rows: Row[]; missingHeaders: string[] }>(() => {
    if (!csvText) return { headers: [], rows: [], missingHeaders: [] };
    const { headers, rows: rawRows } = parseCSV(csvText);
    const missingHeaders = ['design_name', 'colorway_name', 'file_path'].filter((h) => !headers.includes(h));
    if (missingHeaders.length > 0) return { headers, rows: [], missingHeaders };

    const idx = (name: string) => headers.indexOf(name);
    const iName = idx('design_name');
    const iCw = idx('colorway_name');
    const iFile = idx('file_path');
    const iDesc = idx('design_description');
    const iRh = idx('repeat_h_inches');
    const iRv = idx('repeat_v_inches');

    // First pass — assign PLANT# per unique design_name in CSV
    const plantByName = new Map<string, string>();
    let serial = nextPlantSerial;
    rawRows.forEach((r) => {
      const name = (r[iName] ?? '').trim();
      if (name && !plantByName.has(name.toLowerCase())) {
        plantByName.set(name.toLowerCase(), `P${year}-${serial++}`);
      }
    });

    // Track colorway dups within the same design in this CSV
    const seenDesignColorway = new Set<string>();

    const out: Row[] = rawRows.map((r, i) => {
      const design_name = (r[iName] ?? '').trim();
      const colorway_name = (r[iCw] ?? '').trim();
      const file_path = (r[iFile] ?? '').trim();
      const errors: string[] = [];
      const warnings: string[] = [];

      if (!design_name) errors.push('design_name missing');
      if (!colorway_name) errors.push('colorway_name missing');
      if (!file_path) {
        errors.push('file_path missing');
      } else if (!isUncPath(file_path)) {
        errors.push('file_path must be UNC \\\\server\\… ending in .tiff/.tif/.psd/.pdf/.ai/.png/.jpg');
      }

      // Dup design name against existing DB
      if (design_name && existingNames.has(design_name.toLowerCase())) {
        errors.push(`design "${design_name}" already exists for this customer`);
      }

      // Dup colorway within same design (in this CSV)
      const key = `${design_name.toLowerCase()}||${colorway_name.toLowerCase()}`;
      if (design_name && colorway_name) {
        if (seenDesignColorway.has(key)) {
          errors.push('duplicate design + colorway in this CSV');
        } else {
          seenDesignColorway.add(key);
        }
      }

      // First occurrence of this design name in CSV?
      const sameNameRows = rawRows.filter((rr) => (rr[iName] ?? '').trim().toLowerCase() === design_name.toLowerCase());
      const is_new_design = sameNameRows.length > 0 && sameNameRows[0] === r;

      return {
        rowNum: i + 1,
        design_name,
        colorway_name,
        file_path,
        design_description: iDesc >= 0 ? (r[iDesc] ?? '').trim() : '',
        repeat_h: iRh >= 0 ? (r[iRh] ?? '').trim() : '',
        repeat_v: iRv >= 0 ? (r[iRv] ?? '').trim() : '',
        errors,
        warnings,
        plant_number: plantByName.get(design_name.toLowerCase()),
        is_new_design,
      };
    });

    return { headers, rows: out, missingHeaders: [] };
  }, [csvText, existingNames, nextPlantSerial, year]);

  const totals = useMemo(() => {
    const r = parsed.rows;
    const errorRows = r.filter((x) => x.errors.length > 0).length;
    const uniqueDesigns = new Set(r.filter((x) => x.errors.length === 0).map((x) => x.design_name.toLowerCase()));
    const cleanRows = r.length - errorRows;
    return {
      total: r.length,
      ok: cleanRows,
      errors: errorRows,
      newDesigns: uniqueDesigns.size,
      newColorways: cleanRows,
    };
  }, [parsed]);

  function downloadTemplate() {
    const blob = new Blob([TEMPLATE_CSV], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'design-import-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFileName(f.name);
    setCommitted(null);
    f.text().then((t) => setCsvText(t));
  }

  function commit() {
    // Prototype mock — would POST to a server action that runs the inserts in a transaction.
    setCommitted({
      designs: totals.newDesigns,
      colorways: totals.newColorways,
      artwork: totals.newColorways,
    });
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <header className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Link href="/designs" className="text-sm text-gray-500 hover:underline">← Designs</Link>
          </div>
          <h1 className="text-2xl font-bold text-navy-900">Bulk Import Designs &amp; Colorways</h1>
          <p className="text-sm text-gray-600 mt-0.5">
            CSV upload: one row per colorway. PLANT# auto-generated per unique design name.
            Files must already be on the NAS — Helm stores the UNC path, no copy is performed.
          </p>
        </div>
        <Button variant="secondary" onClick={downloadTemplate}>↓ Download CSV template</Button>
      </header>

      {/* Step 1: customer */}
      <Card>
        <CardHeader title="Step 1 · Choose customer" subtitle="All designs in this CSV belong to a single customer." />
        <div className="p-5">
          <select
            value={customerId}
            onChange={(e) => { setCustomerId(e.target.value); setCommitted(null); }}
            className="text-sm border border-gray-300 rounded px-3 py-2 w-96"
          >
            <option value="">Select a customer…</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          {customerId && (
            <div className="mt-2 text-xs text-gray-500">
              {(existingByCustomer[customerId] ?? []).length} existing designs for <strong>{customerName}</strong> — duplicate names in your CSV will error out.
            </div>
          )}
        </div>
      </Card>

      {/* Step 2: upload */}
      <Card>
        <CardHeader title="Step 2 · Upload CSV" subtitle="Drag from Finder or click to choose. We parse client-side so you can preview before committing." />
        <div className="p-5">
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={onFile}
            disabled={!customerId}
            className="text-sm"
          />
          {!customerId && <div className="mt-2 text-xs text-helm-red">Choose a customer first.</div>}
          {fileName && <div className="mt-2 text-xs text-gray-600">Loaded: <span className="font-mono">{fileName}</span></div>}
          {parsed.missingHeaders.length > 0 && (
            <div className="mt-3 text-xs text-helm-red">
              CSV is missing required headers: <strong>{parsed.missingHeaders.join(', ')}</strong>. Download the template above for the exact column names.
            </div>
          )}
        </div>
      </Card>

      {/* Step 3: preview */}
      {parsed.rows.length > 0 && (
        <>
          <div className="grid grid-cols-4 gap-4">
            <Stat label="Total CSV rows" value={totals.total} />
            <Stat label="Clean rows" value={totals.ok} accent="green" />
            <Stat label="Error rows" value={totals.errors} accent={totals.errors > 0 ? 'red' : 'green'} />
            <Stat label="New designs" value={totals.newDesigns} accent="blue" sub={`${totals.newColorways} colorways · ${totals.newColorways} artwork links`} />
          </div>

          <Card>
            <CardHeader
              title="Step 3 · Preview"
              subtitle="Rows with errors will be skipped. PLANT# is assigned per unique design name."
              action={
                totals.ok > 0 && totals.errors === 0 ? (
                  <Button onClick={commit}>✓ Commit {totals.ok} row(s)</Button>
                ) : totals.errors > 0 ? (
                  <span className="text-xs text-helm-red font-semibold">Fix errors before committing</span>
                ) : null
              }
            />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
                  <tr>
                    <th className="text-left px-3 py-2.5">Row</th>
                    <th className="text-left px-3 py-2.5">PLANT#</th>
                    <th className="text-left px-3 py-2.5">Design</th>
                    <th className="text-left px-3 py-2.5">Colorway</th>
                    <th className="text-left px-3 py-2.5">File</th>
                    <th className="text-left px-3 py-2.5">Repeat</th>
                    <th className="text-left px-3 py-2.5">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {parsed.rows.map((r) => {
                    const ok = r.errors.length === 0;
                    return (
                      <tr key={r.rowNum} className={`border-t border-gray-100 ${ok ? '' : 'bg-red-50/40'}`}>
                        <td className="px-3 py-2 text-xs text-gray-500 font-mono">{r.rowNum}</td>
                        <td className="px-3 py-2 text-xs font-mono">
                          {r.plant_number ?? <span className="text-gray-300">—</span>}
                          {r.is_new_design && r.plant_number && <Tag color="blue">new</Tag>}
                        </td>
                        <td className="px-3 py-2">{r.design_name || <span className="text-gray-300 italic">missing</span>}</td>
                        <td className="px-3 py-2">{r.colorway_name || <span className="text-gray-300 italic">missing</span>}</td>
                        <td className="px-3 py-2 text-xs font-mono break-all max-w-md">
                          {r.file_path || <span className="text-gray-300 italic">missing</span>}
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-500">
                          {r.repeat_h || r.repeat_v ? `${r.repeat_h ?? '?'}×${r.repeat_v ?? '?'}″` : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-3 py-2">
                          {ok ? (
                            <Tag color="green">OK</Tag>
                          ) : (
                            <div className="space-y-0.5">
                              {r.errors.map((e, i) => (
                                <div key={i} className="text-[10px] text-helm-red">⚠ {e}</div>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {committed && (
        <Card>
          <div className="p-5 border-l-4 border-green-500 bg-green-50">
            <div className="font-semibold text-green-900 text-lg">✓ Import complete (prototype mock)</div>
            <div className="text-sm text-green-800 mt-2 space-y-1">
              <div>{committed.designs} new design{committed.designs === 1 ? '' : 's'} created under <strong>{customerName}</strong></div>
              <div>{committed.colorways} new colorway{committed.colorways === 1 ? '' : 's'}</div>
              <div>{committed.artwork} artwork file link{committed.artwork === 1 ? '' : 's'} (status: Draft, awaiting approval)</div>
              <div className="text-xs text-green-700 mt-2 italic">
                In production this commits to designs / colorways / artwork_files in a single transaction with rollback on any DB error. Each artwork file is created with status=&quot;Draft&quot; and is_original=1; a downstream NAS-validator job confirms each file actually exists at its UNC path and bumps the status to &quot;Pending Approval&quot; or flags an exception.
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <Link href="/designs" className="text-xs font-semibold text-white bg-navy-700 hover:bg-navy-900 px-3 py-1.5 rounded">
                View Design Dashboard →
              </Link>
              <Link href="/artwork" className="text-xs font-semibold text-navy-700 bg-white border border-gray-300 hover:bg-gray-50 px-3 py-1.5 rounded">
                View Artwork Files →
              </Link>
              <button onClick={() => { setCsvText(''); setFileName(''); setCommitted(null); }}
                className="text-xs font-semibold text-gray-600 hover:bg-gray-100 px-3 py-1.5 rounded">
                Import another file
              </button>
            </div>
          </div>
        </Card>
      )}

      {/* Format reference */}
      <Card>
        <CardHeader title="CSV Format Reference" />
        <div className="p-5 text-sm space-y-3">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-1">Required columns</div>
            <ul className="text-sm space-y-0.5">
              <li><code className="font-mono bg-gray-100 px-1.5 py-0.5 rounded text-xs">design_name</code> — repeats across rows for multi-colorway designs</li>
              <li><code className="font-mono bg-gray-100 px-1.5 py-0.5 rounded text-xs">colorway_name</code> — unique within a design</li>
              <li><code className="font-mono bg-gray-100 px-1.5 py-0.5 rounded text-xs">file_path</code> — UNC path on the NAS, e.g. <code className="font-mono text-xs">\\nas\artwork\…\daisy_navy.tiff</code></li>
            </ul>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-1">Optional columns</div>
            <ul className="text-sm space-y-0.5">
              <li><code className="font-mono bg-gray-100 px-1.5 py-0.5 rounded text-xs">design_description</code> — free text, attached to first colorway of each design</li>
              <li><code className="font-mono bg-gray-100 px-1.5 py-0.5 rounded text-xs">repeat_h_inches</code>, <code className="font-mono bg-gray-100 px-1.5 py-0.5 rounded text-xs">repeat_v_inches</code> — pattern repeat</li>
            </ul>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-1">Validation rules</div>
            <ul className="text-sm space-y-0.5 text-gray-700">
              <li>• PLANT# is auto-generated (P{year}-####). CSV does not include it.</li>
              <li>• If a design name already exists for the chosen customer, the row errors. No silent merges.</li>
              <li>• file_path must start with <code className="font-mono text-xs">\\</code> and end in .tiff / .tif / .psd / .pdf / .ai / .png / .jpg.</li>
              <li>• Same design + colorway combo can&apos;t appear twice in the CSV.</li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
}

function Stat({ label, value, sub, accent }: { label: string; value: any; sub?: string; accent?: 'green' | 'red' | 'blue' }) {
  const cls = accent === 'green' ? 'text-green-700'
    : accent === 'red' ? 'text-helm-red'
    : accent === 'blue' ? 'text-navy-700'
    : 'text-navy-900';
  return (
    <Card>
      <div className="p-4">
        <div className="text-xs uppercase tracking-wider text-gray-500 mb-1">{label}</div>
        <div className={`text-2xl font-bold ${cls}`}>{value}</div>
        {sub && <div className="text-[10px] text-gray-400 mt-0.5">{sub}</div>}
      </div>
    </Card>
  );
}
