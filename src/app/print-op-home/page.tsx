// S07 Print Operator Home — Julio Vargas (floor user)
// Built for big touch targets + minimal chrome. Floor screen pattern.
import Link from 'next/link';
import { getDb } from '@/lib/db';
import { RoleHomeShell } from '@/components/role-home';
import { StatusPill, Tag } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default function PrintOpHome() {
  const db = getDb();
  const me = db.prepare(`SELECT * FROM users WHERE primary_role='print_op' LIMIT 1`).get() as any;

  const runningNow = db.prepare(`
    SELECT pr.id, pr.pr_number, pr.planned_yardage, pr.printed_yardage,
           p.name as printer_name, f.name as fabric_name, o.order_number, c.name as company_name
    FROM print_requests pr
    LEFT JOIN printers p ON pr.printer_id = p.id
    LEFT JOIN fabrics f ON pr.fabric_id = f.id
    JOIN order_lines ol ON pr.order_line_id = ol.id
    JOIN orders o ON ol.order_id = o.id
    JOIN companies c ON o.company_id = c.id
    WHERE pr.status = 'Printing'
    LIMIT 8
  `).all() as any[];

  const upNext = db.prepare(`
    SELECT pr.id, pr.pr_number, pr.planned_yardage,
           p.name as printer_name, f.name as fabric_name, o.order_number, c.name as company_name
    FROM print_requests pr
    LEFT JOIN printers p ON pr.printer_id = p.id
    LEFT JOIN fabrics f ON pr.fabric_id = f.id
    JOIN order_lines ol ON pr.order_line_id = ol.id
    JOIN orders o ON ol.order_id = o.id
    JOIN companies c ON o.company_id = c.id
    WHERE pr.status = 'Scheduled'
    ORDER BY pr.scheduled_at ASC
    LIMIT 12
  `).all() as any[];

  return (
    <RoleHomeShell
      userName={me?.full_name ?? 'Julio'}
      userRole="Print Operator"
      greeting="Floor screen — running now, up next, and where to scan."
      kpis={[
        { label: 'Running now', value: runningNow.length, accent: 'blue' },
        { label: 'Up next today', value: upNext.length },
        { label: 'My printers', value: '4' },
      ]}
      queueTitle="Up Next — scheduled to start"
      queueSubtitle="Pull from the front of this queue when a machine opens"
      queue={
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
              <tr>
                <th className="text-left px-4 py-2.5">PR</th>
                <th className="text-left px-4 py-2.5">Printer</th>
                <th className="text-left px-4 py-2.5">Fabric</th>
                <th className="text-left px-4 py-2.5">Yards</th>
                <th className="text-left px-4 py-2.5">Order</th>
              </tr>
            </thead>
            <tbody>
              {upNext.map((p) => (
                <tr key={p.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-sm">
                    <Link href={`/print-requests/${p.id}`} className="text-navy-700 font-bold hover:underline">{p.pr_number}</Link>
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold">{p.printer_name}</td>
                  <td className="px-4 py-3 text-sm">{p.fabric_name}</td>
                  <td className="px-4 py-3 font-mono">{p.planned_yardage}</td>
                  <td className="px-4 py-3 text-xs">{p.company_name} · <span className="font-mono">{p.order_number}</span></td>
                </tr>
              ))}
              {upNext.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-500 italic">Queue is empty.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      }
      activityTitle="Running Now"
      activity={
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
              <tr>
                <th className="text-left px-4 py-2.5">PR</th>
                <th className="text-left px-4 py-2.5">Printer</th>
                <th className="text-left px-4 py-2.5">Fabric</th>
                <th className="text-left px-4 py-2.5">Progress</th>
              </tr>
            </thead>
            <tbody>
              {runningNow.map((p) => (
                <tr key={p.id} className="border-t border-gray-100">
                  <td className="px-4 py-3 font-mono text-sm">
                    <Link href={`/print-requests/${p.id}`} className="text-navy-700 font-bold hover:underline">{p.pr_number}</Link>
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold">{p.printer_name}</td>
                  <td className="px-4 py-3 text-sm">{p.fabric_name}</td>
                  <td className="px-4 py-3 font-mono text-xs">
                    {p.printed_yardage ?? 0} / {p.planned_yardage} yds
                  </td>
                </tr>
              ))}
              {runningNow.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-500 italic">No PRs currently printing.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      }
      crossLinks={[
        { label: 'Printer Queue', href: '/printer-queue', description: 'Full per-machine queue' },
        { label: 'CUT Station', href: '/cut-station', description: 'Scan & label print' },
        { label: 'Print Request Detail', href: '/print-requests', description: 'Search by PR#' },
        { label: 'Daily Production Dashboard', href: '/dashboards/daily-production', description: 'Floor overview' },
      ]}
    />
  );
}
