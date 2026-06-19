import Link from 'next/link';
import { StatusPill, Tag } from './ui';
import { formatPromised } from '@/lib/utils';

// Compact, single-row order summary for the Order Dashboard.
// Left accent stripe encodes priority (late > rush > attention > normal).
// Order# + PO# stack vertically. Status + PR-mix summary stack vertically.
// No expand — child PRs live on the Order Detail page.

type PR = { id: number; pr_number: string; status: string };

const FINISHED_STATUSES = new Set(['Closed', 'Shipped', 'Invoiced', 'Cancelled']);

function priorityFor(order: any): {
  accent: 'red' | 'yellow' | null;
  badges: { label: string; color: 'red' | 'yellow' }[];
} {
  const badges: { label: string; color: 'red' | 'yellow' }[] = [];
  // Late status can ONLY be computed against the Promised Date. Pre-approval orders that have
  // only an Estimated Ship Date can never be Late — ADT hasn't committed to that date.
  const promised = order.adt_promised_date ? new Date(order.adt_promised_date) : null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const isLate = !!(promised && promised < today && !FINISHED_STATUSES.has(order.status));

  if (isLate) badges.push({ label: 'Late', color: 'red' });
  if (order.is_rush && !FINISHED_STATUSES.has(order.status)) badges.push({ label: 'Rush', color: 'red' });
  if (order.status === 'On Hold') badges.push({ label: 'On Hold', color: 'yellow' });
  if (order.status === 'Waiting on Approval') badges.push({ label: 'Approval', color: 'yellow' });

  const accent: 'red' | 'yellow' | null =
    isLate || (order.is_rush && !FINISHED_STATUSES.has(order.status)) ? 'red'
    : order.status === 'On Hold' || order.status === 'Waiting on Approval' ? 'yellow'
    : null;

  return { accent, badges };
}

function summarizePRs(prs: PR[]): string {
  if (prs.length === 0) return '—';
  const byStatus = new Map<string, number>();
  prs.forEach((pr) => byStatus.set(pr.status, (byStatus.get(pr.status) || 0) + 1));
  // Show up to 2 most-populated buckets compactly
  const entries = [...byStatus.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2);
  const summary = entries.map(([s, n]) => `${n} ${s.toLowerCase()}`).join(' · ');
  return `${prs.length} PR${prs.length !== 1 ? 's' : ''} · ${summary}`;
}

export function OrderRow({ order, prs }: { order: any; prs: PR[] }) {
  const { accent, badges } = priorityFor(order);
  // If the order has been approved for production, render the Promised Date (commitment).
  // Otherwise render the Estimated Ship Date with a "pending approval" qualifier — ADT has
  // not committed to a date until approval.
  const hasPromised = !!order.adt_promised_date;
  const dateLabel = formatPromised(hasPromised ? order.adt_promised_date : order.estimated_ship_date);
  const accentBg = accent === 'red' ? 'bg-red-500' : accent === 'yellow' ? 'bg-yellow-400' : '';
  const rowBg = accent === 'red' ? 'hover:bg-red-50/40' : 'hover:bg-gray-50';

  return (
    <tr className={`border-t border-gray-100 transition-colors ${rowBg}`}>
      {/* Priority accent stripe */}
      <td className="p-0 w-1">
        {accent && <div className={`w-1 h-12 ${accentBg}`} />}
      </td>

      {/* Order # + PO # stacked */}
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-2">
          <Link href={`/orders/${order.id}`} className="font-mono text-navy-700 hover:underline font-semibold">
            {order.order_number}
          </Link>
          {badges.map((b) => (
            <Tag key={b.label} color={b.color}>{b.label}</Tag>
          ))}
        </div>
        {order.po_number && (
          <div className="text-[11px] text-gray-400 font-mono mt-0.5">PO {order.po_number}</div>
        )}
      </td>

      {/* Customer */}
      <td className="px-3 py-2.5">{order.company_name}</td>

      {/* Roadmap */}
      <td className="px-3 py-2.5">
        <span className="font-mono text-xs text-gray-500">{order.roadmap}</span>
      </td>

      {/* Status + PR mix stacked */}
      <td className="px-3 py-2.5">
        <StatusPill status={order.status} />
        <div className="text-[11px] text-gray-500 mt-0.5">{summarizePRs(prs)}</div>
      </td>

      {/* Assigned To */}
      <td className="px-3 py-2.5 text-xs">
        {order.assigned_to_name || <span className="text-gray-400 italic">unassigned</span>}
      </td>

      {/* Promised (commitment) or Estimated (pre-approval, no commitment yet) */}
      <td className="px-3 py-2.5">
        {hasPromised ? (
          <div className={`text-sm ${dateLabel.isLate ? 'text-red-700 font-semibold' : ''}`}>
            {dateLabel.label}
          </div>
        ) : (
          <div className="text-sm">
            <span className="text-gray-700">{dateLabel.label}</span>
            <div className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold mt-0.5">Est. · pending approval</div>
          </div>
        )}
      </td>
    </tr>
  );
}
