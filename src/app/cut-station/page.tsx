'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ScanLine, Printer, RotateCcw, AlertTriangle, CheckCircle2, X } from 'lucide-react';
import { Card, CardHeader, Tag, Button } from '@/components/ui';
import { insertDisplay } from '@/lib/insert-mapping';

// /cut-station — CUT operator scan-to-label workflow
// Operator scans the Traveler QR (printed below each print). Helm looks up all line items
// associated with that QR's payload (today: order_id / PO#). Operator picks which line items
// need a CUT label and prints — one label per selected line item.
//
// Each label contains:
//   * Same QR payload (lookup key)
//   * PO# / Order ID
//   * VPN
//   * Quantity
//   * Insert Requirement (or explicit 'NO INSERT' string for non-pillows)

// Mock dataset — replaces a real DB lookup in the prototype.
// Each PO maps to N order lines. Some lines deliberately have NO VPN or unmapped VPNs so the
// operator sees the master-SKU mapping status / Unknown VPN handling inline.
type MockLine = {
  id: number;
  pr_number: string;
  vpn: string | null;
  product_type_from_master: string | null;
  insert_required: string | null;
  master_sku_mapping_status: 'mapped' | 'unmapped' | 'no_vpn';
  design_name: string;
  colorway_name: string;
  quantity: number;
};
type MockPO = {
  payload: string;          // What the Traveler QR encodes (PO# or order id)
  order_number: string;
  po_number: string;
  customer: string;
  composite_status: 'generated' | 'pending' | 'failed';
  lines: MockLine[];
};

const MOCK_POS: MockPO[] = [
  {
    payload: 'ADT-4506', order_number: 'ADT-4506', po_number: 'PO-ZGW8NY40', customer: 'St Frank',
    composite_status: 'generated',
    lines: [
      { id: 8501, pr_number: 'PR-12087', vpn: 'ST-PIL-2222-OUT', product_type_from_master: 'PIL_22x22_OUT',
        insert_required: '26x26-NW', master_sku_mapping_status: 'mapped',
        design_name: 'Cypress', colorway_name: 'Indigo', quantity: 4 },
      { id: 8502, pr_number: 'PR-12088', vpn: 'ST-PIL-1818-IN', product_type_from_master: 'PIL_18x18_IN',
        insert_required: '20x20-9010', master_sku_mapping_status: 'mapped',
        design_name: 'Marigold', colorway_name: 'White', quantity: 6 },
      { id: 8503, pr_number: 'PR-12089', vpn: 'ST-NAP-2020', product_type_from_master: 'NAPKIN_20x20',
        insert_required: null, master_sku_mapping_status: 'mapped',
        design_name: 'Sage Block', colorway_name: 'Olive', quantity: 12 },
    ],
  },
  {
    payload: 'ADT-4619', order_number: 'ADT-4619', po_number: 'PO-ENE23SYT', customer: 'St Frank',
    composite_status: 'generated',
    lines: [
      { id: 8521, pr_number: 'PR-12247', vpn: 'ST-PIL-2626-OUT', product_type_from_master: 'PIL_26x26_OUT',
        insert_required: '30x30-NW', master_sku_mapping_status: 'mapped',
        design_name: 'Coral', colorway_name: 'Pink', quantity: 2 },
      { id: 8522, pr_number: 'PR-12248', vpn: 'ST-UNKNOWN-9999', product_type_from_master: null,
        insert_required: null, master_sku_mapping_status: 'unmapped',
        design_name: 'Custom Design', colorway_name: 'Special', quantity: 1 },
    ],
  },
  {
    payload: 'ADT-4742', order_number: 'ADT-4742', po_number: '—', customer: 'Inside / Havenly',
    composite_status: 'generated',
    lines: [
      { id: 8533, pr_number: 'PR-12491', vpn: 'IH-CYP-PIL-18', product_type_from_master: 'PIL_18x18_OUT',
        insert_required: '18x28-NW', master_sku_mapping_status: 'mapped',
        design_name: 'Cypress', colorway_name: 'Indigo', quantity: 1 },
    ],
  },
];

export default function CutStation() {
  const [scanInput, setScanInput] = useState('');
  const [scannedPO, setScannedPO] = useState<MockPO | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [selectedLineIds, setSelectedLineIds] = useState<Set<number>>(new Set());
  const [showLabels, setShowLabels] = useState(false);

  const handleScan = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = scanInput.trim();
    setScanError(null);
    setShowLabels(false);
    setSelectedLineIds(new Set());
    if (!trimmed) {
      setScannedPO(null);
      return;
    }
    const match = MOCK_POS.find((p) => p.payload.toLowerCase() === trimmed.toLowerCase());
    if (match) {
      setScannedPO(match);
    } else {
      setScannedPO(null);
      setScanError(`No order found for Traveler QR payload "${trimmed}". Try ADT-4506, ADT-4619, or ADT-4742.`);
    }
  };

  const toggleLine = (id: number) => {
    setSelectedLineIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (!scannedPO) return;
    setSelectedLineIds(new Set(scannedPO.lines.map((l) => l.id)));
  };

  const reset = () => {
    setScanInput('');
    setScannedPO(null);
    setScanError(null);
    setSelectedLineIds(new Set());
    setShowLabels(false);
  };

  const selectedLines = scannedPO?.lines.filter((l) => selectedLineIds.has(l.id)) ?? [];

  return (
    <div className="max-w-6xl mx-auto pb-12 space-y-5">
      <header>
        <h1 className="text-2xl font-bold text-navy-900">CUT Station · Scan & Label</h1>
        <p className="text-sm text-gray-500 mt-1">
          Scan the Traveler QR printed below the artwork · Helm retrieves the order's line items ·
          select line items and print one CUT label each (Zebra ZT400)
        </p>
      </header>

      {/* Scan input */}
      <Card>
        <form onSubmit={handleScan} className="p-5">
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label className="block text-[11px] uppercase tracking-wider text-gray-500 font-semibold mb-1">
                Traveler QR payload
              </label>
              <div className="relative">
                <ScanLine className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
                <input
                  type="text"
                  value={scanInput}
                  onChange={(e) => setScanInput(e.target.value)}
                  autoFocus
                  placeholder="Scan the QR or type the order # — e.g. ADT-4506"
                  className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded text-base font-mono"
                />
              </div>
            </div>
            <Button type="submit">Look Up</Button>
            {(scannedPO || scanError) && (
              <Button type="button" variant="ghost" onClick={reset}>Reset</Button>
            )}
          </div>
          {scanError && (
            <div className="mt-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2.5 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div>{scanError}</div>
            </div>
          )}
          <div className="mt-3 text-[11px] text-gray-500">
            Try one of these sample payloads in the prototype:
            {' '}
            {MOCK_POS.map((p, i) => (
              <button
                key={p.payload}
                type="button"
                onClick={() => { setScanInput(p.payload); setScannedPO(p); setScanError(null); setShowLabels(false); setSelectedLineIds(new Set()); }}
                className="font-mono text-navy-700 hover:underline mr-2"
              >
                {p.payload}{i < MOCK_POS.length - 1 ? ' ·' : ''}
              </button>
            ))}
          </div>
        </form>
      </Card>

      {/* Scanned PO context + line item selection */}
      {scannedPO && (
        <Card>
          <CardHeader
            title={`${scannedPO.order_number} · ${scannedPO.customer}`}
            subtitle={`PO ${scannedPO.po_number} · ${scannedPO.lines.length} line item${scannedPO.lines.length !== 1 ? 's' : ''} · composite ${scannedPO.composite_status}`}
            action={
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={selectAll}>Select all</Button>
                <Button
                  size="sm"
                  disabled={selectedLineIds.size === 0}
                  onClick={() => setShowLabels(true)}
                >
                  <Printer className="w-3.5 h-3.5 mr-1" />Print {selectedLineIds.size} CUT label{selectedLineIds.size !== 1 ? 's' : ''}
                </Button>
              </div>
            }
          />
          <table className="w-full text-sm">
            <thead className="text-xs text-gray-500 uppercase tracking-wider border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="w-10 px-3 py-2"></th>
                <th className="text-left px-3 py-2">PR #</th>
                <th className="text-left px-3 py-2">VPN</th>
                <th className="text-left px-3 py-2">Design / Colorway</th>
                <th className="text-left px-3 py-2">Product Type</th>
                <th className="text-right px-3 py-2">Qty</th>
                <th className="text-left px-3 py-2">Insert Requirement</th>
                <th className="text-left px-3 py-2">Master SKU</th>
              </tr>
            </thead>
            <tbody>
              {scannedPO.lines.map((line) => (
                <tr key={line.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-3 py-2.5">
                    <input
                      type="checkbox"
                      checked={selectedLineIds.has(line.id)}
                      onChange={() => toggleLine(line.id)}
                      className="w-4 h-4"
                    />
                  </td>
                  <td className="px-3 py-2.5 font-mono text-navy-700 font-semibold">{line.pr_number}</td>
                  <td className="px-3 py-2.5 font-mono text-xs">
                    {line.vpn || <span className="text-gray-400 italic">no VPN</span>}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="font-semibold">{line.design_name}</div>
                    <div className="text-[11px] text-gray-500">{line.colorway_name}</div>
                  </td>
                  <td className="px-3 py-2.5 text-xs font-mono">
                    {line.product_type_from_master || <span className="text-gray-400 italic">—</span>}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono">{line.quantity}</td>
                  <td className="px-3 py-2.5">
                    <InsertCell line={line} />
                  </td>
                  <td className="px-3 py-2.5">
                    {line.master_sku_mapping_status === 'mapped' && <Tag color="green">Mapped</Tag>}
                    {line.master_sku_mapping_status === 'unmapped' && <Tag color="red">Unknown VPN</Tag>}
                    {line.master_sku_mapping_status === 'no_vpn' && <Tag color="gray">No VPN</Tag>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 py-2 border-t border-gray-100 text-[11px] text-gray-500 italic">
            <strong>Insert Requirement</strong> is derived from <code>master_skus.product_type</code> via the
            static product-type → insert map. Non-pillow products explicitly display <code>NO INSERT</code> —
            never blank. Unknown VPNs surface as an Unknown-VPN exception (open <Link href="/exceptions" className="text-navy-700 hover:underline">Exception Center</Link>).
          </div>
        </Card>
      )}

      {/* Label preview / print confirmation */}
      {showLabels && scannedPO && selectedLines.length > 0 && (
        <LabelPreviewPanel po={scannedPO} lines={selectedLines} onClose={() => setShowLabels(false)} />
      )}

      {/* Empty state */}
      {!scannedPO && !scanError && (
        <Card>
          <div className="p-12 text-center text-gray-400">
            <ScanLine className="w-10 h-10 mx-auto mb-3 text-gray-300" />
            <div className="text-sm">Scan a Traveler QR to begin.</div>
            <div className="text-xs mt-1">The QR is printed below each print on the fabric leader.</div>
          </div>
        </Card>
      )}
    </div>
  );
}

function InsertCell({ line }: { line: MockLine }) {
  // Non-pillow / no master row → 'NO INSERT' explicit string per Nick. Never blank.
  const display = insertDisplay(line.product_type_from_master, line.insert_required);
  const isNoInsert = display === 'NO INSERT';
  return (
    <span className={`font-mono text-xs ${isNoInsert ? 'text-gray-500 uppercase tracking-wider font-semibold' : 'text-navy-700 font-semibold'}`}>
      {display}
    </span>
  );
}

function LabelPreviewPanel({ po, lines, onClose }: { po: MockPO; lines: MockLine[]; onClose: () => void }) {
  const [printed, setPrinted] = useState(false);
  return (
    <Card className="border-navy-500 border-2">
      <CardHeader
        title={`CUT Label Preview — ${lines.length} label${lines.length !== 1 ? 's' : ''}`}
        subtitle="Zebra ZT400 · one label per selected line item"
        action={
          <div className="flex gap-2">
            {!printed && (
              <Button size="sm" onClick={() => setPrinted(true)}>
                <Printer className="w-3.5 h-3.5 mr-1" />Confirm Print {lines.length}
              </Button>
            )}
            <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X className="w-4 h-4" /></button>
          </div>
        }
      />
      {printed && (
        <div className="mx-5 mt-4 mb-2 p-3 bg-green-50 border border-green-200 rounded text-xs text-green-900 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          {lines.length} label{lines.length !== 1 ? 's' : ''} sent to Zebra ZT400 · cut_labels rows logged with operator + timestamp · reprint available from Packing Correction
        </div>
      )}
      <div className="p-5 grid grid-cols-2 gap-3">
        {lines.map((line) => (
          <CutLabel key={line.id} po={po} line={line} />
        ))}
      </div>
    </Card>
  );
}

function CutLabel({ po, line }: { po: MockPO; line: MockLine }) {
  const insert = insertDisplay(line.product_type_from_master, line.insert_required);
  const isNoInsert = insert === 'NO INSERT';
  return (
    <div className="border border-gray-400 rounded bg-white p-3 font-mono text-xs">
      <div className="flex items-start gap-3">
        {/* Faux QR */}
        <div className="w-16 h-16 border border-gray-300 bg-gray-50 flex-shrink-0 flex items-center justify-center"
             style={{
               backgroundImage: 'linear-gradient(45deg, #d1d5db 25%, transparent 25%), linear-gradient(-45deg, #d1d5db 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #d1d5db 75%), linear-gradient(-45deg, transparent 75%, #d1d5db 75%)',
               backgroundSize: '6px 6px',
               backgroundPosition: '0 0, 0 3px, 3px -3px, -3px 0',
             }}
        >
          <div className="text-[8px] text-gray-700 bg-white px-1 rounded">QR</div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[9px] uppercase tracking-wider text-gray-500">Payload</div>
          <div className="font-bold text-navy-900 text-sm">{po.payload}</div>
          <div className="grid grid-cols-2 gap-x-2 gap-y-1 mt-2 text-[10px]">
            <div>
              <div className="uppercase tracking-wider text-gray-500">PO #</div>
              <div className="font-bold">{po.po_number}</div>
            </div>
            <div>
              <div className="uppercase tracking-wider text-gray-500">VPN</div>
              <div className="font-bold">{line.vpn || '—'}</div>
            </div>
            <div>
              <div className="uppercase tracking-wider text-gray-500">Qty</div>
              <div className="font-bold">{line.quantity}</div>
            </div>
            <div>
              <div className="uppercase tracking-wider text-gray-500">Insert</div>
              <div className={`font-bold ${isNoInsert ? 'text-gray-600' : 'text-navy-900'}`}>{insert}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
