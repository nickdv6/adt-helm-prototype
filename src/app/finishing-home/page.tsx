// S08 Finishing Home — Lucio Hernandez
import Link from 'next/link';
import { getDb } from '@/lib/db';
import { RoleHomeShell } from '@/components/role-home';
import { StatusPill, Tag } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default function FinishingHome() {
  const db = getDb();
  const me = db.prepare(`SELECT * FROM users WHERE primary_role='finishing' LIMIT 1`).get() as any;

  const printedAwaitingFinish = db.prepare(`
    SELECT pr.id, pr.pr_number, pr.printed_yardage, p.name as printer_name, p.ink_set,
           f.name as fabric_name, o.order_number, c.name as company_name
    FROM print_requests pr
    LEFT JOIN printers p ON pr.printer_id = p.id
    LEFT JOIN fabrics f ON pr.fabric_id = f.id
    JOIN order_lines ol ON pr.order_line_id = ol.id
    JOIN orders o ON ol.order_id = o.id
    JOIN companies c ON o.company_id = c.id
    WHERE pr.status = 'Printed'
    ORDER BY pr.created_at DESC
    LIMIT 15
  `).all() as any[];

  const packedToday = db.prepare(`
    SELECT COUNT(*) as n FROM pr_rolls WHERE date(packed_at) = date('now')
  `).get() as any;
  const yardsPackedToday = db.prepare(`
    SELECT COALESCE(SUM(yards), 0) as y FROM pr_rolls WHERE date(packed_at) = date('now')
  `).get() as any;

  return (
    <RoleHomeShell
      userName={me?.full_name ?? 'Lucio'}
      userRole="Finishing"
      greeting="Printed PRs awaiting heat-press / wash / coating, plus today's pack-out throughput."
      kpis={[
        { label: 'Awaiting finish', value: printedAwaitingFinish.length, accent: 'yellow' },
        { label: 'Rolls packed today', value: packedToday?.n ?? 0, accent: 'green' },
        { label: 'Yards packed today', value: (yardsPackedToday?.y ?? 0).toFixed(0) },
      ]}
      queueTitle="PRs awaiting finishing"
      queueSubtitle="Printed and waiting for next station — heat-press, wash, coating"
      queue={
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
              <tr>
                <th className="text-left px-4 py-2.5">PR</th>
                <th className="text-left px-4 py-2.5">Ink Set</th>
                <th className="text-left px-4 py-2.5">Fabric</th>
                <th className="text-left px-4 py-2.5">Yards</th>
                <th className="text-left px-4 py-2.5">Order</th>
              </tr>
            </thead>
            <tbody>
              {printedAwaitingFinish.map((p) => (
                <tr key={p.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-2.5 font-mono text-xs">
                    <Link href={`/print-requests/${p.id}`} className="text-navy-700 font-semibold hover:underline">{p.pr_number}</Link>
                  </td>
                  <td className="px-4 py-2.5"><Tag>{p.ink_set}</Tag></td>
                  <td className="px-4 py-2.5 text-xs">{p.fabric_name}</td>
                  <td className="px-4 py-2.5 font-mono text-xs">{p.printed_yardage}</td>
                  <td className="px-4 py-2.5 text-xs">{p.company_name} · <span className="font-mono">{p.order_number}</span></td>
                </tr>
              ))}
              {printedAwaitingFinish.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-500 italic">Caught up — no printed PRs waiting on you.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      }
      activityTitle="Recent rolls packed"
      activity={
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
              <tr>
                <th className="text-left px-4 py-2.5">Roll #</th>
                <th className="text-left px-4 py-2.5">PR</th>
                <th className="text-left px-4 py-2.5">Yards</th>
                <th className="text-left px-4 py-2.5">Packed</th>
              </tr>
            </thead>
            <tbody>
              {(db.prepare(`
                SELECT r.roll_number, r.yards, r.packed_at, pr.pr_number, pr.id as pr_id
                FROM pr_rolls r JOIN print_requests pr ON r.pr_id = pr.id
                ORDER BY r.packed_at DESC LIMIT 12
              `).all() as any[]).map((r) => (
                <tr key={r.roll_number} className="border-t border-gray-100">
                  <td className="px-4 py-2.5 font-mono text-xs font-semibold">{r.roll_number}</td>
                  <td className="px-4 py-2.5 font-mono text-xs"><Link href={`/print-requests/${r.pr_id}`} className="text-navy-700 hover:underline">{r.pr_number}</Link></td>
                  <td className="px-4 py-2.5 font-mono text-xs">{r.yards}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-500">{r.packed_at ? new Date(r.packed_at).toLocaleString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      }
      crossLinks={[
        { label: 'Batch Ticket · Heat Press', href: '/batch-ticket', description: 'Group PRs into one heat-press run' },
        { label: 'Created Rolls', href: '/rolls', description: 'All rolls registry' },
        { label: 'Shipping', href: '/shipping', description: 'Hand off packed rolls' },
        { label: 'Packing Correction', href: '/packing-correction', description: 'Fix mis-packs' },
      ]}
    />
  );
}
