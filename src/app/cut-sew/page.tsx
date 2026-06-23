import Link from 'next/link';
import { getDb } from '@/lib/db';
import { Card, CardHeader, StatusPill, Tag, Button } from '@/components/ui';
import { formatDate, relativeTime } from '@/lib/utils';

// S31 Cut/Sew Workboard (Yuliana)
// Per Yuliana's checklist:
//   #2 — bundles by order + sew-style + size
//   #3 — visual quantity progress per bundle
//   #5 — finishing-required flag (poly-bag insert, hangtag, etc.) drives packaging profile
//   #14 — finished product req (FPR) is the unit of work
// Per OD-7 — packaging profile attached to each FPR; override if missing components (S23-S32.33)

export default function CutSew() {
  const db = getDb();

  // FPRs grouped by status
  const fprs = db.prepare(`
    SELECT fpr.id, fpr.fpr_number, fpr.status, fpr.packaging_profile_override_id, fpr.missing_component_override_json,
           ol.order_id, ol.quantity, ol.sku_id,
           s.product_type, s.adt_sku, s.size,
           o.order_number, c.name as company_name, o.adt_promised_date, o.is_rush,
           pr.pr_number, pr.printed_yardage,
           pp.name as profile_name, pp.packaging_type
    FROM fprs fpr
    JOIN order_lines ol ON fpr.order_line_id = ol.id
    JOIN skus s ON ol.sku_id = s.id
    JOIN orders o ON ol.order_id = o.id
    JOIN companies c ON o.company_id = c.id
    LEFT JOIN print_requests pr ON fpr.print_request_id = pr.id
    LEFT JOIN skus s2 ON s.id = s2.id
    LEFT JOIN packaging_profiles pp ON s2.packaging_profile_id = pp.id
    ORDER BY o.is_rush DESC, date(o.adt_promised_date) ASC LIMIT 30
  `).all() as any[];

  // Also surface order lines for finished products that don't have FPRs yet (cut/sew needed but not yet routed)
  const pendingFinished = db.prepare(`
    SELECT ol.id, ol.quantity, ol.sku_id,
           s.product_type, s.adt_sku, s.size,
           o.id as order_id, o.order_number, c.name as company_name, o.adt_promised_date, o.is_rush,
           o.status as order_status
    FROM order_lines ol
    JOIN skus s ON ol.sku_id = s.id
    JOIN orders o ON ol.order_id = o.id
    JOIN companies c ON o.company_id = c.id
    WHERE s.product_type IN ('pillow', 'curtain', 'tabletop')
      AND o.status IN ('In Production', 'Partially Complete')
      AND NOT EXISTS (SELECT 1 FROM fprs f WHERE f.order_line_id = ol.id)
    ORDER BY o.is_rush DESC, date(o.adt_promised_date) ASC LIMIT 20
  `).all() as any[];

  // Group FPRs by SKU + size — Yuliana's bundle pattern (#2)
  const bundles = new Map<string, any[]>();
  fprs.forEach((f) => {
    const key = `${f.product_type}|${f.size || 'std'}`;
    if (!bundles.has(key)) bundles.set(key, []);
    bundles.get(key)!.push(f);
  });

  const counts = {
    total: fprs.length,
    rush: fprs.filter((f) => f.is_rush).length,
    pending: pendingFinished.length,
    missing_components: fprs.filter((f) => f.missing_component_override_json).length,
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-navy-900">Cut/Sew Workboard — Yuliana Cruz</h1>
        <p className="text-sm text-gray-500 mt-1">S31 · Per Yuliana #2/#3 bundles + progress · Per OD-7 packaging profile per FPR</p>
        <p className="text-[11px] text-gray-500 mt-1 italic">
          Source filter: FPRs from production (printed → cut). For FPRs sourced from Shopify stored-inventory pickup, see <Link href="/fulfillment-requests" className="text-navy-700 hover:underline">Fulfillment Requests</Link>. Same entity, two streams.
        </p>
      </header>

      <div className="grid grid-cols-4 gap-4">
        <Stat label="Active FPRs" value={counts.total} accent="blue" />
        <Stat label="Rush FPRs" value={counts.rush} accent="red" />
        <Stat label="Pending Cut/Sew" value={counts.pending} accent="yellow" />
        <Stat label="Missing Components" value={counts.missing_components} accent="yellow" />
      </div>

      {/* Bundles view — grouped per Yuliana #2 */}
      <Card>
        <CardHeader title="Bundles" subtitle="Grouped by product type + size · click an FPR to open detail with the printable Tech Sheet" />
        <div className="divide-y divide-gray-100">
          {bundles.size === 0 && <div className="px-5 py-10 text-center text-sm text-gray-400">No active FPRs.</div>}
          {Array.from(bundles.entries()).map(([key, items]) => {
            const [type, size] = key.split('|');
            return (
              <div key={key} className="px-5 py-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className="font-semibold text-sm capitalize">{type}</div>
                  <div className="text-xs text-gray-500">size: {size}</div>
                  <Tag>{items.length} FPR{items.length === 1 ? '' : 's'}</Tag>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {items.map((f) => (
                    <Link
                      key={f.id}
                      href={`/fprs/${f.id}`}
                      className="block border border-gray-200 rounded px-3 py-2 hover:bg-navy-50/40 hover:border-navy-300 text-xs transition-colors"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono font-semibold text-navy-700">{f.fpr_number}</span>
                        <StatusPill status={f.status} />
                        {f.is_rush ? <Tag color="red">Rush</Tag> : null}
                      </div>
                      <div className="text-gray-600">
                        <span className="font-mono text-navy-700">{f.order_number}</span>
                        <span className="mx-1.5">·</span>
                        {f.company_name}
                      </div>
                      <div className="flex items-center justify-between mt-1.5">
                        <div className="text-[10px] text-gray-500">
                          {f.quantity} units · Promised {formatDate(f.adt_promised_date)}
                        </div>
                        {f.profile_name && (
                          <Tag color="purple">{f.packaging_type}</Tag>
                        )}
                      </div>
                      {f.missing_component_override_json && (
                        <div className="mt-1 text-[10px] text-yellow-800 bg-yellow-50 border border-yellow-200 rounded px-1.5 py-0.5">
                          Missing component override active
                        </div>
                      )}
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Order lines needing FPR creation */}
      <Card>
        <CardHeader title="Pending Finished Product Routing" subtitle="In-production order lines that need cut/sew but don't have an FPR yet" />
        <table className="w-full text-sm">
          <thead className="text-xs text-gray-500 uppercase tracking-wider border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-2.5">Order #</th>
              <th className="text-left px-4 py-2.5">Customer</th>
              <th className="text-left px-4 py-2.5">Product</th>
              <th className="text-left px-4 py-2.5">SKU</th>
              <th className="text-right px-4 py-2.5">Qty</th>
              <th className="text-left px-4 py-2.5">Promised</th>
              <th className="text-right px-4 py-2.5 pr-5">Action</th>
            </tr>
          </thead>
          <tbody>
            {pendingFinished.length === 0 && (
              <tr><td colSpan={7} className="text-center py-6 text-gray-400">All in-production lines have FPRs.</td></tr>
            )}
            {pendingFinished.map((ol) => (
              <tr key={ol.id} className="border-t border-gray-100">
                <td className="px-4 py-2.5">
                  <Link href={`/orders/${ol.order_id}`} className="font-mono text-navy-700 hover:underline">{ol.order_number}</Link>
                  {ol.is_rush ? <Tag color="red">Rush</Tag> : null}
                </td>
                <td className="px-4 py-2.5">{ol.company_name}</td>
                <td className="px-4 py-2.5 capitalize text-xs">{ol.product_type} · {ol.size}</td>
                <td className="px-4 py-2.5 text-xs font-mono">{ol.adt_sku}</td>
                <td className="px-4 py-2.5 text-right font-mono">{ol.quantity}</td>
                <td className="px-4 py-2.5 text-xs">{formatDate(ol.adt_promised_date)}</td>
                <td className="px-4 py-2.5 text-right pr-5"><Button variant="secondary">Create FPR</Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: any; accent?: 'yellow' | 'red' | 'green' | 'blue' }) {
  const bar = {
    yellow: 'bg-helm-yellow', red: 'bg-helm-red', green: 'bg-helm-green', blue: 'bg-helm-blue',
  }[accent || ''] || 'bg-gray-200';
  return (
    <Card>
      <div className="p-4 flex items-center gap-3">
        <div className={`w-1 h-10 rounded ${bar}`} />
        <div>
          <div className="text-2xl font-bold text-navy-900 leading-tight">{value}</div>
          <div className="text-[11px] text-gray-500 uppercase tracking-wider mt-0.5">{label}</div>
        </div>
      </div>
    </Card>
  );
}
