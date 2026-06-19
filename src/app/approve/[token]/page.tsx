// S26a Public Strike-Off Approval Page
// Customer-facing, no-login. Reached via token from approval email.
// Prototype renders inside the app shell with a banner reminding reviewers
// that the real page would be branded chrome only — no Helm sidebar/topbar.
import Link from 'next/link';
import { getDb } from '@/lib/db';
import { Tag, Button } from '@/components/ui';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function PublicApproval({ params }: { params: { token: string } }) {
  const db = getDb();
  const so = db.prepare(`
    SELECT so.*, pr.pr_number, pr.printed_yardage, pr.planned_yardage,
           o.order_number, o.po_number, c.name as company_name,
           af.file_name as artwork_file_name,
           d.plant_number, d.name as design_name, cw.name as colorway_name,
           f.name as fabric_name
    FROM strike_offs so
    JOIN print_requests pr ON so.print_request_id = pr.id
    JOIN order_lines ol ON pr.order_line_id = ol.id
    JOIN orders o ON ol.order_id = o.id
    JOIN companies c ON o.company_id = c.id
    LEFT JOIN designs d ON ol.design_id = d.id
    LEFT JOIN colorways cw ON ol.colorway_id = cw.id
    LEFT JOIN fabrics f ON ol.fabric_id = f.id
    LEFT JOIN artwork_files af ON so.artwork_file_id = af.id
    WHERE so.approval_token = ?
  `).get(params.token) as any;

  if (!so) {
    return (
      <div className="max-w-2xl mx-auto p-12 text-center">
        <h1 className="text-2xl font-bold text-navy-900 mb-2">Link expired or invalid</h1>
        <p className="text-gray-600">If you received this link in an email, please reach out to your ADT contact for a new one.</p>
      </div>
    );
  }

  const alreadyDecided = !!so.customer_decision_at;

  return (
    <div className="-m-6 min-h-screen bg-gradient-to-b from-navy-50 to-white">
      {/* Reviewer banner — would NOT appear in production */}
      <div className="bg-yellow-100 border-b border-yellow-300 text-yellow-900 px-4 py-2 text-xs text-center">
        Prototype reviewer note: this is the customer-facing public page. In production it renders without the Helm sidebar/topbar — ADT branding only.
      </div>

      <div className="max-w-3xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-xs uppercase tracking-widest text-navy-700 font-bold mb-1">Advanced Digital Textiles</div>
          <h1 className="text-3xl font-bold text-navy-900">Strike-Off Approval</h1>
          <p className="text-sm text-gray-600 mt-2">Please review the strike-off below and let us know if it&apos;s ready to go to production.</p>
        </div>

        {/* Order context — minimal, customer-relevant fields only */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
          <div className="grid grid-cols-2 gap-y-3 gap-x-6 text-sm">
            <Row label="Customer" value={so.company_name} />
            <Row label="Strike-Off" value={<span className="font-mono">{so.strike_off_number}</span>} />
            <Row label="Order" value={<span className="font-mono">{so.order_number}</span>} />
            {so.po_number && <Row label="Your PO" value={<span className="font-mono">{so.po_number}</span>} />}
            {so.plant_number && <Row label="Plant #" value={<span className="font-mono">{so.plant_number}</span>} />}
            {so.design_name && <Row label="Design" value={so.design_name} />}
            {so.colorway_name && <Row label="Colorway" value={so.colorway_name} />}
            {so.fabric_name && <Row label="Fabric" value={so.fabric_name} />}
          </div>
        </div>

        {/* Artwork preview */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
          <div className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-3">Strike-Off Preview</div>
          <div className="aspect-[4/3] bg-gradient-to-br from-gray-100 to-gray-200 border border-gray-300 rounded flex items-center justify-center text-gray-400 text-xs">
            [High-res strike-off scan: {so.artwork_file_name ?? 'pending'}]
          </div>
          <div className="mt-3 text-xs text-gray-500 italic">
            Need a higher-resolution view or a physical strike-off mailed to you? <a className="text-navy-700 underline" href="mailto:hello@adt.com">Reply to our email</a> and we&apos;ll set it up.
          </div>
        </div>

        {/* Decision panel */}
        {alreadyDecided ? (
          <div className="bg-white border border-gray-200 rounded-lg p-6 text-center">
            <Tag color={so.customer_decision_outcome === 'Approved' ? 'green'
              : so.customer_decision_outcome === 'Approve with Changes' ? 'purple' : 'red'}>
              {so.customer_decision_outcome}
            </Tag>
            <p className="text-sm text-gray-600 mt-3">
              You already responded to this strike-off. If you need to change your decision, please reach out to your ADT contact.
            </p>
            {so.customer_change_notes && (
              <div className="mt-4 text-left bg-helm-purple/30 border-l-4 border-purple-400 px-4 py-3 rounded text-sm italic">
                {so.customer_change_notes}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <button className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg px-4 py-4 text-base flex items-center justify-center gap-2">
              ✓ Approve as-is — proceed to production
            </button>
            <button className="w-full bg-helm-purple hover:bg-purple-200 text-purple-900 font-semibold rounded-lg px-4 py-4 text-base flex items-center justify-center gap-2 border border-purple-300">
              ✎ Approve with Changes
              <span className="text-xs font-normal opacity-80">(we&apos;ll capture your notes)</span>
            </button>
            <button className="w-full bg-white hover:bg-red-50 text-red-700 font-semibold rounded-lg px-4 py-4 text-base flex items-center justify-center gap-2 border border-red-300">
              ✕ Reject — request a new strike-off
            </button>

            <details className="mt-6 text-sm text-gray-600">
              <summary className="cursor-pointer text-navy-700 font-semibold">Add notes for our team (optional)</summary>
              <textarea
                rows={4}
                placeholder="Color tweaks, repeat adjustments, trim notes…"
                className="mt-3 w-full border border-gray-300 rounded p-3 text-sm"
              />
            </details>
          </div>
        )}

        <div className="mt-12 text-center text-xs text-gray-400">
          Questions? <a className="text-navy-700 underline" href="mailto:hello@adt.com">hello@adt.com</a> · This link is unique to your strike-off and expires after 30 days.
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-0.5">{label}</div>
      <div className="text-navy-900">{value}</div>
    </div>
  );
}
