// S44 Daily Production Dashboard
// Production manager / floor lead view. Today's plan + actual vs planned + late + blocked.
import Link from 'next/link';
import { getDb } from '@/lib/db';
import { Card, CardHeader, Tag, StatusPill } from '@/components/ui';
import { formatDate, relativeTime } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default function DailyProduction() {
  const db = getDb();

  // Today's scheduled PRs (running + in queue)
  const today = db.prepare(`
    SELECT pr.id, pr.pr_number, pr.status, pr.planned_yardage, pr.printed_yardage,
           p.name as printer_name, p.ink_set, u.full_name as colorist_name,
           f.name as fabric_name, o.order_number, c.name as company_name,
           o.adt_promised_date
    FROM print_requests pr
    LEFT JOIN printers p ON pr.printer_id = p.id
    LEFT JOIN users u ON pr.colorist_user_id = u.id
    LEFT JOIN fabrics f ON pr.fabric_id = f.id
    JOIN order_lines ol ON pr.order_line_id = ol.id
    JOIN orders o ON ol.order_id = o.id
    JOIN companies c ON o.company_id = c.id
    WHERE pr.status IN ('Scheduled','Printing','Printed')
    ORDER BY pr.scheduled_at ASC
    LIMIT 40
  `).all() as any[];

  // Per-printer load
  const byPrinter = db.prepare(`
    SELECT p.name, p.ink_set,
           SUM(CASE WHEN pr.status IN ('Scheduled','Printing') THEN pr.planned_yardage ELSE 0 END) as queued_yards,
           COUNT(CASE WHEN pr.status = 'Printing' THEN 1 END) as running,
           COUNT(CASE WHEN pr.status = 'Scheduled' THEN 1 END) as queued
    FROM printers p
    LEFT JOIN print_requests pr ON pr.printer_id = p.id
    GROUP BY p.id ORDER BY p.name
  `).all() as any[];

  // Top of stat row
  const todayCount = today.length;
  const printing = today.filter((p) => p.status === 'Printing').length;
  const yardsPlanned = today.reduce((s, p) => s + (p.planned_yardage ?? 0), 0);
  const yardsPrinted = today.reduce((s, p) => s + (p.printed_yardage ?? 0), 0);
  const late = today.filter((p) => p.adt_promised_date && new Date(p.adt_promised_date) < new Date()).length;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-navy-900">Daily Production Dashboard</h1>
        <p className="text-sm text-gray-600 mt-0.5">Today&apos;s scheduled print activity across the floor — updated live as PRs change state.</p>
        <p className="text-[11px] text-gray-500 mt-1 italic">
          Slice: PRs where status IN (Scheduled, Printing, Printed). Different from <Link href="/megan" className="text-navy-700 hover:underline">Megan</Link>&apos;s &quot;due in 7 business days&quot; slice and <Link href="/printer-queue" className="text-navy-700 hover:underline">Printer Queue</Link>&apos;s per-machine queues.
        </p>
      </header>

      <div className="grid grid-cols-5 gap-4">
        <Stat label="PRs in scope today" value={todayCount} />
        <Stat label="Currently printing" value={printing} accent="blue" />
        <Stat label="Yards planned" value={yardsPlanned.toFixed(0)} />
        <Stat label="Yards printed" value={yardsPrinted.toFixed(0)} accent="green" />
        <Stat label="Late vs promised" value={late} accent={late > 0 ? 'red' : 'green'} />
      </div>

      <Card>
        <CardHeader title="Printer Load" subtitle="Live queue + running state per machine" />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
              <tr>
                <th className="text-left px-4 py-2.5">Printer</th>
                <th className="text-left px-4 py-2.5">Ink Set</th>
                <th className="text-left px-4 py-2.5">Running</th>
                <th className="text-left px-4 py-2.5">Queued</th>
                <th className="text-left px-4 py-2.5">Total Queued Yards</th>
              </tr>
            </thead>
            <tbody>
              {byPrinter.map((p) => (
                <tr key={p.name} className="border-t border-gray-100">
                  <td className="px-4 py-2.5 font-semibold">{p.name}</td>
                  <td className="px-4 py-2.5"><Tag>{p.ink_set}</Tag></td>
                  <td className="px-4 py-2.5">
                    {p.running > 0 ? <Tag color="blue">{p.running} running</Tag> : <span className="text-gray-400 text-xs">idle</span>}
                  </td>
                  <td className="px-4 py-2.5 font-mono">{p.queued}</td>
                  <td className="px-4 py-2.5 font-mono">{p.queued_yards?.toFixed(0) ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <CardHeader title="Today's PRs" subtitle="Scheduled → Printing → Printed (top 40)" />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
              <tr>
                <th className="text-left px-4 py-2.5">PR #</th>
                <th className="text-left px-4 py-2.5">Status</th>
                <th className="text-left px-4 py-2.5">Customer · Order</th>
                <th className="text-left px-4 py-2.5">Fabric</th>
                <th className="text-left px-4 py-2.5">Printer</th>
                <th className="text-left px-4 py-2.5">Colorist</th>
                <th className="text-left px-4 py-2.5">Yards</th>
                <th className="text-left px-4 py-2.5">Promised</th>
              </tr>
            </thead>
            <tbody>
              {today.map((p) => {
                const lateFlag = p.adt_promised_date && new Date(p.adt_promised_date) < new Date();
                return (
                  <tr key={p.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-mono text-xs">
                      <Link href={`/print-requests/${p.id}`} className="text-navy-700 font-semibold hover:underline">{p.pr_number}</Link>
                    </td>
                    <td className="px-4 py-2.5"><StatusPill status={p.status} /></td>
                    <td className="px-4 py-2.5 text-xs">{p.company_name} · <span className="font-mono">{p.order_number}</span></td>
                    <td className="px-4 py-2.5 text-xs">{p.fabric_name}</td>
                    <td className="px-4 py-2.5 text-xs">{p.printer_name}</td>
                    <td className="px-4 py-2.5 text-xs">{p.colorist_name ?? <span className="text-gray-300">—</span>}</td>
                    <td className="px-4 py-2.5 font-mono text-xs">{p.printed_yardage ?? 0}/{p.planned_yardage}</td>
                    <td className={`px-4 py-2.5 text-xs ${lateFlag ? 'text-helm-red font-semibold' : 'text-gray-600'}`}>
                      {p.adt_promised_date ? formatDate(p.adt_promised_date) : <span className="text-gray-300">—</span>}
                      {lateFlag && <span className="ml-1">⚠</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: any; accent?: 'blue' | 'green' | 'red' }) {
  const accentCls = accent === 'blue' ? 'text-navy-700'
    : accent === 'green' ? 'text-green-700'
    : accent === 'red' ? 'text-helm-red'
    : 'text-navy-900';
  return (
    <Card>
      <div className="p-4">
        <div className="text-xs uppercase tracking-wider text-gray-500 mb-1">{label}</div>
        <div className={`text-2xl font-bold ${accentCls}`}>{value}</div>
      </div>
    </Card>
  );
}
