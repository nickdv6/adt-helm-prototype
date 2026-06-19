import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDb } from '@/lib/db';
import { Card, CardHeader, StatusPill, Tag, Button } from '@/components/ui';
import { formatDate, relativeTime } from '@/lib/utils';
import { Image as ImageIcon, ExternalLink, RotateCcw, Maximize2 } from 'lucide-react';

// S24 Print Request Detail
// Surfaces: PR header, parent order, internal proof flow (S23-S32.60),
// click-and-print + auto-route fields (S23-S32.61/.62), strike-off classification (OD-9),
// reprint chain (6.10), printer + profile.

export default function PRDetail({ params }: { params: { id: string } }) {
  const db = getDb();
  const id = parseInt(params.id);
  const pr = db.prepare(`
    SELECT pr.*, ol.order_id, ol.quantity as line_qty, ol.strike_off_classification as line_class,
           o.order_number, o.status as order_status, o.is_rush,
           c.name as company_name,
           d.plant_number, d.name as design_name,
           cw.name as colorway_name,
           f.name as fabric_name,
           p.name as printer_name, p.ink_set,
           u.full_name as colorist_name
    FROM print_requests pr
    JOIN order_lines ol ON pr.order_line_id = ol.id
    JOIN orders o ON ol.order_id = o.id
    JOIN companies c ON o.company_id = c.id
    LEFT JOIN designs d ON ol.design_id = d.id
    LEFT JOIN colorways cw ON ol.colorway_id = cw.id
    LEFT JOIN fabrics f ON pr.fabric_id = f.id
    LEFT JOIN printers p ON pr.printer_id = p.id
    LEFT JOIN users u ON pr.colorist_user_id = u.id
    WHERE pr.id = ?
  `).get(id) as any;

  if (!pr) notFound();

  const reprintChain = db.prepare(`
    SELECT id, pr_number, status, reprint_reason_code, created_at
    FROM print_requests WHERE reprint_of_pr_id = ?
  `).all(pr.id) as any[];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <header>
        <div className="flex items-center gap-3 mb-1">
          <Link href={`/orders/${pr.order_id}`} className="text-sm text-gray-500 hover:underline">← {pr.order_number}</Link>
          <span className="text-gray-300">/</span>
          <h1 className="text-2xl font-bold text-navy-900 font-mono">{pr.pr_number}</h1>
          <StatusPill status={pr.status} />
          {pr.is_rush ? <Tag color="red">Rush</Tag> : null}
          {pr.is_click_and_print ? <Tag color="purple">Click-and-Print</Tag> : null}
          {pr.was_csv_auto_routed ? <Tag color="blue">Auto-routed</Tag> : null}
        </div>
        <div className="text-sm text-gray-600">
          {pr.company_name}
          {pr.plant_number ? <> · <span className="font-mono">{pr.plant_number}</span></> : null}
          {pr.fabric_name ? <> · {pr.fabric_name}</> : null}
          {pr.printer_name ? <> · {pr.printer_name} ({pr.ink_set})</> : null}
        </div>
      </header>

      {/* Internal Proof Card — only show if proof is required */}
      {pr.internal_proof_status !== 'not_required' && (
        <Card>
          <CardHeader title="Internal Pre-Production Proof (S23-S32.60)" subtitle="First piece off the printer — Jeannine reviews before full production released" />
          <div className="px-5 py-4 grid grid-cols-3 gap-4 text-sm">
            <Field label="Status">
              <StatusPill status={pr.internal_proof_status === 'approved' ? 'Approved'
                : pr.internal_proof_status === 'pending' ? 'Pending Internal Proof'
                : pr.internal_proof_status === 'failed' ? 'Issue — Contact Us' : 'Not Required'} />
            </Field>
            <Field label="Requested">{pr.internal_proof_requested_at ? relativeTime(pr.internal_proof_requested_at) : '—'}</Field>
            <Field label="Resolved">{pr.internal_proof_resolved_at ? relativeTime(pr.internal_proof_resolved_at) : '—'}</Field>
            <Field label="Resolved By">{pr.internal_proof_resolved_by_user_id ? 'Jeannine Romero' : '—'}</Field>
            <Field label="Auto-Prep Done">{pr.auto_prep_completed_at ? relativeTime(pr.auto_prep_completed_at) : '—'}</Field>
            <Field label="Fail Reason">{pr.internal_proof_fail_reason || '—'}</Field>
          </div>
          {pr.internal_proof_status === 'pending' && (
            <div className="px-5 pb-4 flex gap-2 border-t border-gray-100 pt-3">
              <Button variant="secondary">Approve Proof — Release for Production</Button>
              <Button variant="danger">Fail Proof — Hold + Notify</Button>
            </div>
          )}
        </Card>
      )}

      {/* Auto-route card */}
      {pr.was_csv_auto_routed && (
        <Card>
          <CardHeader title="CSV/XML Auto-Route (S23-S32.61)" />
          <div className="px-5 py-3 text-sm">
            Auto-routed to hot folder <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">{pr.hot_folder_target}</span>
            <span className="text-gray-500 ml-3">Internal proof skipped per Wave 1 logic.</span>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          <Card>
            <CardHeader title="PR Details" />
            <div className="px-5 py-4 grid grid-cols-2 gap-y-3 gap-x-6 text-sm">
              <Field label="Print Process">{pr.print_process}</Field>
              <Field label="Strike-Off Class (OD-9)"><Tag color={pr.line_class === 'Customer Strike-Off Required' ? 'yellow' : 'gray'}>{pr.line_class}</Tag></Field>
              <Field label="Planned Yardage">{pr.planned_yardage} yds</Field>
              <Field label="Printed Yardage">{pr.printed_yardage ? `${pr.printed_yardage} yds` : '—'}</Field>
              <Field label="Scheduled">{pr.scheduled_at ? formatDate(pr.scheduled_at) : '—'}</Field>
              <Field label="Created">{relativeTime(pr.created_at)}</Field>
              <Field label="Design">{pr.design_name}</Field>
              <Field label="Colorway">{pr.colorway_name || '—'}</Field>
              <Field label="Colorist">{pr.colorist_name || 'Jeannine Romero (default)'}</Field>
              <Field label="RIP Recalled">{pr.rip_recalled ? <Tag color="red">Yes — manual recall (OD-6)</Tag> : 'No'}</Field>
            </div>
          </Card>

          {reprintChain.length > 0 && (
            <Card>
              <CardHeader title="Reprint Chain" subtitle={`${reprintChain.length} reprint(s) generated from this PR (per 6.10)`} />
              <div className="divide-y divide-gray-100">
                {reprintChain.map((rp) => (
                  <div key={rp.id} className="px-5 py-2.5 flex items-center gap-3 text-sm">
                    <Link href={`/print-requests/${rp.id}`} className="font-mono text-navy-700 hover:underline font-semibold">{rp.pr_number}</Link>
                    <StatusPill status={rp.status} />
                    <span className="text-xs text-gray-500">{rp.reprint_reason_code || 'no reason code'}</span>
                    <span className="ml-auto text-xs text-gray-400">{relativeTime(rp.created_at)}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <ArtworkPreview pr={pr} />
          <Card>
            <CardHeader title="Parent Order" />
            <div className="px-5 py-4 text-sm space-y-2">
              <div>
                <Link href={`/orders/${pr.order_id}`} className="font-mono font-semibold text-navy-700 hover:underline">{pr.order_number}</Link>
                <StatusPill status={pr.order_status} />
              </div>
              <div className="text-xs text-gray-500">{pr.company_name}</div>
              <div className="text-xs text-gray-500">Order line qty: {pr.line_qty}</div>
            </div>
          </Card>
          <Card>
            <CardHeader title="Actions" />
            <div className="px-5 py-3 space-y-2">
              <Button variant="secondary">Reprint (creates child PR)</Button>
              <Button variant="ghost">Recall RIP (OD-6)</Button>
              <Button variant="ghost">Edit Profile</Button>
              <Button variant="ghost">Open in Printer Queue</Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-0.5">{label}</div>
      <div>{children}</div>
    </div>
  );
}

// Artwork preview placeholder — would render the design file resolved by C9 (Design File Routing).
// Path is constructed from the customer's NAS root + folder convention + design/colorway codes.
function ArtworkPreview({ pr }: { pr: any }) {
  const designCode = pr.plant_number || pr.design_name || 'unknown';
  const colorwayCode = pr.colorway_name || 'default';
  // Mock resolved file — in production this would come from artwork_file_id lookup
  const fileName = `${designCode}_${colorwayCode}_production.tif`;
  const nasPath = `\\\\adt-nas\\artwork\\${(pr.company_name || 'customer').toLowerCase().replace(/[^a-z0-9]/g, '-')}\\${designCode}\\${colorwayCode}\\production\\`;

  return (
    <Card>
      <CardHeader
        title="Artwork Preview"
        subtitle="Design file resolved via C9 routing"
        action={
          <button title="Open full-size" className="text-gray-400 hover:text-navy-700">
            <Maximize2 className="w-4 h-4" />
          </button>
        }
      />
      <div className="p-4">
        {/* Preview placeholder — a square box with checkerboard hint to read as an image surface */}
        <div className="aspect-square w-full rounded border border-gray-300 bg-gray-50 flex items-center justify-center relative overflow-hidden"
          style={{
            backgroundImage:
              'linear-gradient(45deg, #f3f4f6 25%, transparent 25%), linear-gradient(-45deg, #f3f4f6 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #f3f4f6 75%), linear-gradient(-45deg, transparent 75%, #f3f4f6 75%)',
            backgroundSize: '16px 16px',
            backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0',
          }}
        >
          <div className="text-center px-4 py-3 bg-white/85 rounded">
            <ImageIcon className="w-8 h-8 mx-auto text-gray-400 mb-1.5" />
            <div className="text-xs font-semibold text-gray-700">{pr.design_name || 'Untitled design'}</div>
            {pr.colorway_name && <div className="text-[11px] text-gray-500 mt-0.5">{pr.colorway_name}</div>}
            <div className="text-[10px] text-gray-400 mt-1.5 italic">Preview rendered from resolved artwork file</div>
          </div>
        </div>

        {/* File metadata */}
        <div className="mt-3 space-y-1 text-[11px] text-gray-600">
          <div className="flex items-start gap-1.5">
            <span className="text-gray-400 font-semibold uppercase tracking-wider min-w-12">File</span>
            <span className="font-mono break-all">{fileName}</span>
          </div>
          <div className="flex items-start gap-1.5">
            <span className="text-gray-400 font-semibold uppercase tracking-wider min-w-12">Path</span>
            <span className="font-mono break-all text-[10px] text-gray-500">{nasPath}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-3 flex gap-2">
          <Button variant="secondary" size="sm" className="flex-1">
            <ExternalLink className="w-3.5 h-3.5 mr-1" />Open file
          </Button>
          <Button variant="ghost" size="sm" className="flex-1">
            <RotateCcw className="w-3.5 h-3.5 mr-1" />Replace
          </Button>
        </div>
      </div>
    </Card>
  );
}
