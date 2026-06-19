// S46 Strike-Off Dashboard
// Aging buckets + colorist load + customer-side wait + most-overdue strikes.
import Link from 'next/link';
import { getDb } from '@/lib/db';
import { Card, CardHeader, Tag } from '@/components/ui';
import { relativeTime } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default function StrikeOffDashboard() {
  const db = getDb();
  const all = db.prepare(`
    SELECT so.*, pr.pr_number, o.order_number, c.name as company_name, c.id as company_id,
           u.full_name as colorist_name
    FROM strike_offs so
    JOIN print_requests pr ON so.print_request_id = pr.id
    JOIN order_lines ol ON pr.order_line_id = ol.id
    JOIN orders o ON ol.order_id = o.id
    JOIN companies c ON o.company_id = c.id
    LEFT JOIN users u ON pr.colorist_user_id = u.id
  `).all() as any[];

  const open = all.filter((s) => !['Closed','Cancelled','Approved'].includes(s.status));
  const awaitingCust = all.filter((s) => ['Awaiting Approval','Customer Reviewing'].includes(s.status));
  const approved = all.filter((s) => s.status === 'Approved');
  const changes = all.filter((s) => s.status === 'Approve with Changes');
  const rejected = all.filter((s) => s.status === 'Rejected' || s.status === 'Revision Required');

  // Aging buckets — days since sent (for awaiting) or days since created (for in-progress)
  const now = Date.now();
  function ageDays(iso: string | null): number | null {
    if (!iso) return null;
    return Math.floor((now - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
  }
  const ageBucket = { '<3d': 0, '3-7d': 0, '8-14d': 0, '>14d': 0 };
  awaitingCust.forEach((s) => {
    const d = ageDays(s.approval_sent_at);
    if (d === null) return;
    if (d < 3) ageBucket['<3d']++;
    else if (d <= 7) ageBucket['3-7d']++;
    else if (d <= 14) ageBucket['8-14d']++;
    else ageBucket['>14d']++;
  });

  // Customer-side wait leaderboard
  const byCustomer = new Map<string, { name: string; id: number; awaiting: number; oldest: number }>();
  awaitingCust.forEach((s) => {
    const e = byCustomer.get(s.company_name) ?? { name: s.company_name, id: s.company_id, awaiting: 0, oldest: 0 };
    e.awaiting++;
    const d = ageDays(s.approval_sent_at) ?? 0;
    if (d > e.oldest) e.oldest = d;
    byCustomer.set(s.company_name, e);
  });
  const custList = Array.from(byCustomer.values()).sort((a, b) => b.oldest - a.oldest).slice(0, 8);

  // Colorist load
  const byColorist = new Map<string, number>();
  open.forEach((s) => {
    const n = s.colorist_name ?? '—';
    byColorist.set(n, (byColorist.get(n) ?? 0) + 1);
  });

  // Most overdue
  const overdue = [...awaitingCust]
    .map((s) => ({ ...s, age: ageDays(s.approval_sent_at) ?? 0 }))
    .sort((a, b) => b.age - a.age)
    .slice(0, 10);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-navy-900">Strike-Off Dashboard</h1>
        <p className="text-sm text-gray-600 mt-0.5">Workflow health — aging, customer wait time, colorist load, blockers.</p>
      </header>

      <div className="grid grid-cols-5 gap-4">
        <Stat label="Open strikes" value={open.length} />
        <Stat label="Awaiting customer" value={awaitingCust.length} accent="yellow" />
        <Stat label="Approved (lifetime)" value={approved.length} accent="green" />
        <Stat label="Approve with changes" value={changes.length} accent="purple" />
        <Stat label="Rejected / revision" value={rejected.length} accent="red" />
      </div>

      <div className="grid grid-cols-2 gap-6">
        <Card>
          <CardHeader title="Customer-Side Aging" subtitle="Days since strike sent to customer (awaiting response)" />
          <div className="p-5">
            <div className="grid grid-cols-4 gap-3">
              {Object.entries(ageBucket).map(([bucket, count]) => (
                <div key={bucket} className="border border-gray-200 rounded p-3 text-center">
                  <div className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">{bucket}</div>
                  <div className={`text-2xl font-bold mt-1 ${bucket === '>14d' && count > 0 ? 'text-helm-red' : 'text-navy-900'}`}>{count}</div>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="Colorist Load" subtitle="Open strikes by colorist on the bench" />
          <div className="p-5 space-y-2">
            {Array.from(byColorist.entries()).sort((a, b) => b[1] - a[1]).map(([name, n]) => (
              <div key={name} className="flex items-center justify-between text-sm">
                <span className="font-semibold text-navy-700">{name}</span>
                <div className="flex items-center gap-2">
                  <div className="w-32 h-2 bg-gray-100 rounded">
                    <div className="h-2 bg-navy-700 rounded" style={{ width: `${Math.min(100, n * 8)}%` }} />
                  </div>
                  <span className="font-mono text-xs w-8 text-right">{n}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader title="Customer Wait Leaderboard" subtitle="Customers we're waiting on — sorted by oldest strike" />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
              <tr>
                <th className="text-left px-4 py-2.5">Customer</th>
                <th className="text-left px-4 py-2.5">Strikes awaiting</th>
                <th className="text-left px-4 py-2.5">Oldest age</th>
              </tr>
            </thead>
            <tbody>
              {custList.map((c) => (
                <tr key={c.name} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-2.5">
                    <Link href={`/customers/${c.id}`} className="text-navy-700 font-semibold hover:underline">{c.name}</Link>
                  </td>
                  <td className="px-4 py-2.5 font-mono">{c.awaiting}</td>
                  <td className={`px-4 py-2.5 font-mono ${c.oldest > 14 ? 'text-helm-red font-bold' : c.oldest > 7 ? 'text-yellow-700' : ''}`}>
                    {c.oldest}d
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <CardHeader title="Most Overdue Strikes" subtitle="Awaiting customer — top 10 by age" />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
              <tr>
                <th className="text-left px-4 py-2.5">SO #</th>
                <th className="text-left px-4 py-2.5">Customer</th>
                <th className="text-left px-4 py-2.5">Order</th>
                <th className="text-left px-4 py-2.5">PR</th>
                <th className="text-left px-4 py-2.5">Sent</th>
                <th className="text-left px-4 py-2.5">Age</th>
              </tr>
            </thead>
            <tbody>
              {overdue.map((s) => (
                <tr key={s.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-2.5 font-mono text-xs">
                    <Link href={`/strike-offs/${s.id}`} className="text-navy-700 font-semibold hover:underline">{s.strike_off_number}</Link>
                  </td>
                  <td className="px-4 py-2.5">{s.company_name}</td>
                  <td className="px-4 py-2.5 font-mono text-xs">{s.order_number}</td>
                  <td className="px-4 py-2.5 font-mono text-xs">{s.pr_number}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-500">{s.approval_sent_at ? relativeTime(s.approval_sent_at) : '—'}</td>
                  <td className={`px-4 py-2.5 font-mono text-xs ${s.age > 14 ? 'text-helm-red font-bold' : 'text-yellow-700'}`}>{s.age}d</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: any; accent?: 'yellow' | 'green' | 'red' | 'purple' }) {
  const accentCls = accent === 'yellow' ? 'text-yellow-700'
    : accent === 'green' ? 'text-green-700'
    : accent === 'red' ? 'text-helm-red'
    : accent === 'purple' ? 'text-purple-700'
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
