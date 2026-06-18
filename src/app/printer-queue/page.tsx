import Link from 'next/link';
import { getDb } from '@/lib/db';
import { Card, CardHeader, StatusPill, Tag, Button } from '@/components/ui';
import { formatDate, relativeTime } from '@/lib/utils';

// S29 Printer Queue (Julio)
// Per Julio's checklist: ink_set drives profile selection; printers grouped by location/ink set
// Per S23-S32.61: auto-routed PRs land here directly (no Jeannine review)
// Per S23-S32.60: 'Ready for Scheduling' is the gate to schedule onto a printer
// Per WHY (Megan): per-printer changeover times matter; Durst Alpha is long-changeover; batching by fabric
// minimizes setup waste. Helm groups Ready PRs by fabric and suggests a printer per batch so Julio can
// schedule whole runs at once instead of PR-by-PR.

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
           pr.scheduled_at, pr.fabric_id,
           o.order_number, c.name as company_name, o.is_rush,
           f.name as fabric_name
    FROM print_requests pr
    JOIN order_lines ol ON pr.order_line_id = ol.id
    JOIN orders o ON ol.order_id = o.id
    JOIN companies c ON o.company_id = c.id
    LEFT JOIN fabrics f ON pr.fabric_id = f.id
    WHERE pr.status = 'Printing'
  `).all() as any[];

  // --- Fabric batching intelligence ---
  // Group Ready PRs by fabric_id. Each group becomes a suggested batch.
  type FabricBatch = {
    fabric_id: number | null;
    fabric_name: string;
    prs: any[];
    total_yds: number;
    pr_count: number;
    rush_count: number;
    soonest_due: string | null;
    suggested_printer: any | null;
    suggested_reason: string;
    can_slip_into: any | null;  // a currently-running printer with same fabric loaded
  };

  const printerById = new Map(printers.map((p) => [p.id, p]));
  const fabricGroups = new Map<string, FabricBatch>();
  for (const pr of ready) {
    const key = pr.fabric_id ? String(pr.fabric_id) : 'unknown';
    if (!fabricGroups.has(key)) {
      fabricGroups.set(key, {
        fabric_id: pr.fabric_id,
        fabric_name: pr.fabric_name || 'Unknown fabric',
        prs: [],
        total_yds: 0,
        pr_count: 0,
        rush_count: 0,
        soonest_due: null,
        suggested_printer: null,
        suggested_reason: '',
        can_slip_into: null,
      });
    }
    const g = fabricGroups.get(key)!;
    g.prs.push(pr);
    g.total_yds += pr.planned_yardage || 0;
    g.pr_count += 1;
    if (pr.is_rush) g.rush_count += 1;
    if (pr.adt_promised_date && (!g.soonest_due || pr.adt_promised_date < g.soonest_due)) {
      g.soonest_due = pr.adt_promised_date;
    }
  }

  // For each fabric group, pick a recommended printer.
  // Heuristic: (1) if any printer already runs PRs of this fabric, prefer it (slip-in candidate);
  // (2) otherwise, the printer with the most pre-assigned ready PRs of this fabric;
  // (3) otherwise, the first idle printer of matching print_process / ink_set;
  // (4) otherwise, the first printer overall.
  for (const g of fabricGroups.values()) {
    // (1) slip-in — printer currently printing this fabric
    const runningWithFabric = printing.find((p) => p.fabric_id === g.fabric_id);
    if (runningWithFabric) {
      g.can_slip_into = printerById.get(runningWithFabric.printer_id);
      g.suggested_printer = g.can_slip_into;
      g.suggested_reason = `Slip-in candidate — ${g.can_slip_into?.name || 'printer'} currently runs this fabric (zero changeover)`;
      continue;
    }
    // (2) most pre-assigned
    const assignedCounts = new Map<number, number>();
    for (const pr of g.prs) {
      if (pr.printer_id) assignedCounts.set(pr.printer_id, (assignedCounts.get(pr.printer_id) || 0) + 1);
    }
    if (assignedCounts.size > 0) {
      const topId = [...assignedCounts.entries()].sort((a, b) => b[1] - a[1])[0][0];
      g.suggested_printer = printerById.get(topId);
      g.suggested_reason = `${assignedCounts.get(topId)} PR(s) in this batch already pre-assigned here`;
      continue;
    }
    // (3) idle printer
    const idle = printers.find((p) => p.status !== 'maintenance' && !printing.some((pp) => pp.printer_id === p.id));
    if (idle) {
      g.suggested_printer = idle;
      g.suggested_reason = `${idle.name} is idle and available`;
      continue;
    }
    // (4) first printer
    g.suggested_printer = printers[0] || null;
    g.suggested_reason = g.suggested_printer ? `Default — review printer compatibility before confirming` : 'No printer available';
  }

  const batches = [...fabricGroups.values()].sort((a, b) => {
    // Rush batches first, then earliest due, then largest batch
    if (a.rush_count !== b.rush_count) return b.rush_count - a.rush_count;
    if (a.soonest_due && b.soonest_due) return a.soonest_due.localeCompare(b.soonest_due);
    if (a.soonest_due) return -1;
    if (b.soonest_due) return 1;
    return b.total_yds - a.total_yds;
  });

  // Re-order flat unassigned list: fabric grouped, then rush, then due date — so the flat
  // view naturally tells the same batching story as the suggested-batch cards.
  const readyByFabric = [...ready].sort((a, b) => {
    const fa = a.fabric_name || 'ZZZ';
    const fb = b.fabric_name || 'ZZZ';
    if (fa !== fb) return fa.localeCompare(fb);
    if (a.is_rush !== b.is_rush) return b.is_rush - a.is_rush;
    return (a.adt_promised_date || '').localeCompare(b.adt_promised_date || '');
  });
  const changeoversAvoided = ready.length - fabricGroups.size;  // each grouped PR after the first per fabric saves one changeover

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

      <div className="grid grid-cols-5 gap-4">
        <Stat label="Ready to Schedule" value={counts.ready} accent="blue" />
        <Stat label="Currently Printing" value={counts.printing} accent="green" />
        <Stat label="Rush in Queue" value={counts.rush_ready} accent="red" />
        <Stat label="Past Due in Queue" value={counts.overdue} accent="yellow" />
        <Stat label="Changeovers Avoided" value={changeoversAvoided > 0 ? changeoversAvoided : '—'} accent="blue" />
      </div>

      {/* Suggested Fabric Batches — the new intelligent layer */}
      <Card>
        <CardHeader
          title="Suggested Fabric Batches"
          subtitle="Helm groups Ready PRs by fabric to minimize changeovers · review the batch · schedule the whole run on the recommended printer"
        />
        <div className="px-5 pt-4 pb-2 text-[11px] text-gray-500 italic">
          Each card below is a complete run on one fabric. Scheduling a batch sends all PRs in it to the same printer in the suggested order, so the printer loads the fabric once and runs straight through. Rush batches sort first; slip-in candidates highlighted in green.
        </div>
        <div className="grid grid-cols-2 gap-3 p-5 pt-3">
          {batches.length === 0 && (
            <div className="col-span-2 text-sm text-gray-400 italic text-center py-6">Queue is clear — no batches to suggest.</div>
          )}
          {batches.map((b) => (
            <div
              key={b.fabric_name}
              className={`border rounded p-3 ${b.can_slip_into ? 'border-green-300 bg-green-50' : b.rush_count > 0 ? 'border-red-200' : 'border-gray-200'}`}
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="font-semibold text-sm">{b.fabric_name}</div>
                  <div className="text-[11px] text-gray-600 mt-0.5">
                    <span className="font-mono">{b.total_yds} yds</span> · {b.pr_count} PR{b.pr_count !== 1 ? 's' : ''}
                    {b.soonest_due && <> · soonest due <span className="font-mono">{formatDate(b.soonest_due)}</span></>}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  {b.rush_count > 0 && <Tag color="red">{b.rush_count} Rush</Tag>}
                  {b.can_slip_into && <Tag color="green">Slip-in</Tag>}
                </div>
              </div>
              <div className="text-[11px] uppercase tracking-wider text-gray-500 mb-1">Recommended Printer</div>
              <div className="text-xs mb-1">
                {b.suggested_printer ? (
                  <>
                    <span className="font-semibold">{b.suggested_printer.name}</span>
                    <span className="text-gray-500 ml-1.5 font-mono">{b.suggested_printer.model}</span>
                  </>
                ) : <span className="text-gray-400">No printer available</span>}
              </div>
              <div className="text-[11px] text-gray-600 mb-3 italic">{b.suggested_reason}</div>
              <div className="text-[11px] uppercase tracking-wider text-gray-500 mb-1">PRs in this Batch</div>
              <div className="flex flex-wrap gap-1 mb-3">
                {b.prs.map((pr) => (
                  <Link
                    key={pr.id}
                    href={`/print-requests/${pr.id}`}
                    className={`font-mono text-[11px] px-1.5 py-0.5 rounded border ${pr.is_rush ? 'border-red-200 bg-red-50 text-red-800' : 'border-gray-200 bg-white text-navy-700'} hover:underline`}
                  >
                    {pr.pr_number}
                  </Link>
                ))}
              </div>
              <div className="flex gap-2">
                <Button variant="secondary">Review</Button>
                <Button>Schedule Batch on {b.suggested_printer?.name || 'Printer'}</Button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Printer cards — enhanced with Loaded Fabric */}
      <Card>
        <CardHeader title="Printers" subtitle="Per-printer state · 'Loaded Fabric' shows what's on the bed so slip-in opportunities are obvious" />
        <div className="grid grid-cols-3 gap-3 p-5">
          {printers.map((p) => {
            const onThis = printing.filter((pr) => pr.printer_id === p.id);
            const queuedThis = ready.filter((r) => r.printer_id === p.id);
            const loadedFabric = onThis[0]?.fabric_name || null;
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
                <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">Loaded Fabric</div>
                <div className="text-xs mb-2">
                  {loadedFabric ? <Tag color="green">{loadedFabric}</Tag> : <span className="text-gray-400 italic">None</span>}
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

      {/* Unassigned queue — same data as above, grouped by fabric so the flat list tells the batching story too */}
      <Card>
        <CardHeader
          title="Unassigned / Pending Schedule (fabric-grouped)"
          subtitle="Same Ready PRs as in the batch cards above · grouped by fabric so manual scheduling stays consistent with the batching plan"
        />
        <table className="w-full text-sm">
          <thead className="text-xs text-gray-500 uppercase tracking-wider border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-2.5">PR #</th>
              <th className="text-left px-4 py-2.5">Order #</th>
              <th className="text-left px-4 py-2.5">Customer</th>
              <th className="text-left px-4 py-2.5">Process</th>
              <th className="text-right px-4 py-2.5">Yds</th>
              <th className="text-left px-4 py-2.5">Promised</th>
              <th className="text-left px-4 py-2.5">Flags</th>
              <th className="text-right px-4 py-2.5 pr-5">Action</th>
            </tr>
          </thead>
          <tbody>
            {readyByFabric.length === 0 && (
              <tr><td colSpan={8} className="text-center py-8 text-gray-400">Queue is clear.</td></tr>
            )}
            {(() => {
              const rows: JSX.Element[] = [];
              let currentFabric: string | null = null;
              for (const pr of readyByFabric) {
                if (pr.fabric_name !== currentFabric) {
                  currentFabric = pr.fabric_name;
                  const groupYds = readyByFabric.filter((r) => r.fabric_name === currentFabric).reduce((s, r) => s + (r.planned_yardage || 0), 0);
                  const groupCount = readyByFabric.filter((r) => r.fabric_name === currentFabric).length;
                  rows.push(
                    <tr key={`hdr-${currentFabric}`} className="bg-navy-50 border-t-2 border-navy-500">
                      <td colSpan={8} className="px-4 py-1.5 text-xs font-semibold text-navy-900">
                        {currentFabric || 'Unknown fabric'}
                        <span className="ml-2 text-[11px] font-normal text-gray-600">{groupCount} PR{groupCount !== 1 ? 's' : ''} · {groupYds} yds total</span>
                      </td>
                    </tr>
                  );
                }
                rows.push(
                  <tr key={pr.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-2.5">
                      <Link href={`/print-requests/${pr.id}`} className="font-mono text-navy-700 hover:underline font-semibold">{pr.pr_number}</Link>
                    </td>
                    <td className="px-4 py-2.5">
                      <Link href={`/orders/${pr.order_id}`} className="font-mono text-navy-700 hover:underline">{pr.order_number}</Link>
                    </td>
                    <td className="px-4 py-2.5">{pr.company_name}</td>
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
                );
              }
              return rows;
            })()}
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
