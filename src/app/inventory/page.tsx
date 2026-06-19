import Link from 'next/link';
import { Card, CardHeader, Tag, Button } from '@/components/ui';
import { Beaker, Calendar, AlertTriangle, Plus, Info } from 'lucide-react';

// /inventory — Fabric stock visibility per print-process fabric-state
//
// Per Nick: fabric comes from the mill as PFP (Prepared For Print). Whether further treatment
// is needed depends on the destination print process:
//
//   Fiber Reactive printers (MS JP7)           → require Fiber Reactive prepped fabric
//   Pigment printers (Durst Alpha 330, Zimmer) → require Pigment prepped fabric
//   Dye Sublimation printers (MS JP4-A / B)    → print on PFP directly (NO further pretreatment)
//   Latex printers (HP Latex 800W / 830W)      → print on PFP directly (NO further pretreatment)
//
// So PFP serves a dual role: it's both the inbound stock state AND the directly-usable state for
// Dye Sub + Latex jobs. Fiber Reactive and Pigment jobs require pretreating PFP fabric into the
// corresponding prepped buckets. The Pretreatment Schedule section forecasts only FR + Pigment
// demand against current prepped stock.

const TREATMENTS = ['Fiber Reactive prep', 'Pigment prep'] as const;
type Treatment = typeof TREATMENTS[number];
type DirectProcess = 'Dye Sublimation' | 'Latex';

type FabricInventory = {
  id: string;
  fabric_name: string;
  greige_code: string;
  width: string;
  pfp_yards: number;            // Prepared For Print — directly usable for Dye Sub + Latex
  fr_prepped_yards: number;     // pretreated for Fiber Reactive printers
  pigment_prepped_yards: number;// pretreated for Pigment printers
  reserved_against_pfp: number; // reserved against Dye Sub / Latex PRs OR queued for pretreatment
  reserved_against_fr: number;  // reserved against Fiber Reactive PRs
  reserved_against_pigment: number;// reserved against Pigment PRs
  low_stock_threshold: number;
};

type ScheduledPretreatment = {
  id: string;
  fabric_name: string;
  greige_code: string;
  treatment: Treatment;
  yards: number;
  driven_by: string;
  needed_by: string;
  status: 'queued' | 'running' | 'completed';
  scheduled_run: string;
};

type PRDemandForecast = {
  fabric_name: string;
  process: Treatment;
  yards_needed: number;
  prs: string[];
  earliest_due: string;
};

type DirectPrintDemand = {
  fabric_name: string;
  process: DirectProcess;
  yards_needed: number;
  prs: string[];
  earliest_due: string;
};

// =====================================================================
// Mock data — fabric inventory with PFP / FR / Pigment buckets
// =====================================================================

const STOCK: FabricInventory[] = [
  { id: 'f1', fabric_name: 'Cotton Sateen 110-thread', greige_code: 'MG-100001', width: '54"',
    pfp_yards: 420, fr_prepped_yards: 145, pigment_prepped_yards: 60,
    reserved_against_pfp: 0, reserved_against_fr: 80, reserved_against_pigment: 30,
    low_stock_threshold: 100 },
  { id: 'f2', fabric_name: 'Cotton Sateen 90-thread',  greige_code: 'MG-100002', width: '54"',
    pfp_yards: 280, fr_prepped_yards: 0, pigment_prepped_yards: 95,
    reserved_against_pfp: 0, reserved_against_fr: 0, reserved_against_pigment: 75,
    low_stock_threshold: 100 },
  { id: 'f3', fabric_name: 'Linen Blend Natural',      greige_code: 'MG-100015', width: '54"',
    pfp_yards: 165, fr_prepped_yards: 88, pigment_prepped_yards: 0,
    reserved_against_pfp: 0, reserved_against_fr: 60, reserved_against_pigment: 0,
    low_stock_threshold: 100 },
  { id: 'f4', fabric_name: 'Newport Cot/Lin',          greige_code: 'MG-100022', width: '54"',
    pfp_yards: 312, fr_prepped_yards: 120, pigment_prepped_yards: 0,
    reserved_against_pfp: 0, reserved_against_fr: 60, reserved_against_pigment: 0,
    low_stock_threshold: 80 },
  { id: 'f5', fabric_name: 'Polyester Sateen Performance', greige_code: 'MG-100031', width: '62"',
    pfp_yards: 480, fr_prepped_yards: 0, pigment_prepped_yards: 0,
    reserved_against_pfp: 220, reserved_against_fr: 0, reserved_against_pigment: 0,
    low_stock_threshold: 150 },
  { id: 'f6', fabric_name: 'Textured Linen',           greige_code: 'MG-100044', width: '54"',
    pfp_yards: 95, fr_prepped_yards: 30, pigment_prepped_yards: 0,
    reserved_against_pfp: 0, reserved_against_fr: 30, reserved_against_pigment: 0,
    low_stock_threshold: 60 },
  { id: 'f7', fabric_name: 'Belgian Linen',            greige_code: 'MG-100051', width: '54"',
    pfp_yards: 0, fr_prepped_yards: 35, pigment_prepped_yards: 0,
    reserved_against_pfp: 0, reserved_against_fr: 35, reserved_against_pigment: 0,
    low_stock_threshold: 80 },
  { id: 'f8', fabric_name: 'Performance Outdoor',      greige_code: 'MG-100062', width: '54"',
    pfp_yards: 220, fr_prepped_yards: 0, pigment_prepped_yards: 80,
    reserved_against_pfp: 90, reserved_against_fr: 0, reserved_against_pigment: 40,
    low_stock_threshold: 100 },
];

// PR demand by pretreatment requirement — drives the Pretreatment Schedule
const PRETREATMENT_FORECAST: PRDemandForecast[] = [
  { fabric_name: 'Cotton Sateen 110-thread', process: 'Fiber Reactive prep', yards_needed: 215, prs: ['PR-12091', 'PR-12095', 'PR-12101'], earliest_due: '2026-06-22' },
  { fabric_name: 'Cotton Sateen 110-thread', process: 'Pigment prep',        yards_needed:  45, prs: ['PR-12087'], earliest_due: '2026-06-24' },
  { fabric_name: 'Linen Blend Natural',      process: 'Fiber Reactive prep', yards_needed: 130, prs: ['PR-12089', 'PR-12099'], earliest_due: '2026-06-23' },
  { fabric_name: 'Newport Cot/Lin',          process: 'Fiber Reactive prep', yards_needed:  80, prs: ['PR-12092'], earliest_due: '2026-06-25' },
  { fabric_name: 'Cotton Sateen 90-thread',  process: 'Pigment prep',        yards_needed:  60, prs: ['PR-12102'], earliest_due: '2026-06-26' },
  { fabric_name: 'Belgian Linen',            process: 'Fiber Reactive prep', yards_needed:  75, prs: ['PR-12106'], earliest_due: '2026-06-26' },
];

// Direct-print demand for Dye Sub + Latex — these consume PFP directly
const DIRECT_PRINT_FORECAST: DirectPrintDemand[] = [
  { fabric_name: 'Polyester Sateen Performance', process: 'Dye Sublimation', yards_needed: 220, prs: ['PR-12104', 'PR-12107', 'PR-12110'], earliest_due: '2026-06-22' },
  { fabric_name: 'Performance Outdoor',          process: 'Latex',           yards_needed:  90, prs: ['PR-12108'], earliest_due: '2026-06-25' },
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
    treatment: 'Pigment prep', yards: 60, driven_by: 'PR-12102 · stock buffer',
    needed_by: '2026-06-26', status: 'queued', scheduled_run: 'Jun 21 · 10:00' },
];

// =====================================================================
// Helpers
// =====================================================================

const available = (i: FabricInventory) => ({
  pfp: Math.max(0, i.pfp_yards - i.reserved_against_pfp),
  fr: Math.max(0, i.fr_prepped_yards - i.reserved_against_fr),
  pigment: Math.max(0, i.pigment_prepped_yards - i.reserved_against_pigment),
  total: Math.max(0, i.pfp_yards + i.fr_prepped_yards + i.pigment_prepped_yards
    - i.reserved_against_pfp - i.reserved_against_fr - i.reserved_against_pigment),
});

const stockStatus = (i: FabricInventory): { label: string; color: 'red' | 'yellow' | 'green' } => {
  const total = i.pfp_yards + i.fr_prepped_yards + i.pigment_prepped_yards;
  if (total === 0) return { label: 'Out of Stock', color: 'red' };
  if (total < i.low_stock_threshold) return { label: 'Low Stock', color: 'yellow' };
  return { label: 'Available', color: 'green' };
};

const pretreatmentGap = (fabricName: string, process: Treatment) => {
  const inv = STOCK.find((s) => s.fabric_name === fabricName);
  const f = PRETREATMENT_FORECAST.find((x) => x.fabric_name === fabricName && x.process === process);
  if (!inv || !f) return null;
  const a = available(inv);
  const onHand = process === 'Fiber Reactive prep' ? a.fr : a.pigment;
  const gap = f.yards_needed - onHand;
  return { onHand, needed: f.yards_needed, gap, earliest_due: f.earliest_due, prs: f.prs };
};

const directPrintGap = (fabricName: string) => {
  const inv = STOCK.find((s) => s.fabric_name === fabricName);
  const f = DIRECT_PRINT_FORECAST.find((x) => x.fabric_name === fabricName);
  if (!inv || !f) return null;
  const a = available(inv);
  const gap = f.yards_needed - a.pfp;
  return { onHand: a.pfp, needed: f.yards_needed, gap, earliest_due: f.earliest_due, prs: f.prs, process: f.process };
};

// =====================================================================
// Page
// =====================================================================

export default function Inventory() {
  const totals = STOCK.reduce((acc, i) => ({
    pfp: acc.pfp + i.pfp_yards,
    fr: acc.fr + i.fr_prepped_yards,
    pigment: acc.pigment + i.pigment_prepped_yards,
  }), { pfp: 0, fr: 0, pigment: 0 });

  const counts = {
    out: STOCK.filter((i) => stockStatus(i).label === 'Out of Stock').length,
    low: STOCK.filter((i) => stockStatus(i).label === 'Low Stock').length,
    ok: STOCK.filter((i) => stockStatus(i).label === 'Available').length,
  };

  const backlogYards = PRETREATMENT_FORECAST.reduce((acc, f) => {
    const g = pretreatmentGap(f.fabric_name, f.process);
    return acc + (g && g.gap > 0 ? g.gap : 0);
  }, 0);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-navy-900">Inventory</h1>
        <p className="text-sm text-gray-500 mt-1">
          Fabric stock by process-readiness state · PFP · Fiber Reactive prepped · Pigment prepped · upcoming PR demand drives both the Pretreatment Schedule and the Direct-print PFP allocation below
        </p>
      </header>

      {/* Print-process → fabric-state legend */}
      <Card>
        <CardHeader title="How Helm maps print process to required fabric state" />
        <div className="p-5 grid grid-cols-4 gap-4 text-xs">
          <ProcessLegend
            process="Fiber Reactive"
            printers="MS JP7"
            required="Fiber Reactive prepped"
            requiredColor="blue"
            note="Requires pretreatment from PFP before printing"
          />
          <ProcessLegend
            process="Pigment"
            printers="Durst Alpha 330 · Zimmer Colaris"
            required="Pigment prepped"
            requiredColor="purple"
            note="Requires pretreatment from PFP before printing"
          />
          <ProcessLegend
            process="Dye Sublimation"
            printers="MS JP4-A · MS JP4-B"
            required="PFP (direct)"
            requiredColor="green"
            note="No further pretreatment · prints on PFP fabric directly · output is transfer paper → heat press"
          />
          <ProcessLegend
            process="Latex"
            printers="HP Latex 800W · HP Latex 830W"
            required="PFP (direct)"
            requiredColor="green"
            note="No further pretreatment · prints on PFP fabric directly"
          />
        </div>
      </Card>

      {/* Stats row */}
      <div className="grid grid-cols-5 gap-4">
        <Stat label="Out of Stock" value={counts.out} accent="red" />
        <Stat label="Low Stock" value={counts.low} accent="yellow" />
        <Stat label="Available SKUs" value={counts.ok} accent="green" />
        <Stat label="PFP / FR / Pigment yds"
          value={`${totals.pfp.toLocaleString()} · ${totals.fr.toLocaleString()} · ${totals.pigment.toLocaleString()}`}
          accent="blue" small />
        <Stat label="Pretreatment Backlog" value={`${backlogYards} yds`} accent={backlogYards > 0 ? 'red' : 'green'} small />
      </div>

      {/* Main fabric stock table */}
      <Card>
        <CardHeader
          title="Fabric Stock"
          subtitle="Yards available per fabric state · PFP is the mill-prepared stock (directly usable for Dye Sub + Latex; input to pretreatment for FR / Pigment)"
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
                <th className="text-center px-3 py-2 border-l border-gray-200" colSpan={2}>PFP <span className="text-[9px] normal-case text-gray-400">(Dye Sub + Latex ready)</span></th>
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
                      {i.pfp_yards}
                      <div className="text-[10px] text-gray-400">avail {a.pfp}</div>
                    </td>
                    <td className="px-2 py-2.5 text-right font-mono text-gray-500">{i.reserved_against_pfp || '—'}</td>

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
          PFP (Prepared For Print) is the as-received state from the mill. It feeds Dye Sublimation and Latex jobs directly. For Fiber Reactive or Pigment jobs, PFP must first be pretreated into the corresponding prepped bucket. The Pretreatment Schedule below shows where PFP→prepped runs need to be scheduled.
        </div>
      </Card>

      {/* Pretreatment Schedule (FR + Pigment demand only) */}
      <Card>
        <CardHeader
          title="Pretreatment Schedule"
          subtitle="Upcoming Fiber Reactive + Pigment PR demand · highlights gaps vs current pretreated stock · drives PFP → prepped runs on the pretreatment line"
        />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-gray-500 uppercase tracking-wider border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-2.5">Fabric</th>
                <th className="text-left px-4 py-2.5">Process / Treatment</th>
                <th className="text-right px-4 py-2.5">Demand (yds)</th>
                <th className="text-right px-4 py-2.5">On hand prepped</th>
                <th className="text-right px-4 py-2.5">Gap</th>
                <th className="text-left px-4 py-2.5">Earliest due</th>
                <th className="text-left px-4 py-2.5">Driving PRs</th>
                <th className="text-right px-4 py-2.5 pr-5">Action</th>
              </tr>
            </thead>
            <tbody>
              {PRETREATMENT_FORECAST.map((f, i) => {
                const g = pretreatmentGap(f.fabric_name, f.process);
                if (!g) return null;
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
          When a gap row is red, scheduling a pretreatment run BEFORE the earliest-due date prevents the PR from blocking on lack of prepped fabric. Dye Sublimation + Latex jobs don't appear here — they print on PFP directly (see Direct-print allocation below).
        </div>
      </Card>

      {/* Direct-print allocation (Dye Sub + Latex demand on PFP) */}
      <Card>
        <CardHeader
          title="Direct-print PFP Allocation"
          subtitle="Dye Sublimation + Latex PR demand consumes PFP directly · no pretreatment needed · this section flags PFP shortages for those processes"
        />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-gray-500 uppercase tracking-wider border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-2.5">Fabric</th>
                <th className="text-left px-4 py-2.5">Process</th>
                <th className="text-right px-4 py-2.5">Demand (yds)</th>
                <th className="text-right px-4 py-2.5">On hand PFP</th>
                <th className="text-right px-4 py-2.5">Gap</th>
                <th className="text-left px-4 py-2.5">Earliest due</th>
                <th className="text-left px-4 py-2.5 pr-5">Driving PRs</th>
              </tr>
            </thead>
            <tbody>
              {DIRECT_PRINT_FORECAST.map((f, i) => {
                const g = directPrintGap(f.fabric_name);
                if (!g) return null;
                return (
                  <tr key={i} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-semibold">{f.fabric_name}</td>
                    <td className="px-4 py-2.5"><Tag color="green">{g.process} · PFP</Tag></td>
                    <td className="px-4 py-2.5 text-right font-mono">{g.needed}</td>
                    <td className="px-4 py-2.5 text-right font-mono">{g.onHand}</td>
                    <td className="px-4 py-2.5 text-right">
                      {g.gap > 0 ? <Tag color="red">{g.gap} short</Tag> : <Tag color="green">covered</Tag>}
                    </td>
                    <td className="px-4 py-2.5 text-xs font-mono">{g.earliest_due}</td>
                    <td className="px-4 py-2.5 text-xs pr-5">
                      {g.prs.map((pr) => (
                        <Link key={pr} href="/print-requests/1" className="font-mono text-navy-700 hover:underline mr-2">{pr}</Link>
                      ))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-2 border-t border-gray-100 text-[11px] text-gray-500 italic">
          PFP shortages for direct-print processes are resolved by ordering more fabric from the mill — pretreatment does not help here.
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

function ProcessLegend({ process, printers, required, requiredColor, note }: {
  process: string;
  printers: string;
  required: string;
  requiredColor: 'blue' | 'purple' | 'green';
  note: string;
}) {
  return (
    <div className="border border-gray-200 rounded p-3">
      <div className="font-bold text-sm text-navy-900 mb-1">{process}</div>
      <div className="text-[11px] text-gray-500 mb-2">{printers}</div>
      <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">Required fabric state</div>
      <div className="mb-2"><Tag color={requiredColor}>{required}</Tag></div>
      <div className="text-[11px] text-gray-600 italic flex items-start gap-1">
        <Info className="w-3 h-3 flex-shrink-0 mt-0.5 text-gray-400" />
        {note}
      </div>
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
