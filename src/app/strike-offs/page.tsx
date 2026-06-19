// S25 Strike-Off List
// 14-status enum, filter by status / customer / colorist, sort by sent date or decision date.
// Cross-link to S26 Strike-Off Detail.
import Link from 'next/link';
import { getDb } from '@/lib/db';
import { Card, CardHeader, Tag, Button } from '@/components/ui';
import { formatDate, relativeTime } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const STATUS_COLORS: Record<string, 'gray' | 'blue' | 'green' | 'yellow' | 'red' | 'purple'> = {
  'Requested': 'gray',
  'In Queue': 'gray',
  'In Color Matching': 'blue',
  'Printing': 'blue',
  'Quality Check': 'blue',
  'Awaiting Approval': 'yellow',
  'Customer Reviewing': 'yellow',
  'Approved': 'green',
  'Approve with Changes': 'purple',
  'Rejected': 'red',
  'Revision Required': 'red',
  'On Hold': 'gray',
  'Cancelled': 'gray',
  'Closed': 'gray',
};

export default function StrikeOffList({ searchParams }: { searchParams: { status?: string; q?: string; sort?: string } }) {
  const db = getDb();
  const statusFilter = searchParams.status ?? 'all';
  const q = (searchParams.q ?? '').trim().toLowerCase();
  const sort = searchParams.sort ?? 'recent';

  const all = db.prepare(`
    SELECT so.*, pr.pr_number, o.order_number, o.roadmap, c.name as company_name,
           u.full_name as colorist_name
    FROM strike_offs so
    JOIN print_requests pr ON so.print_request_id = pr.id
    JOIN order_lines ol ON pr.order_line_id = ol.id
    JOIN orders o ON ol.order_id = o.id
    JOIN companies c ON o.company_id = c.id
    LEFT JOIN users u ON pr.colorist_user_id = u.id
    ORDER BY so.id DESC
  `).all() as any[];

  let rows = all;
  if (statusFilter !== 'all') rows = rows.filter((r) => r.status === statusFilter);
  if (q) rows = rows.filter((r) =>
    r.strike_off_number.toLowerCase().includes(q)
    || r.pr_number.toLowerCase().includes(q)
    || r.order_number.toLowerCase().includes(q)
    || (r.company_name ?? '').toLowerCase().includes(q)
  );
  if (sort === 'customer') rows = [...rows].sort((a, b) => (a.company_name ?? '').localeCompare(b.company_name ?? ''));
  else if (sort === 'status') rows = [...rows].sort((a, b) => a.status.localeCompare(b.status));

  // Status counts for chip row
  const counts: Record<string, number> = {};
  all.forEach((r) => { counts[r.status] = (counts[r.status] ?? 0) + 1; });

  const awaitingCustomer = all.filter((r) => r.status === 'Awaiting Approval' || r.status === 'Customer Reviewing').length;
  const decidedToday = all.filter((r) => r.customer_decision_at && new Date(r.customer_decision_at).toDateString() === new Date().toDateString()).length;
  const blocked = all.filter((r) => r.status === 'Rejected' || r.status === 'Revision Required').length;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Strike-Off List</h1>
          <p className="text-sm text-gray-600 mt-0.5">All strike-offs across R4 / R5 routes — 14-status workflow.</p>
        </div>
        <Button>+ New Strike-Off</Button>
      </header>

      <div className="grid grid-cols-4 gap-4">
        <Stat label="Total active" value={all.length - (counts['Closed'] ?? 0) - (counts['Cancelled'] ?? 0)} />
        <Stat label="Awaiting customer" value={awaitingCustomer} accent="yellow" />
        <Stat label="Decided today" value={decidedToday} accent="green" />
        <Stat label="Blocked (rejected / revision)" value={blocked} accent="red" />
      </div>

      <Card>
        <CardHeader title="Filters" />
        <div className="px-5 py-3 flex flex-wrap items-center gap-2">
          <Link href="/strike-offs" className={`text-xs px-2.5 py-1 rounded ${statusFilter === 'all' ? 'bg-navy-700 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
            All ({all.length})
          </Link>
          {Object.keys(STATUS_COLORS).map((s) => (
            <Link key={s} href={`/strike-offs?status=${encodeURIComponent(s)}`}
              className={`text-xs px-2.5 py-1 rounded ${statusFilter === s ? 'bg-navy-700 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
              {s} ({counts[s] ?? 0})
            </Link>
          ))}
          <form className="ml-auto flex items-center gap-2" action="/strike-offs">
            {statusFilter !== 'all' && <input type="hidden" name="status" value={statusFilter} />}
            <input type="search" name="q" defaultValue={q} placeholder="Search SO# / PR# / Order# / Customer"
              className="text-xs border border-gray-300 rounded px-2 py-1 w-72" />
            <select name="sort" defaultValue={sort} className="text-xs border border-gray-300 rounded px-2 py-1">
              <option value="recent">Most recent</option>
              <option value="customer">By customer</option>
              <option value="status">By status</option>
            </select>
            <Button size="sm" variant="secondary">Apply</Button>
          </form>
        </div>
      </Card>

      <Card>
        <CardHeader title={`${rows.length} Strike-Offs`} action={<Button size="sm" variant="ghost">Export Excel</Button>} />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
              <tr>
                <th className="text-left px-4 py-2.5">SO #</th>
                <th className="text-left px-4 py-2.5">PR #</th>
                <th className="text-left px-4 py-2.5">Order</th>
                <th className="text-left px-4 py-2.5">Customer</th>
                <th className="text-left px-4 py-2.5">Roadmap</th>
                <th className="text-left px-4 py-2.5">Colorist</th>
                <th className="text-left px-4 py-2.5">Status</th>
                <th className="text-left px-4 py-2.5">Sent</th>
                <th className="text-left px-4 py-2.5">Decision</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 100).map((r) => (
                <tr key={r.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-2.5 font-mono text-xs">
                    <Link href={`/strike-offs/${r.id}`} className="text-navy-700 font-semibold hover:underline">{r.strike_off_number}</Link>
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs">
                    <Link href={`/print-requests/${r.print_request_id}`} className="text-navy-700 hover:underline">{r.pr_number}</Link>
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs">{r.order_number}</td>
                  <td className="px-4 py-2.5">{r.company_name}</td>
                  <td className="px-4 py-2.5 font-mono text-xs">{r.roadmap}</td>
                  <td className="px-4 py-2.5">{r.colorist_name ?? <span className="text-gray-300">—</span>}</td>
                  <td className="px-4 py-2.5"><Tag color={STATUS_COLORS[r.status] ?? 'gray'}>{r.status}</Tag></td>
                  <td className="px-4 py-2.5 text-xs text-gray-600">{r.approval_sent_at ? relativeTime(r.approval_sent_at) : <span className="text-gray-300">—</span>}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-600">
                    {r.customer_decision_at ? (
                      <span>
                        {r.customer_decision_outcome}
                        <span className="text-gray-400 ml-1">· {relativeTime(r.customer_decision_at)}</span>
                      </span>
                    ) : <span className="text-gray-300">pending</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: any; accent?: 'yellow' | 'green' | 'red' }) {
  const accentCls = accent === 'yellow' ? 'text-yellow-700'
    : accent === 'green' ? 'text-green-700'
    : accent === 'red' ? 'text-helm-red'
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
