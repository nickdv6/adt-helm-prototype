'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronRight, ChevronDown, X, AlertTriangle } from 'lucide-react';
import { Tag, Button, StatusPill } from './ui';

// One Ready-to-Ship order row + expandable child PRs (each PR can have multiple rolls).
// Roll #s are pack-out-time identifiers — surfaced here on the Shipping page only.
//
// Three shipment paths distinguished per Nick:
//   1. Complete order shipment — every packed roll on every PR goes out together
//   2. Partial shipment — operator picks a subset of rolls across one or more PRs
//   3. Individual roll shipment — single roll shipped on its own (prompts when others remain)

type Roll = {
  id: number;
  roll_number: string;
  yards: number;
  ship_status: 'packed' | 'shipped';
};

type PR = {
  id: number;
  pr_number: string;
  status: string;
  planned_yardage: number | null;
  printed_yardage: number | null;
  design_name: string | null;
  colorway_name: string | null;
  rolls: Roll[];
};

type Order = {
  id: number;
  order_number: string;
  company_name: string;
  promised_label: string;
  is_rush: number;
  is_blind_ship: number;
  requires_cad_services: number;
  insure_package: number;
  is_third_party_billed: number;
  carrier_account_carrier: string | null;
  carrier_account_number: string | null;
};

export function ShippingOrderRow({ order, prs }: { order: Order; prs: PR[] }) {
  const [expanded, setExpanded] = useState(false);
  // Selection set is keyed by roll ID — operator can pick any subset of rolls across PRs
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [confirm, setConfirm] = useState<null | { mode: 'partial' | 'individual'; rollIds: number[] }>(null);

  const allRolls = prs.flatMap((pr) => pr.rolls.filter((r) => r.ship_status === 'packed'));
  const totalRolls = allRolls.length;
  const totalYards = allRolls.reduce((s, r) => s + r.yards, 0);
  const selectedRolls = allRolls.filter((r) => selected.has(r.id));
  const selectedYards = selectedRolls.reduce((s, r) => s + r.yards, 0);
  const allSelected = totalRolls > 0 && selected.size === totalRolls;

  const toggleRoll = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleShipFull = () => {
    alert(`(prototype) Shipping COMPLETE order ${order.order_number} — ${totalRolls} roll${totalRolls !== 1 ? 's' : ''} · ${totalYards} yds`);
  };

  const handleShipSelected = () => {
    const ids = [...selected];
    if (ids.length === totalRolls) { handleShipFull(); return; }
    setConfirm({ mode: 'partial', rollIds: ids });
  };

  const handleShipOneRoll = (rollId: number) => {
    if (totalRolls > 1) {
      setConfirm({ mode: 'individual', rollIds: [rollId] });
    } else {
      handleShipFull();
    }
  };

  const confirmShip = () => {
    if (!confirm) return;
    const rollNums = confirm.rollIds.map((id) => allRolls.find((r) => r.id === id)?.roll_number).filter(Boolean).join(', ');
    alert(`(prototype) Shipped roll(s) ${rollNums} — parent order ${order.order_number} remains OPEN until remaining rolls ship`);
    setConfirm(null);
    setSelected(new Set());
  };

  return (
    <>
      {/* Order row */}
      <tr className="border-t border-gray-100 hover:bg-gray-50">
        <td className="px-3 py-2.5 w-8">
          <button onClick={() => setExpanded(!expanded)} className="text-gray-400 hover:text-navy-700" aria-label="Expand">
            {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        </td>
        <td className="px-3 py-2.5">
          <Link href={`/orders/${order.id}`} className="font-mono text-navy-700 hover:underline font-semibold">{order.order_number}</Link>
        </td>
        <td className="px-3 py-2.5">{order.company_name}</td>
        <td className="px-3 py-2.5 text-xs">{order.promised_label}</td>
        <td className="px-3 py-2.5">
          {order.is_rush ? <Tag color="red">Rush</Tag> : null}
          {order.is_blind_ship ? <Tag color="green">Blind</Tag> : null}
          {order.requires_cad_services ? <Tag color="blue">CAD</Tag> : null}
          {order.insure_package ? <Tag color="yellow">Insure</Tag> : null}
          <span className="text-[11px] text-gray-500 ml-1">{prs.length} PR{prs.length !== 1 ? 's' : ''} · {totalRolls} roll{totalRolls !== 1 ? 's' : ''}</span>
        </td>
        <td className="px-3 py-2.5 text-xs">
          {order.is_third_party_billed
            ? <Tag color="yellow">3rd-Party · {order.carrier_account_carrier} #{order.carrier_account_number}</Tag>
            : <span className="text-gray-500">ADT account</span>}
        </td>
        <td className="px-3 py-2.5 text-right pr-3">
          <Button size="sm" onClick={handleShipFull} disabled={totalRolls === 0}>Ship full order</Button>
        </td>
      </tr>

      {/* Expanded panel — PRs with their packed rolls */}
      {expanded && (
        <tr className="bg-gray-50/60">
          <td colSpan={7} className="p-0">
            <div className="px-5 py-3 border-l-2 border-navy-500 space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-[11px] uppercase tracking-wider text-gray-600 font-semibold">
                  Print Requests on this order ({prs.length}) · {totalRolls} packed roll{totalRolls !== 1 ? 's' : ''}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-gray-500">
                    {selected.size} selected{selected.size > 0 && ` · ${selectedYards} yds`}
                  </span>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={selected.size === 0}
                    onClick={handleShipSelected}
                  >
                    {allSelected ? 'Ship selected (all)' : 'Ship selected (partial)'}
                  </Button>
                </div>
              </div>

              {prs.map((pr) => (
                <div key={pr.id} className="bg-white border border-gray-200 rounded">
                  {/* PR header */}
                  <div className="px-3 py-2 border-b border-gray-100 flex items-center gap-3 bg-gray-50">
                    <Link href={`/print-requests/${pr.id}`} className="font-mono text-navy-700 hover:underline font-semibold text-sm">{pr.pr_number}</Link>
                    <span className="text-xs">
                      <span className="font-semibold">{pr.design_name || '—'}</span>
                      {pr.colorway_name && <span className="text-gray-500 ml-1">· {pr.colorway_name}</span>}
                    </span>
                    <StatusPill status={pr.status} />
                    <span className="ml-auto text-xs text-gray-500">
                      Printed {pr.printed_yardage ?? '—'}/{pr.planned_yardage ?? '—'} yd ·
                      <span className="ml-1.5 font-semibold">
                        {pr.rolls.length} roll{pr.rolls.length !== 1 ? 's' : ''}
                      </span>
                    </span>
                  </div>

                  {/* Rolls table — one row per roll */}
                  {pr.rolls.length === 0 ? (
                    <div className="px-3 py-3 text-xs text-gray-400 italic">No rolls packed yet for this PR.</div>
                  ) : (
                    <table className="w-full text-xs">
                      <thead className="text-gray-500 uppercase tracking-wider border-b border-gray-100 bg-white">
                        <tr>
                          <th className="w-8 px-2 py-1.5"></th>
                          <th className="text-left px-2 py-1.5">Roll #</th>
                          <th className="text-right px-2 py-1.5">Yards</th>
                          <th className="text-left px-2 py-1.5">Status</th>
                          <th className="text-right px-2 py-1.5 pr-3">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pr.rolls.map((roll) => {
                          const isShipped = roll.ship_status === 'shipped';
                          return (
                            <tr key={roll.id} className="border-t border-gray-100">
                              <td className="px-2 py-1.5">
                                <input
                                  type="checkbox"
                                  checked={selected.has(roll.id)}
                                  onChange={() => toggleRoll(roll.id)}
                                  disabled={isShipped}
                                  className="w-3.5 h-3.5 disabled:opacity-30"
                                />
                              </td>
                              <td className="px-2 py-1.5 font-mono font-semibold text-navy-700">{roll.roll_number}</td>
                              <td className="px-2 py-1.5 text-right font-mono">{roll.yards}</td>
                              <td className="px-2 py-1.5">
                                {isShipped ? <Tag color="green">Shipped</Tag> : <Tag color="blue">Packed</Tag>}
                              </td>
                              <td className="px-2 py-1.5 text-right pr-3">
                                {!isShipped && (
                                  <Button size="sm" variant="ghost" onClick={() => handleShipOneRoll(roll.id)}>
                                    Ship just this roll
                                  </Button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              ))}
            </div>
          </td>
        </tr>
      )}

      {/* Confirmation modal */}
      {confirm && (
        <PartialShipConfirm
          orderNumber={order.order_number}
          mode={confirm.mode}
          rolls={confirm.rollIds.map((id) => allRolls.find((r) => r.id === id)).filter(Boolean) as Roll[]}
          remainingCount={totalRolls - confirm.rollIds.length}
          onCancel={() => setConfirm(null)}
          onConfirm={confirmShip}
        />
      )}
    </>
  );
}

function PartialShipConfirm({
  orderNumber, mode, rolls, remainingCount, onCancel, onConfirm,
}: {
  orderNumber: string;
  mode: 'partial' | 'individual';
  rolls: Roll[];
  remainingCount: number;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const yardsBeingShipped = rolls.reduce((s, r) => s + r.yards, 0);
  return (
    <tr>
      <td colSpan={7} className="p-0">
        <div className="fixed inset-0 z-40 flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-black/40" onClick={onCancel}></div>
          <div className="relative bg-white rounded shadow-2xl w-full max-w-md">
            <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-2 text-yellow-900">
                <AlertTriangle className="w-5 h-5" />
                <div className="text-base font-bold">
                  {mode === 'individual' ? 'Ship single roll?' : 'Confirm partial shipment'}
                </div>
              </div>
              <button onClick={onCancel} className="text-gray-400 hover:text-gray-700"><X className="w-5 h-5" /></button>
            </div>
            <div className="px-5 py-4 space-y-3 text-sm">
              <p className="text-gray-800">
                You are shipping only part of order <span className="font-mono font-semibold">{orderNumber}</span>.
                The complete order will remain open until the remaining {remainingCount} roll{remainingCount !== 1 ? 's are' : ' is'} shipped. Do you want to continue?
              </p>
              <div className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded p-2.5">
                <div className="font-semibold uppercase tracking-wider text-[10px] mb-1">Rolls being shipped now ({rolls.length} · {yardsBeingShipped} yds)</div>
                <div className="font-mono flex flex-wrap gap-x-2">
                  {rolls.map((r) => (<span key={r.id}>{r.roll_number} ({r.yards}yd)</span>))}
                </div>
              </div>
              <div className="text-[11px] text-gray-500 italic">
                Logged as a partial shipment. Parent order status stays open. Audit event recorded with operator + roll #s + timestamp.
              </div>
            </div>
            <div className="px-5 py-3 border-t border-gray-200 flex items-center justify-end gap-2">
              <Button variant="ghost" onClick={onCancel}>Cancel</Button>
              <Button onClick={onConfirm}>Yes — ship partial</Button>
            </div>
          </div>
        </div>
      </td>
    </tr>
  );
}
