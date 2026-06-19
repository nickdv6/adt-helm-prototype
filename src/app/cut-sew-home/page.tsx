// S09 Cut/Sew Home — Yuliana Cruz
import Link from 'next/link';
import { getDb } from '@/lib/db';
import { RoleHomeShell } from '@/components/role-home';
import { StatusPill, Tag } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default function CutSewHome() {
  const db = getDb();
  const me = db.prepare(`SELECT * FROM users WHERE primary_role='cut_sew' LIMIT 1`).get() as any;

  const openFPRs = db.prepare(`
    SELECT f.id, f.fpr_number, f.status, ol.quantity, s.product_type,
           o.order_number, c.name as company_name
    FROM fprs f
    JOIN order_lines ol ON f.order_line_id = ol.id
    JOIN skus s ON ol.sku_id = s.id
    JOIN orders o ON ol.order_id = o.id
    JOIN companies c ON o.company_id = c.id
    WHERE f.status NOT IN ('Complete','Cancelled','Closed')
    ORDER BY f.id DESC LIMIT 15
  `).all() as any[];

  const completedToday = db.prepare(`SELECT COUNT(*) as n FROM fprs WHERE status='Complete'`).get() as any;
  const cutLabelsToday = db.prepare(`
    SELECT COUNT(*) as n FROM cut_labels WHERE date(printed_at) = date('now')
  `).get() as any;

  return (
    <RoleHomeShell
      userName={me?.full_name ?? 'Yuliana'}
      userRole="Cut/Sew"
      greeting="Finished Product Requests in your queue + labels printed today."
      kpis={[
        { label: 'Open FPRs', value: openFPRs.length, accent: 'yellow' },
        { label: 'Completed (lifetime)', value: completedToday?.n ?? 0, accent: 'green' },
        { label: 'Labels printed today', value: cutLabelsToday?.n ?? 0, accent: 'blue' },
      ]}
      queueTitle="My FPR Queue"
      queueSubtitle="Cut, sew, assemble — open the FPR detail for the Tech Sheet pop-up"
      queue={
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
              <tr>
                <th className="text-left px-4 py-2.5">FPR</th>
                <th className="text-left px-4 py-2.5">Product</th>
                <th className="text-left px-4 py-2.5">Qty</th>
                <th className="text-left px-4 py-2.5">Status</th>
                <th className="text-left px-4 py-2.5">Order</th>
              </tr>
            </thead>
            <tbody>
              {openFPRs.map((f) => (
                <tr key={f.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-2.5 font-mono text-xs">
                    <Link href={`/fprs/${f.id}`} className="text-navy-700 font-semibold hover:underline">{f.fpr_number}</Link>
                  </td>
                  <td className="px-4 py-2.5 text-xs"><Tag>{f.product_type}</Tag></td>
                  <td className="px-4 py-2.5 font-mono text-xs">{f.quantity}</td>
                  <td className="px-4 py-2.5"><StatusPill status={f.status} /></td>
                  <td className="px-4 py-2.5 text-xs">{f.company_name} · <span className="font-mono">{f.order_number}</span></td>
                </tr>
              ))}
              {openFPRs.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-500 italic">Queue empty.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      }
      activityTitle="Recent CUT labels"
      activity={
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
              <tr>
                <th className="text-left px-4 py-2.5">QR Payload</th>
                <th className="text-left px-4 py-2.5">Printer</th>
                <th className="text-left px-4 py-2.5">Printed</th>
              </tr>
            </thead>
            <tbody>
              {(db.prepare(`SELECT * FROM cut_labels ORDER BY printed_at DESC LIMIT 10`).all() as any[]).map((l) => (
                <tr key={l.id} className="border-t border-gray-100">
                  <td className="px-4 py-2.5 font-mono text-xs">{l.qr_payload}</td>
                  <td className="px-4 py-2.5 text-xs">{l.printer_name ?? '—'}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-500">{l.printed_at ? new Date(l.printed_at).toLocaleString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      }
      crossLinks={[
        { label: 'Cut/Sew Queue', href: '/cut-sew', description: 'Full FPR queue with filters' },
        { label: 'CUT Station · Scan & Label', href: '/cut-station', description: 'Scan PR → print labels' },
        { label: 'Fulfillment Requests', href: '/fulfillment-requests', description: 'All FPRs' },
        { label: 'Packaging Profiles', href: '/packaging-profiles', description: 'Per-customer pack specs' },
      ]}
    />
  );
}
