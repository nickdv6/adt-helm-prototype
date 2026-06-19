'use client';

import { useState } from 'react';
import { FileText, X, Printer, Download } from 'lucide-react';
import { Button } from './ui';

// Tech Sheet button + PDF-style modal for Cut/Sew operators reviewing FPR construction details.
// The modal renders as a paper-style document so it reads as a tech sheet you'd print and clip
// to the bundle. Print button uses the browser's print dialog; Download is a placeholder.

export type TechSheetData = {
  fpr_number: string;
  order_number: string;
  customer: string;
  product_type: string;       // 'Throw Pillow' | 'Curtain' | 'Tablecloth' | 'Tablerunner' | etc.
  quantity: number;
  promised_date: string | null;
  design_name: string | null;
  colorway_name: string | null;
  plant_number: string | null;
  // Product-specific construction fields (most populated for Throw Pillow per the New Order form)
  size?: string | null;
  face_fabric?: string | null;
  back_fabric?: string | null;
  zipper_guideline?: string | null;
  zipper_length?: string | null;
  insert_type?: string | null;
  insert_size?: string | null;
  welt_type?: string | null;
  bar_tack?: string | null;
  cut_sew_notes?: string | null;
  finishing_requirements?: string | null;
  packaging_profile?: string | null;
  packaging_notes?: string | null;
};

export function TechSheetButton({ data }: { data: TechSheetData }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)} className="bg-yellow-500 text-white border-yellow-500 hover:bg-yellow-600">
        <FileText className="w-3.5 h-3.5 mr-1.5" />
        Tech Sheet (PDF)
      </Button>
      {open && <TechSheetModal data={data} onClose={() => setOpen(false)} />}
    </>
  );
}

function TechSheetModal({ data, onClose }: { data: TechSheetData; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-6 print:p-0 print:items-start">
      <div className="absolute inset-0 bg-black/50 print:hidden" onClick={onClose}></div>

      <div className="relative bg-white rounded shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col print:max-h-none print:max-w-none print:rounded-none print:shadow-none">
        {/* Modal toolbar — hidden when printing */}
        <div className="px-4 py-2.5 border-b border-gray-200 flex items-center justify-between print:hidden bg-gray-50">
          <div className="text-xs text-gray-600">Tech Sheet · {data.fpr_number}</div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="secondary" onClick={() => window.print()}>
              <Printer className="w-3.5 h-3.5 mr-1" />Print
            </Button>
            <Button size="sm" variant="secondary">
              <Download className="w-3.5 h-3.5 mr-1" />Download PDF
            </Button>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-700 ml-1" aria-label="Close">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Paper-style document area */}
        <div className="overflow-y-auto">
          <div className="p-10 bg-white print:p-12">
            {/* Document header */}
            <div className="flex items-start justify-between border-b-2 border-navy-900 pb-4 mb-5">
              <div>
                <div className="text-[10px] uppercase tracking-widest text-gray-500 font-semibold">Advanced Digital Textiles</div>
                <h1 className="text-2xl font-bold text-navy-900 mt-1">Tech Sheet — Finished Product</h1>
              </div>
              <div className="text-right">
                <div className="text-[10px] uppercase tracking-widest text-gray-500 font-semibold">FPR Number</div>
                <div className="font-mono text-xl font-bold text-navy-900">{data.fpr_number}</div>
              </div>
            </div>

            {/* Header grid */}
            <div className="grid grid-cols-3 gap-x-6 gap-y-3 text-sm mb-6">
              <DocField label="Customer" value={data.customer} />
              <DocField label="Order #" value={data.order_number} mono />
              <DocField label="Promised Date" value={data.promised_date || '—'} />
              <DocField label="Product Type" value={data.product_type} bold />
              <DocField label="Quantity" value={`${data.quantity} units`} bold />
              <DocField label="Plant #" value={data.plant_number || '—'} mono />
              <DocField label="Design" value={data.design_name || '—'} />
              <DocField label="Colorway" value={data.colorway_name || '—'} />
              <div></div>
            </div>

            {/* Construction details block */}
            <section className="mb-6">
              <SectionHeader>Construction Details</SectionHeader>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2.5 text-sm">
                {data.size && <DocField label="Pillow / Product Size" value={data.size} bold />}
                {data.face_fabric && <DocField label="Face Fabric" value={data.face_fabric} />}
                {data.back_fabric && <DocField label="Back Fabric" value={data.back_fabric} />}
                {data.zipper_guideline && <DocField label="Zipper Guideline" value={data.zipper_guideline} />}
                {data.zipper_length && <DocField label="Zipper Length" value={data.zipper_length} />}
                {data.insert_type && <DocField label="Insert Type" value={data.insert_type} />}
                {data.insert_size && <DocField label="Insert Size" value={data.insert_size} />}
                {data.welt_type && <DocField label="Welt Type" value={data.welt_type} />}
                {data.bar_tack && <DocField label="Bar Tack" value={data.bar_tack} />}
                {!data.size && !data.face_fabric && (
                  <div className="col-span-2 text-xs text-gray-500 italic">
                    No additional construction fields recorded for this product type. Refer to the Cut/Sew Notes block below.
                  </div>
                )}
              </div>
            </section>

            {/* Cut/Sew notes */}
            <section className="mb-6">
              <SectionHeader>Cut / Sew Notes</SectionHeader>
              <div className="text-sm border border-gray-300 rounded p-3 min-h-16 bg-gray-50/40">
                {data.cut_sew_notes || <span className="text-gray-400 italic">No notes from CSR.</span>}
              </div>
            </section>

            {/* Finishing requirements */}
            <section className="mb-6">
              <SectionHeader>Finishing Requirements</SectionHeader>
              <div className="text-sm border border-gray-300 rounded p-3 min-h-12 bg-gray-50/40">
                {data.finishing_requirements || <span className="text-gray-400 italic">Standard finishing.</span>}
              </div>
            </section>

            {/* Packaging profile */}
            <section className="mb-6">
              <SectionHeader>Packaging Profile</SectionHeader>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                <DocField label="Profile" value={data.packaging_profile || 'Default (per customer)'} bold />
                <DocField label="Notes" value={data.packaging_notes || '—'} />
              </div>
            </section>

            {/* Operator sign-off */}
            <section className="border-t border-gray-300 pt-4 mt-8">
              <div className="grid grid-cols-3 gap-6 text-xs">
                <SignOff label="Cut by" />
                <SignOff label="Sewn by" />
                <SignOff label="Inspected by" />
              </div>
            </section>

            {/* Footer */}
            <div className="text-[10px] text-gray-400 mt-8 text-center border-t border-gray-200 pt-2">
              Helm Tech Sheet · {data.fpr_number} · printed from the FPR detail screen · attach to bundle
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[10px] uppercase tracking-widest text-navy-900 font-bold border-b border-navy-900 pb-1 mb-2">
      {children}
    </h2>
  );
}

function DocField({ label, value, bold, mono }: { label: string; value: string; bold?: boolean; mono?: boolean }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">{label}</div>
      <div className={`mt-0.5 ${bold ? 'font-semibold' : ''} ${mono ? 'font-mono text-xs' : ''}`}>
        {value || <span className="text-gray-300">—</span>}
      </div>
    </div>
  );
}

function SignOff({ label }: { label: string }) {
  return (
    <div>
      <div className="border-b border-gray-400 h-8"></div>
      <div className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mt-1">{label} · date</div>
    </div>
  );
}
