import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDb } from '@/lib/db';
import { Card, CardHeader, Tag, StatusPill, Button } from '@/components/ui';
import { formatDate } from '@/lib/utils';
import { TechSheetButton, type TechSheetData } from '@/components/tech-sheet-button';
import { ChevronLeft } from 'lucide-react';

// /fprs/[id] — Finished Product Request detail
// Per Nick: prominent Tech Sheet button opens a PDF-style modal showing the cut/sew
// construction details. The tech sheet is what Yuliana / cut-sew operators clip to the bundle
// when starting work.

export default function FPRDetail({ params }: { params: { id: string } }) {
  const db = getDb();
  const id = parseInt(params.id);
  const fpr = db.prepare(`
    SELECT fpr.id, fpr.fpr_number, fpr.status, fpr.missing_component_override_json,
           ol.id as ol_id, ol.order_id, ol.quantity, ol.sku_id,
           s.product_type, s.adt_sku, s.size,
           o.order_number, o.adt_promised_date, o.estimated_ship_date, o.is_rush,
           c.name as company_name,
           pr.id as pr_id, pr.pr_number, pr.printed_yardage,
           d.plant_number, d.name as design_name,
           cw.name as colorway_name,
           f.name as fabric_name,
           pp.name as profile_name, pp.packaging_type, pp.packing_instructions, pp.customer_specific_notes
    FROM fprs fpr
    JOIN order_lines ol ON fpr.order_line_id = ol.id
    JOIN skus s ON ol.sku_id = s.id
    JOIN orders o ON ol.order_id = o.id
    JOIN companies c ON o.company_id = c.id
    LEFT JOIN print_requests pr ON fpr.print_request_id = pr.id
    LEFT JOIN designs d ON ol.design_id = d.id
    LEFT JOIN colorways cw ON ol.colorway_id = cw.id
    LEFT JOIN fabrics f ON ol.fabric_id = f.id
    LEFT JOIN packaging_profiles pp ON fpr.packaging_profile_override_id = pp.id OR pp.id = s.packaging_profile_id
    WHERE fpr.id = ?
    LIMIT 1
  `).get(id) as any;

  if (!fpr) notFound();

  // Convenience: derive Throw Pillow construction details from product_type + size + fabric
  // (mock for prototype — in production these would come from a tech_sheet table or per-FPR fields)
  const isPillow = fpr.product_type === 'pillow';
  const productLabel = isPillow ? 'Throw Pillow'
                      : fpr.product_type === 'curtain' ? 'Curtain'
                      : fpr.product_type === 'tabletop' ? 'Tabletop'
                      : fpr.product_type;

  const techSheet: TechSheetData = {
    fpr_number: fpr.fpr_number,
    order_number: fpr.order_number,
    customer: fpr.company_name,
    product_type: productLabel,
    quantity: fpr.quantity,
    promised_date: fpr.adt_promised_date ? formatDate(fpr.adt_promised_date) : null,
    design_name: fpr.design_name,
    colorway_name: fpr.colorway_name,
    plant_number: fpr.plant_number,
    size: fpr.size,
    face_fabric: isPillow ? fpr.fabric_name : fpr.fabric_name,
    back_fabric: isPillow ? fpr.fabric_name : null,
    zipper_guideline: isPillow ? 'Hidden Bottom' : null,
    zipper_length: isPillow && fpr.size ? `${fpr.size.split('×')[0]?.trim()}"` : null,
    insert_type: isPillow ? 'Down Alternative' : null,
    insert_size: isPillow ? fpr.size : null,
    welt_type: isPillow ? 'Self-Welt' : null,
    bar_tack: isPillow ? 'Yes' : null,
    cut_sew_notes: null,
    finishing_requirements: 'Standard finishing per packaging profile.',
    packaging_profile: fpr.profile_name,
    packaging_notes: fpr.customer_specific_notes || fpr.packing_instructions,
  };

  return (
    <div className="max-w-7xl mx-auto space-y-5 pb-12">
      <header>
        <Link href="/cut-sew" className="text-sm text-gray-500 hover:underline flex items-center gap-1 w-fit">
          <ChevronLeft className="w-3.5 h-3.5" /> Cut/Sew Workboard
        </Link>
        <div className="flex items-start justify-between mt-2 gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold text-navy-900 font-mono">{fpr.fpr_number}</h1>
              <StatusPill status={fpr.status} />
              {fpr.is_rush ? <Tag color="red">Rush</Tag> : null}
              {fpr.missing_component_override_json && <Tag color="yellow">Missing component override</Tag>}
            </div>
            <div className="text-sm text-gray-600">
              <span className="capitalize font-semibold">{productLabel}</span>
              {fpr.size && <span className="ml-1">· {fpr.size}</span>}
              <span className="mx-2 text-gray-300">·</span>
              {fpr.company_name}
              <span className="mx-2 text-gray-300">·</span>
              <Link href={`/orders/${fpr.order_id}`} className="font-mono text-navy-700 hover:underline">{fpr.order_number}</Link>
              {fpr.pr_id && (
                <>
                  <span className="mx-2 text-gray-300">·</span>
                  <Link href={`/print-requests/${fpr.pr_id}`} className="font-mono text-navy-700 hover:underline">{fpr.pr_number}</Link>
                </>
              )}
            </div>
          </div>

          {/* Tech Sheet — the prominent button per Nick */}
          <div className="flex gap-2 flex-shrink-0">
            <TechSheetButton data={techSheet} />
            <Button variant="secondary">Start Bundle</Button>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-5">
          <Card>
            <CardHeader title="Construction Summary" subtitle="Quick on-screen reference — open the Tech Sheet for the printable version" />
            <div className="p-5 grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <Field label="Product Type" value={productLabel} bold />
              <Field label="Size" value={fpr.size || '—'} bold />
              <Field label="Quantity" value={`${fpr.quantity} units`} />
              <Field label="SKU" value={fpr.adt_sku} mono />
              <Field label="Design" value={fpr.design_name || '—'} />
              <Field label="Colorway" value={fpr.colorway_name || '—'} />
              <Field label="Face Fabric" value={techSheet.face_fabric || '—'} />
              <Field label="Back Fabric" value={techSheet.back_fabric || '—'} />
              {isPillow && (
                <>
                  <Field label="Zipper" value={`${techSheet.zipper_guideline} · ${techSheet.zipper_length}`} />
                  <Field label="Insert" value={`${techSheet.insert_type} · ${techSheet.insert_size}`} />
                  <Field label="Welt" value={techSheet.welt_type || '—'} />
                  <Field label="Bar Tack" value={techSheet.bar_tack || '—'} />
                </>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Cut / Sew Notes" />
            <div className="p-5 text-sm">
              {techSheet.cut_sew_notes || <span className="text-gray-400 italic">No notes from CSR. Refer to standard pattern for this SKU.</span>}
            </div>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader title="Source Print Request" />
            <div className="px-5 py-4 text-sm space-y-2">
              {fpr.pr_id ? (
                <>
                  <div>
                    <Link href={`/print-requests/${fpr.pr_id}`} className="font-mono text-navy-700 hover:underline font-semibold">{fpr.pr_number}</Link>
                  </div>
                  <div className="text-xs text-gray-500">Printed yardage: <strong className="font-mono">{fpr.printed_yardage ?? '—'} yd</strong></div>
                  <div className="text-xs text-gray-500">Plant #: <span className="font-mono">{fpr.plant_number || '—'}</span></div>
                </>
              ) : (
                <div className="text-xs text-gray-500 italic">FPR not yet linked to a printed PR.</div>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Packaging Profile" />
            <div className="px-5 py-4 text-sm space-y-2">
              {fpr.profile_name ? (
                <>
                  <div className="font-semibold">{fpr.profile_name}</div>
                  <Tag color="purple">{fpr.packaging_type}</Tag>
                  {fpr.customer_specific_notes && (
                    <div className="text-xs text-gray-600 mt-2 italic">{fpr.customer_specific_notes}</div>
                  )}
                </>
              ) : (
                <div className="text-xs text-gray-400 italic">No packaging profile assigned. Default packaging will apply.</div>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Actions" />
            <div className="px-5 py-3 space-y-2">
              <Button variant="secondary" className="w-full">Mark Bundle Complete</Button>
              <Button variant="secondary" className="w-full">Log Defect / Issue</Button>
              <Button variant="ghost" className="w-full">Reassign Packaging Profile</Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, bold, mono }: { label: string; value: string; bold?: boolean; mono?: boolean }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">{label}</div>
      <div className={`mt-0.5 ${bold ? 'font-semibold' : ''} ${mono ? 'font-mono text-xs' : ''}`}>{value}</div>
    </div>
  );
}
