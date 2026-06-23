'use client';

// Production Manager Home (S03) — visibility/layout-only dashboard surface (Phase 1.13).
// This component is a presentation layer over data queried by the server page. It does NOT
// redefine "open PR" / lifecycle / status logic — it consumes the existing convention
// (status NOT IN Complete/Cancelled) and the existing adt_promised_date inheritance.
//
// Filtering and sorting affect the displayed list only — record data, statuses, and
// source-of-truth dates are never mutated here.

import { Fragment, useMemo, useState } from 'react';
import Link from 'next/link';
import { Card, CardHeader, StatusPill, Tag } from '@/components/ui';
import { formatDate, formatPromised } from '@/lib/utils';
import { ChevronDown, ChevronRight, Filter, X, AlertTriangle, Clock } from 'lucide-react';

// ------------------------------------------------------------
// Types
// ------------------------------------------------------------
export interface DueSoonPR {
  id: number;
  pr_number: string;
  status: string;
  planned_yardage: number | null;
  assigned_to_user_id: number | null;
  assigned_name: string | null;
  order_id: number;
  order_number: string;
  adt_promised_date: string | null;
  is_rush: number;
  company_name: string;
  plant_number: string | null;
  design_name: string | null;
  colorway_name: string | null;
  fabric_name: string | null;
}

export interface OrderRow {
  id: number;
  order_number: string;
  company_name: string;
  adt_promised_date: string | null;
  is_rush: number;
  roadmap: string | null;
  status: string;
  pr_count: number;
  earliest_promised: string | null;
  latest_promised: string | null;
}

export interface OrderPR {
  id: number;
  pr_number: string;
  status: string;
  planned_yardage: number | null;
  plant_number: string | null;
  design_name: string | null;
  colorway_name: string | null;
  fabric_name: string | null;
  adt_promised_date: string | null;
}

interface Props {
  dueSoonPRs: DueSoonPR[];
  inProd: OrderRow[];
  prsByOrder: Record<number, OrderPR[]>;
}

// ------------------------------------------------------------
// Business-day helpers (display-only)
// ------------------------------------------------------------
// Count of business days remaining until target date (negative if overdue).
function businessDaysUntil(target: string | null): number | null {
  if (!target) return null;
  const t = new Date(target);
  const n = new Date();
  t.setHours(0, 0, 0, 0);
  n.setHours(0, 0, 0, 0);
  if (t.getTime() === n.getTime()) return 0;
  const direction = t > n ? 1 : -1;
  let count = 0;
  const cursor = new Date(n);
  while (cursor.getTime() !== t.getTime()) {
    cursor.setDate(cursor.getDate() + direction);
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) count += direction;
  }
  return count;
}

// ------------------------------------------------------------
// Main dashboard
// ------------------------------------------------------------
export function ProductionManagerDashboard({ dueSoonPRs, inProd, prsByOrder }: Props) {
  // --- KPI counts (computed against the already-filtered server set)
  const counts = useMemo(() => {
    let overdue = 0, today = 0, unassigned = 0;
    dueSoonPRs.forEach((p) => {
      const d = businessDaysUntil(p.adt_promised_date);
      if (d !== null && d < 0) overdue++;
      else if (d === 0) today++;
      if (!p.assigned_to_user_id) unassigned++;
    });
    return { total: dueSoonPRs.length, overdue, today, unassigned };
  }, [dueSoonPRs]);

  return (
    <div className="max-w-[1600px] mx-auto space-y-6 px-2">
      {/* Header */}
      <header className="flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Megan's Home</h1>
          <p className="text-sm text-gray-500 mt-1">Production Manager dashboard · live operational reference (S03)</p>
        </div>
      </header>

      {/* KPI strip */}
      <div className="grid grid-cols-4 gap-4">
        <Stat label="Open PRs due within 7 business days" value={counts.total} accent="blue" />
        <Stat label="Overdue" value={counts.overdue} accent={counts.overdue > 0 ? 'red' : undefined} />
        <Stat label="Due Today" value={counts.today} accent={counts.today > 0 ? 'yellow' : undefined} />
        <Stat label="Unassigned" value={counts.unassigned} accent={counts.unassigned > 0 ? 'yellow' : undefined} />
      </div>

      {/* Full-width Open PRs Due Within 7 Business Days */}
      <DueSoonSection prs={dueSoonPRs} />

      {/* Full-width expandable Orders in Production */}
      <OrdersInProductionSection orders={inProd} prsByOrder={prsByOrder} />
    </div>
  );
}

// ============================================================
// SECTION 1 — Open PRs Due Within 7 Business Days
// ============================================================
function DueSoonSection({ prs }: { prs: DueSoonPR[] }) {
  // Quick-filter chip state
  type Chip = 'all' | 'overdue' | 'today' | 'tomorrow' | 'this_week' | 'unassigned';
  const [chip, setChip] = useState<Chip>('all');

  // Multi-select filter state
  const [assignedFilter, setAssignedFilter] = useState<string[]>([]);
  const [customerFilter, setCustomerFilter] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);

  // Sort state
  type SortKey = 'promised' | 'assigned' | 'customer' | 'status' | 'priority';
  const [sortKey, setSortKey] = useState<SortKey>('promised');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // Distinct values for filter dropdowns
  const distinct = useMemo(() => {
    const a = new Set<string>(), c = new Set<string>(), s = new Set<string>();
    prs.forEach((p) => {
      if (p.assigned_name) a.add(p.assigned_name);
      c.add(p.company_name);
      s.add(p.status);
    });
    return {
      assigned: Array.from(a).sort(),
      customer: Array.from(c).sort(),
      status: Array.from(s).sort(),
    };
  }, [prs]);

  // Apply filters + sort
  const visible = useMemo(() => {
    let rows = prs.filter((p) => {
      // Quick chip
      if (chip !== 'all') {
        const d = businessDaysUntil(p.adt_promised_date);
        if (chip === 'overdue' && !(d !== null && d < 0)) return false;
        if (chip === 'today' && d !== 0) return false;
        if (chip === 'tomorrow' && d !== 1) return false;
        if (chip === 'this_week' && !(d !== null && d >= 0 && d <= 5)) return false;
        if (chip === 'unassigned' && p.assigned_to_user_id) return false;
      }
      // Multi-select
      if (assignedFilter.length > 0) {
        const name = p.assigned_name ?? '— Unassigned';
        if (!assignedFilter.includes(name)) return false;
      }
      if (customerFilter.length > 0 && !customerFilter.includes(p.company_name)) return false;
      if (statusFilter.length > 0 && !statusFilter.includes(p.status)) return false;
      return true;
    });

    // Sort
    const dirMul = sortDir === 'asc' ? 1 : -1;
    rows.sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'promised') {
        const av = a.adt_promised_date ?? '9999-12-31';
        const bv = b.adt_promised_date ?? '9999-12-31';
        cmp = av.localeCompare(bv);
      } else if (sortKey === 'assigned') {
        cmp = (a.assigned_name ?? '~').localeCompare(b.assigned_name ?? '~');
      } else if (sortKey === 'customer') {
        cmp = a.company_name.localeCompare(b.company_name);
      } else if (sortKey === 'status') {
        cmp = a.status.localeCompare(b.status);
      } else if (sortKey === 'priority') {
        // Rush first then overdue first
        const ap = (a.is_rush ? 2 : 0) + ((businessDaysUntil(a.adt_promised_date) ?? 99) < 0 ? 1 : 0);
        const bp = (b.is_rush ? 2 : 0) + ((businessDaysUntil(b.adt_promised_date) ?? 99) < 0 ? 1 : 0);
        cmp = bp - ap;
      }
      return cmp * dirMul;
    });
    return rows;
  }, [prs, chip, assignedFilter, customerFilter, statusFilter, sortKey, sortDir]);

  const anyFilter = chip !== 'all' || assignedFilter.length > 0 || customerFilter.length > 0 || statusFilter.length > 0;
  function reset() {
    setChip('all'); setAssignedFilter([]); setCustomerFilter([]); setStatusFilter([]);
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir(key === 'priority' ? 'desc' : 'asc'); }
  }

  return (
    <Card>
      <CardHeader
        title="Open Print Requests Due Within 7 Business Days"
        subtitle="Live reference · filters/sorts are display-only and do not change records"
        action={
          anyFilter ? (
            <button onClick={reset} className="inline-flex items-center gap-1 text-xs text-navy-700 hover:underline">
              <X className="w-3 h-3" /> Clear filters
            </button>
          ) : null
        }
      />

      {/* Quick filter chips */}
      <div className="px-5 pt-3 pb-2 flex items-center gap-2 flex-wrap">
        <Filter className="w-3.5 h-3.5 text-gray-400" />
        <ChipButton label="All" active={chip === 'all'} onClick={() => setChip('all')} />
        <ChipButton label="Overdue" active={chip === 'overdue'} onClick={() => setChip('overdue')} color="red" />
        <ChipButton label="Due Today" active={chip === 'today'} onClick={() => setChip('today')} color="yellow" />
        <ChipButton label="Due Tomorrow" active={chip === 'tomorrow'} onClick={() => setChip('tomorrow')} />
        <ChipButton label="Due This Week" active={chip === 'this_week'} onClick={() => setChip('this_week')} />
        <ChipButton label="Unassigned" active={chip === 'unassigned'} onClick={() => setChip('unassigned')} />
      </div>

      {/* Multi-select dropdowns */}
      <div className="px-5 pb-3 flex items-center gap-2 flex-wrap border-b border-gray-100">
        <MultiSelect label="Assigned To" options={[...distinct.assigned, '— Unassigned']} selected={assignedFilter} onChange={setAssignedFilter} />
        <MultiSelect label="Customer" options={distinct.customer} selected={customerFilter} onChange={setCustomerFilter} />
        <MultiSelect label="Status" options={distinct.status} selected={statusFilter} onChange={setStatusFilter} />
        <div className="ml-auto text-xs text-gray-500 font-mono">
          Showing {visible.length} of {prs.length}
        </div>
      </div>

      {/* Sticky-header table */}
      <div className="overflow-x-auto max-h-[640px] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-[10px] text-gray-500 uppercase tracking-wider sticky top-0 z-10">
            <tr>
              <th className="text-left px-3 py-2.5">PR #</th>
              <th className="text-left px-3 py-2.5">Order #</th>
              <SortHeader label="Customer" col="customer" sortKey={sortKey} sortDir={sortDir} onClick={() => toggleSort('customer')} />
              <SortHeader label="Assigned" col="assigned" sortKey={sortKey} sortDir={sortDir} onClick={() => toggleSort('assigned')} />
              <SortHeader label="Status" col="status" sortKey={sortKey} sortDir={sortDir} onClick={() => toggleSort('status')} />
              <th className="text-left px-3 py-2.5">Plant# · Design · Colorway</th>
              <th className="text-left px-3 py-2.5">Fabric</th>
              <th className="text-right px-3 py-2.5">Qty</th>
              <SortHeader label="Promised" col="promised" sortKey={sortKey} sortDir={sortDir} onClick={() => toggleSort('promised')} align="left" />
              <th className="text-left px-3 py-2.5">Due In</th>
              <SortHeader label="Priority" col="priority" sortKey={sortKey} sortDir={sortDir} onClick={() => toggleSort('priority')} />
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr><td colSpan={11} className="px-3 py-12 text-center text-sm text-gray-400 italic">No print requests match the current filters.</td></tr>
            )}
            {visible.map((p) => {
              const d = businessDaysUntil(p.adt_promised_date);
              const isOverdue = d !== null && d < 0;
              const isToday = d === 0;
              const promised = formatPromised(p.adt_promised_date);
              return (
                <tr key={p.id} className={`border-t border-gray-100 hover:bg-navy-50/40 ${isOverdue ? 'bg-red-50/40' : isToday ? 'bg-yellow-50/30' : ''}`}>
                  <td className="px-3 py-2">
                    <Link href={`/print-requests/${p.id}`} className="font-mono text-xs font-semibold text-navy-700 hover:underline">{p.pr_number}</Link>
                  </td>
                  <td className="px-3 py-2">
                    <Link href={`/orders/${p.order_id}`} className="font-mono text-xs text-navy-700 hover:underline">{p.order_number}</Link>
                  </td>
                  <td className="px-3 py-2 text-xs">{p.company_name}</td>
                  <td className="px-3 py-2 text-xs">
                    {p.assigned_name ?? <span className="text-amber-700 font-semibold">Unassigned</span>}
                  </td>
                  <td className="px-3 py-2"><StatusPill status={p.status} /></td>
                  <td className="px-3 py-2 text-xs">
                    {p.plant_number ? <span className="font-mono">{p.plant_number}</span> : '—'}
                    {p.design_name ? <span className="text-gray-600"> · {p.design_name}</span> : null}
                    {p.colorway_name ? <span className="text-gray-500"> · {p.colorway_name}</span> : null}
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-700">{p.fabric_name ?? '—'}</td>
                  <td className="px-3 py-2 text-right font-mono text-xs">{p.planned_yardage ?? '—'}</td>
                  <td className="px-3 py-2 text-xs">{p.adt_promised_date ? formatDate(p.adt_promised_date) : '—'}</td>
                  <td className="px-3 py-2 text-xs">
                    <DueInTag days={d} promisedLabel={promised.label} />
                  </td>
                  <td className="px-3 py-2 text-xs">
                    <div className="flex items-center gap-1">
                      {p.is_rush ? <Tag color="red">Rush</Tag> : null}
                      {isOverdue ? <Tag color="red">Overdue</Tag> : null}
                      {!p.is_rush && !isOverdue && isToday ? <Tag color="yellow">Today</Tag> : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function DueInTag({ days, promisedLabel }: { days: number | null; promisedLabel: string }) {
  if (days === null) return <span className="text-gray-400">—</span>;
  if (days < 0) {
    return (
      <span className="inline-flex items-center gap-1 text-red-700 font-semibold">
        <AlertTriangle className="w-3 h-3" />
        {Math.abs(days)} bd late
      </span>
    );
  }
  if (days === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-yellow-800 font-semibold">
        <Clock className="w-3 h-3" />
        Today
      </span>
    );
  }
  return <span className="text-gray-700">{days} bd ({promisedLabel})</span>;
}

// ============================================================
// SECTION 2 — Orders in Production (full-width, expandable per-PR)
// ============================================================
function OrdersInProductionSection({ orders, prsByOrder }: { orders: OrderRow[]; prsByOrder: Record<number, OrderPR[]> }) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  function toggle(id: number) {
    const n = new Set(expanded);
    if (n.has(id)) n.delete(id); else n.add(id);
    setExpanded(n);
  }
  function expandAll() {
    setExpanded(new Set(orders.map((o) => o.id)));
  }
  function collapseAll() {
    setExpanded(new Set());
  }

  return (
    <Card>
      <CardHeader
        title="Orders in Production"
        subtitle="Soonest promised first · click a row to expand its print requests"
        action={
          <div className="flex items-center gap-2 text-[11px]">
            <button onClick={expandAll} className="text-navy-700 hover:underline">Expand all</button>
            <span className="text-gray-300">·</span>
            <button onClick={collapseAll} className="text-navy-700 hover:underline">Collapse all</button>
          </div>
        }
      />
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-[10px] text-gray-500 uppercase tracking-wider">
            <tr>
              <th className="w-8 px-2"></th>
              <th className="text-left px-3 py-2.5">Order #</th>
              <th className="text-left px-3 py-2.5">Customer</th>
              <th className="text-left px-3 py-2.5">Roadmap</th>
              <th className="text-left px-3 py-2.5">Status</th>
              <th className="text-right px-3 py-2.5">PR Count</th>
              <th className="text-left px-3 py-2.5">Earliest Promised</th>
              <th className="text-left px-3 py-2.5">Latest Promised</th>
              <th className="text-left px-3 py-2.5">Flags</th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 && (
              <tr><td colSpan={9} className="px-3 py-12 text-center text-sm text-gray-400 italic">No orders currently in production.</td></tr>
            )}
            {orders.map((o) => {
              const isOpen = expanded.has(o.id);
              const prs = prsByOrder[o.id] ?? [];
              const earliestD = businessDaysUntil(o.earliest_promised);
              const isOverdue = earliestD !== null && earliestD < 0;
              return (
                <Fragment key={o.id}>
                  <tr className={`border-t border-gray-100 cursor-pointer hover:bg-navy-50/40 ${isOpen ? 'bg-navy-50/60' : ''} ${isOverdue ? 'border-l-2 border-l-red-400' : ''}`} onClick={() => toggle(o.id)}>
                    <td className="px-2 text-gray-500 text-center">
                      {isOpen ? <ChevronDown className="w-4 h-4 inline" /> : <ChevronRight className="w-4 h-4 inline" />}
                    </td>
                    <td className="px-3 py-2.5">
                      <Link href={`/orders/${o.id}`} onClick={(e) => e.stopPropagation()} className="font-mono text-xs font-semibold text-navy-700 hover:underline">{o.order_number}</Link>
                    </td>
                    <td className="px-3 py-2.5 text-xs">{o.company_name}</td>
                    <td className="px-3 py-2.5 font-mono text-[10px] text-gray-600">{o.roadmap ?? '—'}</td>
                    <td className="px-3 py-2.5"><StatusPill status={o.status} /></td>
                    <td className="px-3 py-2.5 text-right font-mono text-xs">{o.pr_count}{prs.length > 1 && <Tag color="blue">multi</Tag>}</td>
                    <td className="px-3 py-2.5 text-xs">{formatDate(o.earliest_promised)}</td>
                    <td className="px-3 py-2.5 text-xs">{formatDate(o.latest_promised)}</td>
                    <td className="px-3 py-2.5 text-xs">
                      <div className="flex items-center gap-1">
                        {o.is_rush ? <Tag color="red">Rush</Tag> : null}
                        {isOverdue ? <Tag color="red">Overdue</Tag> : null}
                      </div>
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className="bg-gray-50/60">
                      <td colSpan={9} className="px-0 py-0">
                        <div className="border-t border-gray-200 px-12 py-3">
                          <div className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-1.5">
                            Print Requests ({prs.length}) — one row per PR
                          </div>
                          <table className="w-full text-xs">
                            <thead className="text-[10px] text-gray-500 uppercase tracking-wider">
                              <tr>
                                <th className="text-left px-2 py-1.5">PR #</th>
                                <th className="text-left px-2 py-1.5">Plant# · Design · Colorway</th>
                                <th className="text-left px-2 py-1.5">Fabric</th>
                                <th className="text-right px-2 py-1.5">Qty</th>
                                <th className="text-left px-2 py-1.5">Status</th>
                                <th className="text-left px-2 py-1.5">Promised</th>
                              </tr>
                            </thead>
                            <tbody>
                              {prs.length === 0 && (
                                <tr><td colSpan={6} className="px-2 py-3 italic text-gray-400">No print requests on this order.</td></tr>
                              )}
                              {prs.map((p) => (
                                <tr key={p.id} className="border-t border-gray-200/60 hover:bg-white">
                                  <td className="px-2 py-1.5">
                                    <Link href={`/print-requests/${p.id}`} className="font-mono text-navy-700 hover:underline font-semibold">{p.pr_number}</Link>
                                  </td>
                                  <td className="px-2 py-1.5">
                                    {p.plant_number ? <span className="font-mono">{p.plant_number}</span> : '—'}
                                    {p.design_name ? <span className="text-gray-600"> · {p.design_name}</span> : null}
                                    {p.colorway_name ? <span className="text-gray-500"> · {p.colorway_name}</span> : null}
                                  </td>
                                  <td className="px-2 py-1.5 text-gray-700">{p.fabric_name ?? '—'}</td>
                                  <td className="px-2 py-1.5 text-right font-mono">{p.planned_yardage ?? '—'}</td>
                                  <td className="px-2 py-1.5"><StatusPill status={p.status} /></td>
                                  <td className="px-2 py-1.5">{formatDate(p.adt_promised_date)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ============================================================
// Small UI primitives reused across both sections
// ============================================================
function Stat({ label, value, accent }: { label: string; value: any; accent?: 'yellow' | 'red' | 'green' | 'blue' }) {
  const colorMap: Record<string, string> = {
    yellow: 'bg-helm-yellow', red: 'bg-helm-red', green: 'bg-helm-green', blue: 'bg-helm-blue',
  };
  const bar = accent ? colorMap[accent] : 'bg-gray-200';
  return (
    <Card>
      <div className="p-4 flex items-center gap-3">
        <div className={`w-1 h-10 rounded ${bar}`} />
        <div>
          <div className="text-xl font-bold text-navy-900 leading-tight">{value}</div>
          <div className="text-[11px] text-gray-500 uppercase tracking-wider mt-0.5">{label}</div>
        </div>
      </div>
    </Card>
  );
}

function ChipButton({ label, active, onClick, color }: { label: string; active: boolean; onClick: () => void; color?: 'red' | 'yellow' }) {
  const base = 'px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors';
  if (active) {
    if (color === 'red') return <button onClick={onClick} className={`${base} bg-red-600 text-white`}>{label}</button>;
    if (color === 'yellow') return <button onClick={onClick} className={`${base} bg-yellow-500 text-white`}>{label}</button>;
    return <button onClick={onClick} className={`${base} bg-navy-700 text-white`}>{label}</button>;
  }
  return <button onClick={onClick} className={`${base} bg-gray-100 text-gray-700 hover:bg-gray-200`}>{label}</button>;
}

function MultiSelect({ label, options, selected, onChange }: { label: string; options: string[]; selected: string[]; onChange: (vals: string[]) => void }) {
  const [open, setOpen] = useState(false);
  function toggle(opt: string) {
    if (selected.includes(opt)) onChange(selected.filter((s) => s !== opt));
    else onChange([...selected, opt]);
  }
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium border ${selected.length > 0 ? 'bg-navy-50 border-navy-300 text-navy-900' : 'bg-white border-gray-300 text-gray-700'} hover:border-navy-500`}
      >
        {label}
        {selected.length > 0 && <span className="bg-navy-700 text-white text-[10px] font-bold rounded-full px-1.5">{selected.length}</span>}
        <ChevronDown className="w-3 h-3" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1 w-60 max-h-72 overflow-y-auto bg-white border border-gray-200 rounded shadow-lg z-40">
            <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider font-semibold text-gray-500">{label}</span>
              {selected.length > 0 && (
                <button onClick={() => onChange([])} className="text-[10px] text-navy-700 hover:underline">Clear</button>
              )}
            </div>
            {options.length === 0 && <div className="px-3 py-3 text-xs text-gray-400 italic">No options</div>}
            {options.map((opt) => (
              <button
                key={opt}
                onClick={() => toggle(opt)}
                className={`w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 hover:bg-gray-50 ${selected.includes(opt) ? 'bg-navy-50' : ''}`}
              >
                <div className={`w-3.5 h-3.5 rounded border ${selected.includes(opt) ? 'bg-navy-700 border-navy-700' : 'border-gray-300'} flex items-center justify-center text-white text-[10px]`}>
                  {selected.includes(opt) && '✓'}
                </div>
                <span className="truncate">{opt}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function SortHeader({ label, col, sortKey, sortDir, onClick, align = 'left' }: { label: string; col: string; sortKey: string; sortDir: 'asc' | 'desc'; onClick: () => void; align?: 'left' | 'right' }) {
  const isActive = sortKey === col;
  return (
    <th className={`px-3 py-2.5 ${align === 'right' ? 'text-right' : 'text-left'} cursor-pointer select-none`} onClick={onClick}>
      <span className={`inline-flex items-center gap-1 ${isActive ? 'text-navy-700' : ''}`}>
        {label}
        {isActive && <span className="text-[8px]">{sortDir === 'asc' ? '▲' : '▼'}</span>}
      </span>
    </th>
  );
}
