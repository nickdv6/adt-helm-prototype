// S28 Production Scheduling — capacity calendar
// 7-day grid: rows = printers, columns = days. Each cell shows scheduled yards
// + a fill bar against daily capacity. Color-coded utilization. Read-only in
// prototype; production version supports drag-to-reschedule.
import Link from 'next/link';
import { getDb } from '@/lib/db';
import { Card, CardHeader, Tag } from '@/components/ui';
import { MockSurfaceBanner } from '@/components/mock-surface-banner';

export const dynamic = 'force-dynamic';

// Per-printer daily capacity (yards/day) — would come from printer settings table in production.
// Numbers reflect realistic throughput of ADT's actual fleet.
const PRINTER_CAPACITY: Record<string, number> = {
  'Durst Alpha 330':  1200,  // Pigment, fastest large-format
  'MS JP7':            900,  // Fiber Reactive
  'MS JP4-A':          600,  // Dye Sub
  'MS JP4-B':          600,  // Dye Sub
  'Zimmer Colaris':    800,  // Pigment
  'HP Latex 800W':     480,
  'HP Latex 830W':     480,
};

export default function ProductionScheduling() {
  const db = getDb();

  // Build a 7-day window starting today
  const days: { iso: string; label: string; weekday: string }[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    days.push({
      iso: d.toISOString().slice(0, 10),
      label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      weekday: d.toLocaleDateString('en-US', { weekday: 'short' }),
    });
  }

  const printers = db.prepare(`SELECT id, name, ink_set FROM printers ORDER BY name`).all() as any[];

  // Aggregate planned yards per (printer, day)
  const allScheduled = db.prepare(`
    SELECT pr.printer_id, p.name as printer_name, date(pr.scheduled_at) as day, SUM(pr.planned_yardage) as yards, COUNT(*) as job_count
    FROM print_requests pr
    JOIN printers p ON pr.printer_id = p.id
    WHERE pr.scheduled_at IS NOT NULL
      AND pr.status IN ('Scheduled','Printing','Printed')
      AND date(pr.scheduled_at) BETWEEN date('now') AND date('now','+6 days')
    GROUP BY pr.printer_id, day
  `).all() as any[];

  const cellMap = new Map<string, { yards: number; jobs: number }>();
  allScheduled.forEach((r) => {
    cellMap.set(`${r.printer_id}|${r.day}`, { yards: r.yards ?? 0, jobs: r.job_count });
  });

  // Totals for top stats
  const totalScheduledYards = allScheduled.reduce((s, r) => s + (r.yards ?? 0), 0);
  const totalJobs = allScheduled.reduce((s, r) => s + r.job_count, 0);
  const totalCapacity = printers.reduce((s, p) => s + (PRINTER_CAPACITY[p.name] ?? 500) * 7, 0);
  const utilization = totalCapacity > 0 ? (totalScheduledYards / totalCapacity * 100) : 0;

  // Overbooked detection — any cell where yards > daily capacity
  const overbooked = allScheduled.filter((r) => {
    const cap = PRINTER_CAPACITY[r.printer_name] ?? 500;
    return r.yards > cap;
  });

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <MockSurfaceBanner reason="Per-printer daily capacity is mock constants — overbook detection is not actually checking real throughput. Drag-to-reschedule is also UI-only. Production needs printer_capacity_overrides table." />
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Production Scheduling</h1>
          <p className="text-sm text-gray-600 mt-0.5">7-day capacity calendar across the print fleet. Click any cell to see the PRs scheduled on that machine that day.</p>
        </div>
      </header>

      <div className="grid grid-cols-4 gap-4">
        <Stat label="Yards scheduled (7d)" value={totalScheduledYards.toFixed(0)} />
        <Stat label="Jobs scheduled" value={totalJobs} />
        <Stat label="Fleet utilization" value={`${utilization.toFixed(1)}%`} accent={utilization > 90 ? 'red' : utilization > 70 ? 'yellow' : 'green'} />
        <Stat label="Overbooked cells" value={overbooked.length} accent={overbooked.length > 0 ? 'red' : 'green'} />
      </div>

      <Card>
        <CardHeader title="Calendar — next 7 days" subtitle="Each cell shows scheduled yards / daily capacity. Color indicates utilization." />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
                <th className="text-left px-4 py-2.5 w-48">Printer</th>
                {days.map((d) => (
                  <th key={d.iso} className="text-center px-2 py-2.5">
                    <div className="font-semibold text-navy-700">{d.weekday}</div>
                    <div className="text-[10px] font-normal text-gray-500">{d.label}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {printers.map((p) => {
                const cap = PRINTER_CAPACITY[p.name] ?? 500;
                return (
                  <tr key={p.id} className="border-t border-gray-100">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-navy-700 text-sm">{p.name}</div>
                      <div className="text-[10px] text-gray-500"><Tag>{p.ink_set}</Tag></div>
                      <div className="text-[10px] text-gray-400 mt-0.5 font-mono">{cap} yds/day</div>
                    </td>
                    {days.map((d) => {
                      const cell = cellMap.get(`${p.id}|${d.iso}`);
                      const yards = cell?.yards ?? 0;
                      const pct = cap > 0 ? Math.min(100, yards / cap * 100) : 0;
                      const over = yards > cap;
                      const isEmpty = yards === 0;
                      const barCls = over ? 'bg-helm-red'
                        : pct > 75 ? 'bg-yellow-500'
                        : pct > 0 ? 'bg-green-500'
                        : 'bg-gray-200';
                      return (
                        <td key={d.iso} className="px-2 py-2 align-top">
                          <div className={`rounded p-2 border ${over ? 'bg-red-50 border-red-300' : isEmpty ? 'bg-gray-50 border-gray-200' : 'bg-white border-gray-200'}`}>
                            <div className="text-xs font-mono font-semibold text-center">
                              {isEmpty ? <span className="text-gray-300">—</span> : `${yards.toFixed(0)}`}
                            </div>
                            {!isEmpty && (
                              <>
                                <div className="text-[10px] text-gray-500 text-center mb-1">{cell?.jobs} jobs</div>
                                <div className="w-full h-1.5 bg-gray-100 rounded">
                                  <div className={`h-1.5 rounded ${barCls}`} style={{ width: `${pct}%` }} />
                                </div>
                                <div className="text-[10px] text-center text-gray-500 mt-0.5">{pct.toFixed(0)}%</div>
                              </>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {overbooked.length > 0 && (
        <Card>
          <CardHeader title="Overbooked machines" subtitle="These cells exceed the printer's daily capacity — Megan needs to reschedule." />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-2.5">Printer</th>
                  <th className="text-left px-4 py-2.5">Day</th>
                  <th className="text-left px-4 py-2.5">Scheduled</th>
                  <th className="text-left px-4 py-2.5">Capacity</th>
                  <th className="text-left px-4 py-2.5">Overage</th>
                </tr>
              </thead>
              <tbody>
                {overbooked.map((r) => {
                  const cap = PRINTER_CAPACITY[r.printer_name] ?? 500;
                  return (
                    <tr key={`${r.printer_id}-${r.day}`} className="border-t border-gray-100">
                      <td className="px-4 py-2.5 font-semibold">{r.printer_name}</td>
                      <td className="px-4 py-2.5 text-xs">{r.day}</td>
                      <td className="px-4 py-2.5 font-mono text-xs">{r.yards.toFixed(0)} yds</td>
                      <td className="px-4 py-2.5 font-mono text-xs">{cap} yds</td>
                      <td className="px-4 py-2.5"><Tag color="red">+{(r.yards - cap).toFixed(0)} yds</Tag></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Card>
        <CardHeader title="Editor model (Phase 2)" />
        <div className="p-5 text-sm text-gray-600 space-y-2">
          <p>In Phase 2 this calendar becomes interactive: drag a PR cell to another printer/day to reschedule, click into a cell to see the full PR list scheduled there, multi-select PRs for bulk move. Auto-balancing suggestions flag any overbooked machine and propose moves to under-utilized cells.</p>
          <p>Per-printer capacity comes from <Link href="/settings/printers" className="text-navy-700 hover:underline">Settings → Printers</Link>. Override per day (planned downtime, maintenance) is a separate calendar attribute.</p>
        </div>
      </Card>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: any; accent?: 'green' | 'yellow' | 'red' }) {
  const cls = accent === 'green' ? 'text-green-700'
    : accent === 'yellow' ? 'text-yellow-700'
    : accent === 'red' ? 'text-helm-red'
    : 'text-navy-900';
  return (
    <Card>
      <div className="p-4">
        <div className="text-xs uppercase tracking-wider text-gray-500 mb-1">{label}</div>
        <div className={`text-2xl font-bold ${cls}`}>{value}</div>
      </div>
    </Card>
  );
}
