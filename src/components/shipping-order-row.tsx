'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronRight, ChevronDown, X, AlertTriangle } from 'lucide-react';
import { Tag, Button, StatusPill } from './ui';

// One Ready-to-Ship order row + expandable child PRs + ship/partial-ship confirmation flow.
// Distinguishes three shipment paths per Nick:
//   1. Complete order shipment — all child PRs ship together
//   2. Partial shipment — operator picks a subset
//   3. Individual PR shipment — single PR shipped on its own

type PR = {
  id: number;
  pr_number: string;
  roll_number: string | null;
  status: string;
  planned_yardage: number | null;
  printed_yardage: number | null;
  design_name: string | null;
  colorway_name: string | null;
};

type Order = {
  id: number;
  order_number: string;
  company_name: string;
  promised_label: string;
  is_rush: number;
  is_blind_ship: number;
  is_third_party_billed: number;
  carrier_account_carrier: string | null;
  carrier_account_number: string | null;
};

export function ShippingOrderRow({ order, prs }: { order: Order; prs: PR[] }) {
  const [expanded, setExpanded] = useState(false);
  // selection set tracks which PR ids the operator has chosen for a partial ship
  const [selected, setSelected] = useState<Set<number>>(new Set());
  // confirm modal: null = closed; otherwise either 'partial' (multi-PR subset) or 'individual' (single PR)
  const [confirm, setConfirm] = useState<null | { mode: 'partial' | 'individual'; prIds: number[] }>(null);

  const total = prs.length;
  const selectedCount = selected.size;
  const allSelected = total > 0 && selectedCount === total;

  const toggleOne = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleShipFull = () => {
    // Complete order shipment — no confirmation needed; the action itself is the "ship everything" path
    alert(`(prototype) Shipping COMPLETE order ${order.order_number} — ${total} print request${total !== 1 ? 's' : ''}`);
  };

  const handleShipSelected = () => {
    const prIds = [...selected];
    // If they happen to have selected ALL PRs, treat as full-ship — no partial prompt needed
    if (prIds.length === total) { handleShipFull(); return; }
    setConfirm({ mode: 'partial', prIds });
  };

  const handleShipOne = (prId: number) => {
    // Individual PR shipment when there are siblings still pending = a kind of partial. Trigger
    // the confirm prompt so the operator knows the parent order will stay open.
    if (total > 1) {
      setConfirm({ mode: 'individual', prIds: [prId] });
    } else {
      // Single-PR order — individual ship IS the full ship
      handleShipFull();
    }
  };

  const confirmShip = () => {
    if (!confirm) return;
    const pks = confirm.prIds.map((id) => prs.find((p) => p.id === id)?.pr_number).filter(Boolean).join(', ');
    alert(`(prototype) Shipped ${pks} — parent order ${order.order_number} remains OPEN until remaining PRs ship`);
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
          <span className="text-[11px] text-gray-500 ml-1">{total} PR{total !== 1 ? 's' : ''}</span>
        </td>
        <td className="px-3 py-2.5 text-xs">
          {order.is_third_party_billed
            ? <Tag color="yellow">3rd-Party · {order.carrier_account_carrier} #{order.carrier_account_number}</Tag>
            : <span className="text-gray-500">ADT account</span>}
        </td>
        <td className="px-3 py-2.5 text-right pr-3">
          <Button size="sm" onClick={handleShipFull}>Ship full order</Button>
        </td>
      </tr>

      {/* Expanded panel — per-PR list with selection + individual ship */}
      {expanded && (
        <tr className="bg-gray-50/60">
          <td colSpan={7} className="p-0">
            <div className="px-5 py-3 border-l-2 border-navy-500">
              <div className="flex items-center justify-between mb-2">
                <div className="text-[11px] uppercase tracking-wider text-gray-600 font-semibold">
                  Print Requests on this order ({total})
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-gray-500">{selectedCount} selected</span>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={selectedCount === 0}
                    onClick={handleShipSelected}
                  >
                    {allSelected ? 'Ship selected (all)' : 'Ship selected (partial)'}
                  </Button>
                </div>
              </div>
              <table className="w-full text-xs">
                <thead className="text-gray-500 uppercase tracking-wider border-b border-gray-200">
                  <tr>
                    <th className="w-8 px-2 py-1.5"></th>
                    <th className="text-left px-2 py-1.5">PR #</th>
                    <th className="text-left px-2 py-1.5">Roll #</th>
                    <th className="text-left px-2 py-1.5">Design / Colorway</th>
                    <th className="text-left px-2 py-1.5">Status</th>
                    <th className="text-right px-2 py-1.5">Yards</th>
                    <th className="text-right px-2 py-1.5 pr-3">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {prs.map((pr) => (
                    <tr key={pr.id} className="border-t border-gray-100 hover:bg-white">
                      <td className="px-2 py-1.5">
                        <input
                          type="checkbox"
                          checked={selected.has(pr.id)}
                          onChange={() => toggleOne(pr.id)}
                          className="w-3.5 h-3.5"
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <Link href={`/print-requests/${pr.id}`} className="font-mono text-navy-700 hover:underline font-semibold">{pr.pr_number}</Link>
                      </td>
                      <td className="px-2 py-1.5 font-mono">
                        {pr.roll_number ? <span className="text-navy-700">{pr.roll_number}</span> : <span className="text-gray-400 italic">not yet</span>}
                      </td>
                      <td className="px-2 py-1.5">
                        <span className="font-medium">{pr.design_name || '—'}</span>
                        {pr.colorway_name && <span className="text-gray-500 ml-1.5">· {pr.colorway_name}</span>}
                      </td>
                      <td className="px-2 py-1.5">
                        <StatusPill status={pr.status} />
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono">
                        {pr.printed_yardage ?? '—'}/{pr.planned_yardage ?? '—'}
                      </td>
                      <td className="px-2 py-1.5 text-right pr-3">
                        <Button size="sm" variant="ghost" onClick={() => handleShipOne(pr.id)}>
                          Ship just this PR
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </td>
        </tr>
      )}

      {/* Confirmation modal for partial / individual ship */}
      {confirm && (
        <PartialShipConfirm
          orderNumber={order.order_number}
          mode={confirm.mode}
          prNumbers={confirm.prIds.map((id) => prs.find((p) => p.id === id)?.pr_number || '').filter(Boolean)}
          remainingCount={total - confirm.prIds.length}
          onCancel={() => setConfirm(null)}
          onConfirm={confirmShip}
        />
      )}
    </>
  );
}

function PartialShipConfirm({
  orderNumber, mode, prNumbers, remainingCount, onCancel, onConfirm,
}: {
  orderNumber: string;
  mode: 'partial' | 'individual';
  prNumbers: string[];
  remainingCount: number;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <tr>
      <td colSpan={7} className="p-0">
        <div className="fixed inset-0 z-40 flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-black/40" onClick={onCancel}></div>
          <div className="relative bg-white rounded shadow-2xl w-full max-w-md">
            <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-2 text-yellow-900">
                <AlertTriangle className="w-5 h-5" />
                <div className="text-base font-bold">{mode === 'individual' ? 'Ship single PR?' : 'Confirm partial shipment'}</div>
              </div>
              <button onClick={onCancel} className="text-gray-400 hover:text-gray-700"><X className="w-5 h-5" /></button>
            </div>
            <div className="px-5 py-4 space-y-3 text-sm">
              <p className="text-gray-800">
                You are shipping only part of order <span className="font-mono font-semibold">{orderNumber}</span>.
                The complete order will remain open until the remaining {remainingCount} print request{remainingCount !== 1 ? 's' : ''}
                {remainingCount === 1 ? ' is' : ' are'} shipped. Do you want to continue?
              </p>
              <div className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded p-2.5">
                <div className="font-semibold uppercase tracking-wider text-[10px] mb-1">PRs being shipped now</div>
                <div className="font-mono">{prNumbers.join(' · ')}</div>
              </div>
              <div className="text-[11px] text-gray-500 italic">
                The system will log this as a partial shipment. The parent order's status will stay open. An audit event is recorded with the operator + PRs + timestamp.
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
