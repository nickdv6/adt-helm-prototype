'use client';
// Tech Sheet PDF preview modal. Renders a printable page-style layout that
// previews what the standardized customer-facing tech sheet would look like.
// Sized to letter (8.5"×11") portrait. Click Print or Download in production
// would generate an actual PDF; here it just shows the rendered preview.
import { useEffect } from 'react';
import { X, Printer, Download } from 'lucide-react';

export type FabricSnapshot = {
  name: string;
  abbreviation: string;
  ownerType: 'company' | 'adt';
  ownerName: string;
  supplier: string;
  width: string;
  printWidth: string;
  country: string;
  perThouWeight: string;
  htsCode: string;
  content1: string; pct1: string;
  content2: string; pct2: string;
  content3: string; pct3: string;
  wyzenbeek: string;
  martindale: string;
  weightOz: string;
  weightGsm: string;
  nfpa701: boolean;
  nfpa260: boolean;
  ca117: boolean;
  salePrice: string;
};

export function TechSheetPreview({ fabric, onClose }: { fabric: FabricSnapshot; onClose: () => void }) {
  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const composition = [
    fabric.content1 && fabric.pct1 ? `${fabric.pct1}% ${fabric.content1}` : '',
    fabric.content2 && fabric.pct2 ? `${fabric.pct2}% ${fabric.content2}` : '',
    fabric.content3 && fabric.pct3 ? `${fabric.pct3}% ${fabric.content3}` : '',
  ].filter(Boolean).join(' · ');

  const compliance = [
    fabric.nfpa701 ? 'NFPA 701' : '',
    fabric.nfpa260 ? 'NFPA 260' : '',
    fabric.ca117 ? 'CA 117' : '',
  ].filter(Boolean).join(' · ') || '—';

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-gray-100 rounded-lg shadow-2xl max-w-4xl w-full my-8" onClick={(e) => e.stopPropagation()}>
        {/* Toolbar */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-300 bg-white rounded-t-lg">
          <div className="text-sm font-semibold text-navy-900">Tech Sheet Preview · PDF</div>
          <div className="flex gap-2">
            <button className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-white bg-navy-700 hover:bg-navy-900 rounded">
              <Printer className="w-3.5 h-3.5" />Print
            </button>
            <button className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-navy-700 bg-white border border-gray-300 hover:bg-gray-50 rounded">
              <Download className="w-3.5 h-3.5" />Download PDF
            </button>
            <button onClick={onClose}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded">
              <X className="w-3.5 h-3.5" />Close
            </button>
          </div>
        </div>

        {/* PDF page */}
        <div className="p-6">
          <div className="bg-white shadow-md mx-auto max-w-2xl aspect-[8.5/11] overflow-hidden flex flex-col">
            {/* Branded header */}
            <div className="bg-navy-700 text-white px-8 py-5">
              <div className="text-[9px] uppercase tracking-[0.2em] opacity-80">Advanced Digital Textiles</div>
              <div className="text-2xl font-bold mt-0.5">Fabric Tech Sheet</div>
            </div>

            <div className="flex-1 px-8 py-6 text-[11px] text-gray-800 space-y-4 overflow-y-auto">
              {/* Title block */}
              <div>
                <div className="text-2xl font-bold text-navy-900">{fabric.name || 'Untitled Fabric'}</div>
                {fabric.abbreviation && <div className="font-mono text-xs text-gray-500 mt-0.5">{fabric.abbreviation}</div>}
              </div>

              <Section title="Composition" value={composition || '—'} large />

              <div className="grid grid-cols-2 gap-x-8 gap-y-3">
                <Section title="Width" value={fabric.width ? `${fabric.width}"` : '—'} />
                <Section title="Print Width" value={fabric.printWidth ? `${fabric.printWidth}"` : '—'} />
                <Section title="Weight" value={[
                  fabric.weightOz ? `${fabric.weightOz} oz/yd²` : null,
                  fabric.weightGsm ? `${fabric.weightGsm} g/m²` : null,
                ].filter(Boolean).join(' · ') || '—'} />
                <Section title="Per Thousand Weight" value={fabric.perThouWeight ? `${fabric.perThouWeight} lbs / 1000 yd` : '—'} />
                <Section title="Wyzenbeek" value={fabric.wyzenbeek ? `${Number(fabric.wyzenbeek).toLocaleString()} double rubs` : '—'} />
                <Section title="Martindale" value={fabric.martindale ? `${Number(fabric.martindale).toLocaleString()} cycles` : '—'} />
                <Section title="Country of Origin" value={fabric.country || '—'} />
                <Section title="Supplier" value={fabric.supplier || '—'} />
                <Section title="HTS Code (US import)" value={fabric.htsCode || '—'} />
              </div>

              <Section title="Flammability Compliance" value={compliance} />

              {fabric.salePrice && (
                <Section title="Sale Price" value={`$${Number(fabric.salePrice).toFixed(2)} / yd`} />
              )}

              {/* Footer */}
              <div className="pt-4 mt-4 border-t border-gray-200 text-[9px] text-gray-500 leading-relaxed">
                <div className="font-semibold text-gray-700 mb-1">Notes</div>
                <div>Specifications subject to mill variance. Confirm latest test results with ADT before placing orders against this spec. Tech sheet generated {new Date().toLocaleDateString()}.</div>
                <div className="mt-2">Advanced Digital Textiles · adt.com · hello@adt.com</div>
              </div>
            </div>
          </div>

          <div className="text-center text-[10px] text-gray-500 mt-3 italic">
            Prototype preview. Production version generates a real PDF and supports email-to-customer + download.
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, value, large }: { title: string; value: string; large?: boolean }) {
  return (
    <div>
      <div className="text-[9px] uppercase tracking-wider text-gray-500 font-bold mb-0.5">{title}</div>
      <div className={`text-navy-900 ${large ? 'text-sm font-semibold' : ''}`}>{value}</div>
    </div>
  );
}
