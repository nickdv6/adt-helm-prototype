'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronRight, ChevronDown } from 'lucide-react';
import { StatusPill, Tag } from './ui';
import { formatDate, relativeTime } from '@/lib/utils';

export function OrderRow({ order, prs }: { order: any; prs: any[] }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <>
      <tr className="border-t border-gray-100 hover:bg-gray-50">
        <td className="px-3 py-2.5">
          {prs.length > 0 && (
            <button onClick={() => setExpanded(!expanded)} className="text-gray-400 hover:text-navy-700">
              {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
          )}
        </td>
        <td className="px-3 py-2.5">
          <Link href={`/orders/${order.id}`} className="font-mono text-navy-700 hover:underline font-semibold">
            {order.order_number}
          </Link>
          {order.is_rush ? <Tag color="red">Rush</Tag> : null}
          {order.approval_required && order.status === 'Waiting on Approval'
            ? <Tag color="yellow">Awaiting Megan</Tag>
            : null}
        </td>
        <td className="px-3 py-2.5 font-mono text-xs text-gray-500">{order.po_number || '—'}</td>
        <td className="px-3 py-2.5">{order.company_name}</td>
        <td className="px-3 py-2.5">
          <span className="font-mono text-xs text-gray-500">{order.roadmap}</span>
        </td>
        <td className="px-3 py-2.5"><StatusPill status={order.status} /></td>
        <td className="px-3 py-2.5 text-xs">{formatDate(order.adt_promised_date)}</td>
        <td className="px-3 py-2.5 text-right text-xs text-gray-500">{relativeTime(order.created_at)}</td>
      </tr>
      {expanded && prs.length > 0 && (
        <tr className="bg-gray-50">
          <td colSpan={8} className="px-3 py-2 pl-12">
            <div className="text-[10px] uppercase tracking-wider font-semibold text-gray-500 mb-1.5">
              Child Print Requests ({prs.length})
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
              {prs.map((pr) => (
                <div key={pr.id} className="bg-white border border-gray-200 rounded px-2.5 py-1.5 text-xs flex items-center gap-2">
                  <span className="font-mono text-navy-700 font-semibold">{pr.pr_number}</span>
                  {pr.plant_number && <span className="text-[10px] text-gray-400 font-mono">{pr.plant_number}</span>}
                  <StatusPill status={pr.status} />
                  {pr.is_click_and_print ? <Tag color="purple">C+P</Tag> : null}
                  {pr.was_csv_auto_routed ? <Tag color="blue">Auto-routed</Tag> : null}
                  {pr.internal_proof_status === 'pending' ? <Tag color="yellow">Proof pending</Tag> : null}
                </div>
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
