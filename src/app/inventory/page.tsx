import Link from 'next/link';
import { Card, CardHeader, Tag, Button } from '@/components/ui';
import { Beaker, Calendar, AlertTriangle, Plus } from 'lucide-react';

// /inventory — Fabric stock visibility with pretreatment state
//
// Per Nick: every fabric SKU must show whether stock has been pretreated and, if so, with which
// of the two pretreatments. The two pretreatments correspond directly to the two print processes:
//   - 'Fiber Reactive prep' → required before Fiber Reactive printing
//   - 'Pigment prep' → required before Pigment printing
// Raw (untreated) stock must be pretreated before it can be printed. The page surfaces upcoming
// pretreatment demand vs current pretreated stock so the pretreatment line can be scheduled to
// match production needs.

const TREATMENTS = ['Fiber Reactive prep', 'Pigment prep'] as const;
type Treatment = typeof TREATMENTS[number];

type FabricInventory = {
  id: string;
  fabric_name: string;
  greige_code: string;
  width: string;
  raw_yards: number;
  fr_prepped_yards: number;
  pigment_prepped_yards: number;
  reserved_against_raw: number;
  reserved_against_fr: number;
  reserved_against_pigment: number;
  low_stock_threshold: number;
};

type ScheduledPretreatment = {
  id: string;
  fabric_name: string;
  greige_code: string;
  treatment: Treatment;
  yards: number;
  driven_by: string;     // 'PR-12091' etc.
  needed_by: string;     // ISO date
  status: 'queued' | 'running' | 'completed';
  scheduled_run: string; // human readable
};

type PRDemandForecast = {
  fabric_name: string;
  process: Treatment;
  yards_needed: number;
  prs: string[];
  earliest_due: string;
};

// =====================================================================
// Mock data — realistic ADT fabric inventory with pretreatment state
// =====================================================================

const STOCK: FabricInventory[] = [
  { id: 'f1', fabric_name: 'Cotton Sateen 110-thread', greige_code: 'MG-100001', width: '54"',
    raw_yards: 420, fr_prepped_yards: 145, pigment_prepped_yards: 60,
    reserved_against_raw: 200, reserved_against_fr: 80, reserved_against_pigment: 30,
    low_stock_threshold: 100 },
  { id: 'f2', fabric_name: 'Cotton Sateen 90-thread',  greige_code: 'MG-100002', width: '54"',
    raw_yards: 280, fr_prepped_yards: 0, pigment_prepped_yards: 95,
    reserved_against_raw: 150, reserved_against_fr: 0, reserved_against_pigment: 75,
    low_stock_threshold: 100 },
  { id: 'f3', fabric_name: 'Linen Blend Natural',      greige_code: 'MG-100015', width: '54"',
    raw_yards: 165, fr_prepped_yards: 88, pigment_prepped_yards: 0,
    reserved_against_raw: 80, reserved_against_fr: 60, reserved_against_pigment: 0,
    low_stock_threshold: 100 },
  { id: 'f4', fabric_name: 'Newport Cot/Lin',          greige_code: 'MG-100022', width: '54"',
    raw_yards: 312, fr_prepped_yards: 120, pigment_prepped_yards: 0,
    reserved_against_raw: 60, reserved_against_fr: 60, reserved_against_pigment: 0,
    low_stock_threshold: 80 },
  { id: 'f5', fabric_name: 'Velvet Cotton',            greige_code: 'MG-100031', width: '60"',
    raw_yards: 60, fr_prepped_yards: 0, pigment_prepped_yards: 25,
    reserved_against_raw: 40, reserved_against_fr: 0, reserved_against_pigment: 25,
    low_stock_threshold: 80 },
  { id: 'f6', fabric_name: 'Textured Linen',           greige_code: 'MG-100044', width: '54"',
    raw_yards: 95, fr_prepped_yards: 30, pigment_prepped_yards: 0,
    reserved_against_raw: 0, reserved_against_fr: 30, reserved_against_pigment: 0,
    low_stock_threshold: 60 },
  { id: 'f7', fabric_name: 'Belgian Linen',            greige_code: 'MG-100051', width: '54"',
    raw_yards: 0, fr_prepped_yards: 35, pigment_prepped_yards: 0,
    reserved_against_raw: 0, reserved_against_fr: 35, reserved_against_pigment: 0,
    low_stock_threshold: 80 },
  { id: 'f8', fabric_name: 'Performance Outdoor',      greige_code: 'MG-100062', width: '54"',
    raw_yards: 220, fr_prepped_yards: 0, pigment_prepped_yards: 80,
    reserved_against_raw: 60, reserved_against_fr: 0, reserved_against_pigment: 40,
    low_stock_threshold: 100 },
];

// PR demand forecast — drives the 'pretreatment needed' suggestions
const FORECAST: PRDemandForecast[] = [
  { fabric_name: 'Cotton Sateen 110-thread', process: 'Fiber Reactive prep', yards_needed: 215, prs: ['PR-12091', 'PR-12095', 'PR-12101', 'PR-12104'], earliest_due: '2026-06-22' },
  { fabric_name: 'Cotton Sateen 110-thread', process: 'Pigment prep',        yards_needed:  45, prs: ['PR-12087'], earliest_due: '2026-06-24' },
  { fabric_name: 'Linen Blend Natural',      process: 'Fiber Reactive prep', yards_needed: 130, prs: ['PR-12089', 'PR-12099'], earliest_due: '2026-06-23' },
  { fabric_name: 'Newport Cot/Lin',          process: 'Fiber Reactive prep', yards_needed:  80, prs: ['PR-12092'], earliest_due: '2026-06-25' },
  { fabric_name: 'Velvet Cotton',            process: 'Pigment prep',        yards_needed:  60, prs: ['PR-12102', 'PR-12108'], earliest_due: '2026-06-26' },
  { fabric_name: 'Belgian Linen',            process: 'Fiber Reactive prep', yards_needed:  75, prs: ['PR-12106'], earliest_due: '2026-06-26' },
];

const PRETREATMENT_QUEUE: ScheduledPretreatment[] = [
  { id: 'pt1', fabric_name: 'Cotton Sateen 110-thread', greige_code: 'MG-100001',
    treatment: 'Fiber Reactive prep', yards: 100, driven_by: 'PR-12091 · PR-12095',
    needed_by: '2026-06-22', status: 'running', scheduled_run: 'Today · 14:00' },
  { id: 'pt2', fabric_name: 'Linen Blend Natural', greige_code: 'MG-100015',
    treatment: 'Fiber Reactive prep', yards: 130, driven_by: 'PR-12089 · PR-12099',
    needed_by: '2026-06-23', status: 'queued', scheduled_run: 'Tomorrow · 08:00' },
  { id: 'pt3', fabric_name: 'Newport Cot/Lin', greige_code: 'MG-100022',
    treatment: 'Fiber Reactive prep', yards: 80, driven_by: 'PR-12092',
    needed_by: '2026-06-25', status: 'queued', scheduled_run: 'Jun 20 · 08:00' },
  { id: 'pt4', fabric_name: 'Cotton Sateen 90-thread', greige_code: 'MG-100002',
    treatment: 'Pigment prep', yards: 60, driven_by: 'Replenish stock buffer',
    needed_by: '2026-06-21', status: 'completed', scheduled_run: 'Yesterday · 16:30' },
];

// =====================================================================
// Helpers
// =====================================================================

const available = (i: FabricInventory) => ({
  raw: Math.max(0, i.raw_yards - i.reserved_against_raw),
  fr: Math.max(0, i.fr_prepped_yards - i.reserved_against_fr),
  pigment: Math.max(0, i.pigment_prepped_yards - i.reserved_against_pigment),
  total: Math.max(0, i.raw_yards + i.fr_prepped_yards + i.pigment_prepped_yards
    - i.reserved_against_raw - i.reserved_against_fr - i.reserved_against_pigment),
});

const stockStatus = (i: FabricInventory): { label: string; color: 'red' | 'yellow' | 'green' } => {
  const total = i.raw_yards + i.fr_prepped_yards + i.pigment_prepped_yards;
  if (total === 0) return { label: 'Out of Stock', color: 'red' };
  if (total < i.low_stock_threshold) return { label: 'Low Stock', color: 'yellow' };
  return { label: 'Available', color: 'green' };
};

const gapVsForecast = (fabricName: string, process: Treatment) => {
  const inv = STOCK.find((s) => s.fabric_name === fabricName);
  const f = FORECAST.find((x) => x.fabric_name === fabricName && x.process === process);
  if (!inv || !f) return null;
  const a = available(inv);
  const onHand = process === 'Fiber Reactive prep' ? a.fr : a.pigment;
  const gap = f.yards_needed - onHand;
  return { onHand, needed: f.yards_needed, gap, earliest_due: f.earliest_due, prs: f.prs };
};

// =====================================================================
// Page
// =====================================================================

export default function Inventory() {
  const totals = STOCK.reduce((acc, i) => ({
    raw: acc.raw + i.raw_yards,
    fr: acc.fr + i.fr_prepped_yards,
    pigment: acc.pigment + i.pigment_prepped_yards,
  }), { raw: 0, fr: 0, pigment: 0 });

  const counts = {
    out: STOCK.filter((i) => stockStatus(i).label === 'Out of Stock').length,
    low: STOCK.filter((i) => stockStatus(i).label === 'Low Stock').length,
    ok: STOCK.filter((i) => stockStatus(i).label === 'Available').length,
  };

  // Aggregate forecast vs pretreated stock to compute "pretreatment backlog yards"
  const backlogYards = FORECAST.reduce((acc, f) => {
    const g = gapVsForecast(f.fabric_name, f.process);
    return acc + (g && g.gap > 0 ? g.gap : 0);
  }, 0);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-navy-900">Inventory</h1>
        <p className="text-sm text-gray-500 mt-1">
          Fabric stock with pretreatment state · Raw / Fiber Reactive prepped / Pigment prepped per SKU · upcoming PR demand drives the pretreatment schedule below
        </p>
      </header>

      {/* Stats row */}
      <div className="grid grid-cols-5 gap-4">
        <Stat label="Out of Stock" value={counts.out} accent="red" />
        <Stat label="Low Stock" value={counts.low} accent="yellow" />
        <Stat label="Available SKUs" value={counts.ok} accent="green" />
        <Stat label="Raw / FR / Pigment yds"
          value={`${totals.raw.toLocaleString()} · ${totals.fr.toLocaleString()} · ${totals.pigment.toLocaleString()}`}
          accent="blue" small />
        <Stat label="Pretreatment Backlog" value={`${backlogYards} yds`} accent={backlogYards > 0 ? 'red' : 'green'} small />
      </div>

      {/* Main fabric stock table */}
      <Card>
        <CardHeader
          title="Fabric Stock"
          subtitle="Yards available per treatment state · Reserved = already allocated to PRs · Raw can be moved into either treatment bucket"
          action={
            <div className="flex gap-2">
              <Button variant="secondary" size="sm"><Plus className="w-3.5 h-3.5 mr-1" />Add Roll</Button>
              <Button variant="secondary" size="sm"><Beaker className="w-3.5 h-3.5 mr-1" />Schedule Pretreatment</Button>
            </div>
          }
        />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-gray-500 uppercase tracking-wider border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="text-left px-4 py-2" rowSpan={2}>Fabric</th>
                <th className="text-left px-4 py-2" rowSpan={2}>Status</th>
                <th className="text-center px-3 py-2 border-l border-gray-200" colSpan={2}>Raw</th>
                <th className="text-center px-3 py-2 border-l border-gray-200 bg-blue-50" colSpan={2}>Fiber Reactive prepped</th>
                <th className="text-center px-3 py-2 border-l border-gray-200 bg-purple-50" colSpan={2}>Pigment prepped</th>
                <th className="text-right px-4 py-2 pr-5 border-l border-gray-200" rowSpan={2}>Action</th>
              </tr>
              <tr className="text-[10px]">
                <th className="text-right px-2 py-1.5 border-l border-gray-200">On hand</th>
                <th className="text-right px-2 py-1.5">Reserved</th>
                <th className="text-right px-2 py-1.5 border-l border-gray-200 bg-blue-50">On hand</th>
                <th className="text-right px-2 py-1.5 bg-blue-50">Reserved</th>
                <th className="text-right px-2 py-1.5 border-l border-gray-200 bg-purple-50">On hand</th>
                <th className="text-right px-2 py-1.5 bg-purple-50">Reserved</th>
              </tr>
            </thead>
            <tbody>
              {STOCK.map((i) => {
                const status = stockStatus(i);
                const a = available(i);
                return (
                  <tr key={i.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-2.5">
                      <div className="font-semibold">{i.fabric_name}</div>
                      <div className="text-[11px] text-gray-500 font-mono">{i.greige_code} · {i.width}</div>
                    </td>
                    <td className="px-4 py-2.5"><Tag color={status.color}>{status.label}</Tag></td>

                    <td className="px-2 py-2.5 text-right font-mono border-l border-gray-100">
                      {i.raw_yards}
                      <div className="text-[10px] text-gray-400">avail {a.raw}</div>
                    </td>
                    <td className="px-2 py-2.5 text-right font-mono text-gray-500">{i.reserved_against_raw || '—'}</td>

                    <td className="px-2 py-2.5 text-right font-mono border-l border-gray-100 bg-blue-50/40">
                      {i.fr_prepped_yards || <span className="text-gray-300">0</span>}
                      <div className="text-[10px] text-gray-400">avail {a.fr}</div>
                    </td>
                    <td className="px-2 py-2.5 text-right font-mono text-gray-500 bg-blue-50/40">{i.reserved_against_fr || '—'}</td>

                    <td className="px-2 py-2.5 text-right font-mono border-l border-gray-100 bg-purple-50/40">
                      {i.pigment_prepped_yards || <span className="text-gray-300">0</span>}
                      <div className="text-[10px] text-gray-400">avail {a.pigment}</div>
                    </td>
                    <td className="px-2 py-2.5 text-right font-mono text-gray-500 bg-purple-50/40">{i.reserved_against_pigment || '—'}</td>

                    <td className="px-4 py-2.5 text-right pr-5 border-l border-gray-100">
                      <Button variant="secondary" size="sm">Pretreat…</Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-2 border-t border-gray-100 text-[11px] text-gray-500 italic">
          Treatments: <Tag color="blue">Fiber Reactive prep</Tag> for FR printing · <Tag color="purple">Pigment prep</Tag> for Pigment printing. Raw stock is consumed when an Operator schedules a pretreatment run; pretreated stock is consumed when a PR is routed to a printer.
        </div>
      </Card>

      {/* Pretreatment Schedule */}
      <Card>
        <CardHeader
          title="Pretreatment Schedule"
          subtitle="Upcoming PR demand by fabric + process · highlights gaps vs current pretreated stock so the pretreatment line can stay ahead of production"
        />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-gray-500 uppercase tracking-wider border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-2.5">Fabric</th>
                <th className="text-left px-4 py-2.5">Process / Treatment</th>
                <th className="text-right px-4 py-2.5">Demand (yds)</th>
                <th className="text-right px-4 py-2.5">On hand pretreated</th>
                <th className="text-right px-4 py-2.5">Gap</th>
                <th className="text-left px-4 py-2.5">Earliest due</th>
                <th className="text-left px-4 py-2.5">Driving PRs</th>
                <th className="text-right px-4 py-2.5 pr-5">Action</th>
              </tr>
            </thead>
            <tbody>
              {FORECAST.map((f, i) => {
                const g = gapVsForecast(f.fabric_name, f.process);
                if (!g) return null;
                const tone = g.gap > 0 ? 'red' : 'green';
                return (
                  <tr key={i} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-semibold">{f.fabric_name}</td>
                    <td className="px-4 py-2.5">
                      <Tag color={f.process === 'Fiber Reactive prep' ? 'blue' : 'purple'}>{f.process}</Tag>
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono">{g.needed}</td>
                    <td className="px-4 py-2.5 text-right font-mono">{g.onHand}</td>
                    <td className="px-4 py-2.5 text-right">
                      {g.gap > 0 ? <Tag color="red">{g.gap} short</Tag> : <Tag color="green">covered</Tag>}
                    </td>
                    <td className="px-4 py-2.5 text-xs font-mono">{g.earliest_due}</td>
                    <td className="px-4 py-2.5 text-xs">
                      {g.prs.map((pr) => (
                        <Link key={pr} href="/print-requests/1" className="font-mono text-navy-700 hover:underline mr-2">{pr}</Link>
                      ))}
                    </td>
                    <td className="px-4 py-2.5 text-right pr-5">
                      {g.gap > 0
                        ? <Button size="sm"><Calendar className="w-3.5 h-3.5 mr-1" />Schedule {g.gap} yds</Button>
                        : <span className="text-xs text-gray-400">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-2 border-t border-gray-100 text-[11px] text-gray-500 italic flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 text-yellow-600" />
          When the gap row is highlighted, scheduling a pretreatment run BEFORE the earliest-due date prevents the PR from blocking on lack of prepped fabric. The Schedule button creates a queued entry in the Active Pretreatment Queue below.
        </div>
      </Card>

      {/* Active pretreatment queue */}
      <Card>
        <CardHeader
          title="Active Pretreatment Queue"
          subtitle="What's running on the pretreatment line · today + upcoming · recently completed"
        />
        <table className="w-full text-sm">
          <thead className="text-xs text-gray-500 uppercase tracking-wider border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-2.5">Fabric (greige)</th>
              <th className="text-left px-4 py-2.5">Treatment</th>
              <th className="text-right px-4 py-2.5">Yards</th>
              <th className="text-left px-4 py-2.5">Driven by</th>
              <th className="text-left px-4 py-2.5">Needed by</th>
              <th className="text-left px-4 py-2.5">Scheduled run</th>
              <th className="text-left px-4 py-2.5 pr-5">Status</th>
            </tr>
          </thead>
          <tbody>
            {PRETREATMENT_QUEUE.map((pt) => (
              <tr key={pt.id} className="border-t border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-2.5">
                  <div className="font-semibold">{pt.fabric_name}</div>
                  <div className="text-[11px] text-gray-500 font-mono">{pt.greige_code}</div>
                </td>
                <td className="px-4 py-2.5">
                  <Tag color={pt.treatment === 'Fiber Reactive prep' ? 'blue' : 'purple'}>{pt.treatment}</Tag>
                </td>
                <td className="px-4 py-2.5 text-right font-mono">{pt.yards}</td>
                <td className="px-4 py-2.5 text-xs">{pt.driven_by}</td>
                <td className="px-4 py-2.5 text-xs font-mono">{pt.needed_by}</td>
                <td className="px-4 py-2.5 text-xs">{pt.scheduled_run}</td>
                <td className="px-4 py-2.5 pr-5">
                  <Tag color={pt.status === 'running' ? 'blue' : pt.status === 'completed' ? 'green' : 'gray'}>
                    {pt.status[0].toUpperCase() + pt.status.slice(1)}
                  </Tag>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function Stat({ label, value, accent, small }: { label: string; value: any; accent?: 'yellow' | 'red' | 'green' | 'blue'; small?: boolean }) {
  const bar = {
    yellow: 'bg-helm-yellow', red: 'bg-helm-red', green: 'bg-helm-green', blue: 'bg-helm-blue',
  }[accent || ''] || 'bg-gray-200';
  return (
    <Card>
      <div className="p-4 flex items-center gap-3">
        <div className={`w-1 h-10 rounded ${bar}`} />
        <div className="min-w-0">
          <div className={`${small ? 'text-lg' : 'text-2xl'} font-bold text-navy-900 leading-tight font-mono`}>{value}</div>
          <div className="text-[11px] text-gray-500 uppercase tracking-wider mt-0.5">{label}</div>
        </div>
      </div>
    </Card>
  );
}
