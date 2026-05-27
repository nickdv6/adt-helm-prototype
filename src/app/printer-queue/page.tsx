import Link from 'next/link';
import { getDb } from '@/lib/db';
import { Card, CardHeader, StatusPill, Tag, Button } from '@/components/ui';
import { formatDate, relativeTime } from '@/lib/utils';

// S29 Printer Queue (Julio)
// Per Julio's checklist: ink_set drives profile selection; printers grouped by location/ink set
// Per S23-S32.61: auto-routed PRs land here directly (no Jeannine review)
// Per S23-S32.60: 'Ready for Scheduling' is the gate to schedule onto a printer

export default function PrinterQueue() {
  const db = getDb();

  const printers = db.prepare(`
    SELECT id, name, model, ink_set, workstation_location, status, throughput_yards_per_hour
    FROM printers ORDER BY workstation_location, name
  `).all() as any[];

  // PRs ready to schedule (Jeannine has approved proof OR no proof needed)
  const ready = db.prepare(`
    SELECT pr.id, pr.pr_number, pr.fabric_id, pr.print_process, pr.planned_yardage,
           pr.is_click_and_print, pr.was_csv_auto_routed, pr.printer_id,
           ol.order_id, o.order_number, c.name as company_name, o.is_rush, o.adt_promised_date,
           f.name as fabric_name, d.plant_number
    FROM print_requests pr
    JOIN order_lines ol ON pr.order_line_id = ol.id
    JOIN orders o ON ol.order_id = o.id
    JOIN companies c ON o.company_id = c.id
    LEFT JOIN fabrics f ON pr.fabric_id = f.id
    LEFT JOIN designs d ON ol.design_id = d.id
    WHERE pr.status IN ('Ready for Scheduling', 'Scheduled')
    ORDER BY o.is_rush DESC, date(o.adt_promised_date) ASC LIMIT 50
  `).all() as any[];

  // Currently printing — grouped by printer
  const printing = db.prepare(`
    SELECT pr.id, pr.pr_number, pr.printer_id, pr.planned_yardage, pr.printed_yardage,
           pr.scheduled_at,
           o.order_number, c.name as company_name, o.is_rush,
           f.name as fabric_name
    FROM print_requests pr
    JOIN order_lines ol ON pr.order_line_id = ol.id
    JOIN orders o ON ol.order_id = o.id
    JOIN companies c ON o.company_id = c.id
    LEFT JOIN fabrics f ON pr.fabric_id = f.id
    WHERE pr.status = 'Printing'
  `).all() as any[];

  const counts = {
    ready: ready.length,
    printing: printing.length,
    rush_ready: ready.filter((r) => r.is_rush).length,
    overdue: ready.filter((r) => r.adt_promised_date && new Date(r.adt_promised_date) < new Date()).length,
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-navy-900">Printer Queue — Julio Vargas</h1>
        <p className="text-sm text-gray-500 mt-1">S29 · Ready-to-schedule + currently-printing across all printers</p>
      </header>

      <div className="grid grid-cols-4 gap-4">
        <Stat label="Ready to Schedule" value={counts.ready} accent="blue" />
        <Stat label="Currently Printing" value={counts.printing} accent="green" />
        <Stat label="Rush in Queue" value={counts.rush_ready} accent="red" />
        <Stat label="Past Due in Queue" value={counts.overdue} accent="yellow" />
      </div>

      {/* Printer cards — grouped per S29 spec */}
      <Card>
        <CardHeader title="Printers" subtitle="Per Julio's checklist — ink set drives profile selection" />
        <div className="grid grid-cols-3 gap-3 p-5">
          {printers.map((p) => {
            const onThis = printing.filter((pr) => pr.printer_id === p.id);
            const queuedThis = ready.filter((r) => r.printer_id === p.id);
            return (
              <div key={p.id} className="border border-gray-200 rounded p-3">
                <div className="flex items-start justify-between mb-1">
                  <div>
                    <div className="font-semibold text-sm">{p.name}</div>
                    <div className="text-[10px] text-gray-500">{p.workstation_location}</div>
                  </div>
                  <StatusPill status={p.status === 'running' ? 'Printing' : p.status === 'maintenance' ? 'Issue — Contact Us' : 'Validated'} />
                </div>
                <div className="text-[11px] text-gray-600 mb-2">
                  <span className="font-mono">{p.model}</span> · {p.ink_set}
                </div>
                <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">Now Printing</div>
                {onThis.length === 0 && <div className="text-xs text-gray-400 italic mb-2">Idle</div>}
                {onThis.map((pr) => (
                  <Link key={pr.id} href={`/print-requests/${pr.id}`} className="block text-xs mb-1 hover:bg-gray-50 -mx-1 px-1 py-0.5 rounded">
                    <span className="font-mono font-semibold text-navy-700">{pr.pr_number}</span>
                    <span className="text-gray-500 ml-1.5">{pr.printed_yardage || 0}/{pr.planned_yardage} yds</span>
                  </Link>
                ))}
                <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-1 mt-2">In Queue ({queuedThis.length})</div>
                {queuedThis.length === 0 && <div className="text-xs text-gray-400 italic">No PRs queued</div>}
                {queuedThis.slice(0, 3).map((pr) => (
                  <div key={pr.id} className="text-xs flex items-center gap-1 mb-0.5">
                    <span className="font-mono text-navy-700">{pr.pr_number}</span>
                    {pr.is_rush ? <Tag color="red">Rush</Tag> : null}
                  </div>
                ))}
                {queuedThis.length > 3 && <div className="text-[10px] text-gray-400 mt-0.5">+{queuedThis.length - 3} more</div>}
              </div>
            );
          })}
        </div>
      </Card>

      {/* Unassigned queue — needs printer + scheduling */}
      <Card>
        <CardHeader title="Unassigned / Pending Schedule" subtitle="Drag onto a printer to schedule · rush surfaces to top" />
        <table className="w-full text-sm">
          <thead className="text-xs text-gray-500 uppercase tracking-wider border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-2.5">PR #</th>
              <th className="text-left px-4 py-2.5">Order #</th>
              <th className="text-left px-4 py-2.5">Customer</th>
              <th className="text-left px-4 py-2.5">Fabric</th>
              <th className="text-left px-4 py-2.5">Process</th>
              <th className="text-right px-4 py-2.5">Yds</th>
              <th className="text-left px-4 py-2.5">Promised</th>
              <th className="text-left px-4 py-2.5">Flags</th>
              <th className="text-right px-4 py-2.5 pr-5">Action</th>
            </tr>
          </thead>
          <tbody>
            {ready.length === 0 && (
              <tr><td colSpan={9} className="text-center py-8 text-gray-400">Queue is clear.</td></tr>
            )}
            {ready.map((pr) => (
              <tr key={pr.id} className="border-t border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-2.5">
                  <Link href={`/print-requests/${pr.id}`} className="font-mono text-navy-700 hover:underline font-semibold">{pr.pr_number}</Link>
                </td>
                <td className="px-4 py-2.5">
                  <Link href={`/orders/${pr.order_id}`} className="font-mono text-navy-700 hover:underline">{pr.order_number}</Link>
                </td>
                <td className="px-4 py-2.5">{pr.company_name}</td>
                <td className="px-4 py-2.5 text-xs">{pr.fabric_name}</td>
                <td className="px-4 py-2.5 text-xs font-mono">{pr.print_process}</td>
                <td className="px-4 py-2.5 text-right font-mono">{pr.planned_yardage}</td>
                <td className="px-4 py-2.5 text-xs">{formatDate(pr.adt_promised_date)}</td>
                <td className="px-4 py-2.5">
                  {pr.is_rush ? <Tag color="red">Rush</Tag> : null}
                  {pr.is_click_and_print ? <Tag color="purple">C+P</Tag> : null}
                  {pr.was_csv_auto_routed ? <Tag color="blue">Auto</Tag> : null}
                </td>
                <td className="px-4 py-2.5 text-right pr-5">
                  <Button variant="secondary">Schedule</Button>
                </td>
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
