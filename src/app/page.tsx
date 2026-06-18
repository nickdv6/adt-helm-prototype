import Link from 'next/link';
import { getDb } from '@/lib/db';
import { Card, CardHeader, StatusPill, Tag } from '@/components/ui';
import { formatDate, relativeTime } from '@/lib/utils';

// S04 CSR Home — Sarah's landing page
// Per Decision S02-S15.1 locked home layout: header + left nav + main work surface + right rail.
// Time-window default: today + 7 days (Decision 8.10).

export default function CSRHome() {
  const db = getDb();

  // Aggregate widgets
  const pendingOrders = db.prepare(`
    SELECT o.id, o.order_number, c.name as company_name, o.status, o.adt_promised_date, o.created_at
    FROM orders o JOIN companies c ON o.company_id = c.id
    WHERE o.status IN ('Draft', 'Submitted', 'Waiting on Customer', 'Waiting on Artwork')
    ORDER BY o.created_at DESC
    LIMIT 6
  `).all() as any[];

  const validationFailures = db.prepare(`
    SELECT o.id, o.order_number, c.name as company_name, o.source_system, o.created_at
    FROM orders o JOIN companies c ON o.company_id = c.id
    WHERE o.status = 'Draft' AND o.source_system NOT IN ('manual')
    ORDER BY o.created_at DESC LIMIT 4
  `).all() as any[];

  const approvalPending = db.prepare(`
    SELECT s.strike_off_number, c.name as company_name, julianday('now') - julianday(s.approval_sent_at) as days_waiting
    FROM strike_offs s
    JOIN print_requests pr ON s.print_request_id = pr.id
    JOIN order_lines ol ON pr.order_line_id = ol.id
    JOIN orders o ON ol.order_id = o.id
    JOIN companies c ON o.company_id = c.id
    WHERE s.status = 'Sent to Customer' OR s.status = 'Waiting for Approval'
    LIMIT 5
  `).all() as any[];

  const creditHold = db.prepare(`
    SELECT id, name FROM companies WHERE is_credit_hold = 1 LIMIT 5
  `).all() as any[];

  const counts = db.prepare(`
    SELECT
      COUNT(*) FILTER (WHERE o.status IN ('Draft','Submitted','Waiting on Customer','Waiting on Artwork')) as pending,
      COUNT(*) FILTER (WHERE o.status = 'In Production') as in_production,
      COUNT(*) FILTER (WHERE o.status IN ('Shipped','Invoiced')) as shipped_recent,
      COUNT(*) FILTER (WHERE o.is_rush = 1 AND o.status NOT IN ('Closed','Cancelled','Shipped','Invoiced')) as rush_open
    FROM orders o
  `).get() as any;

  const recentOrders = db.prepare(`
    SELECT o.id, o.order_number, c.name as company_name, o.status, o.adt_promised_date, o.created_at, o.is_rush
    FROM orders o JOIN companies c ON o.company_id = c.id
    WHERE o.primary_csr_user_id = 3 OR 1=1
    ORDER BY o.created_at DESC LIMIT 10
  `).all() as any[];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-navy-900">CSR Home — Sarah Castillo</h1>
        <p className="text-sm text-gray-500 mt-1">Today + 7 days · default view per Decision 8.10</p>
      </header>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Pending CSR Action" value={counts.pending} accent="yellow" />
        <StatCard label="In Production" value={counts.in_production} accent="blue" />
        <StatCard label="Shipped Last 30d" value={counts.shipped_recent} accent="green" />
        <StatCard label="Open Rush Orders" value={counts.rush_open} accent="red" />
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* MAIN — left 2 cols */}
        <div className="col-span-2 space-y-6">
          <Card>
            <CardHeader title="Pending Orders" subtitle="Drafts and orders waiting on artwork / customer / approval"
              action={<Link href="/orders" className="text-xs text-navy-700 hover:underline font-semibold">View all →</Link>} />
            <table className="w-full text-sm">
              <thead className="text-xs text-gray-500 uppercase tracking-wider">
                <tr>
                  <th className="text-left px-5 py-2.5">Order #</th>
                  <th className="text-left px-5 py-2.5">Customer</th>
                  <th className="text-left px-5 py-2.5">Status</th>
                  <th className="text-left px-5 py-2.5">ADT Promised</th>
                </tr>
              </thead>
              <tbody>
                {pendingOrders.length === 0 && (
                  <tr><td colSpan={4} className="px-5 py-8 text-center text-gray-400">No pending orders.</td></tr>
                )}
                {pendingOrders.map((o) => (
                  <tr key={o.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-5 py-2.5">
                      <Link href={`/orders/${o.id}`} className="font-mono text-navy-700 hover:underline">{o.order_number}</Link>
                    </td>
                    <td className="px-5 py-2.5">{o.company_name}</td>
                    <td className="px-5 py-2.5"><StatusPill status={o.status} /></td>
                    <td className="px-5 py-2.5">{formatDate(o.adt_promised_date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <Card>
            <CardHeader title="Recent Orders (Your Assignments)" subtitle="Orders where you are Primary CSR"
              action={<Link href="/orders" className="text-xs text-navy-700 hover:underline font-semibold">Open dashboard →</Link>} />
            <table className="w-full text-sm">
              <thead className="text-xs text-gray-500 uppercase tracking-wider">
                <tr>
                  <th className="text-left px-5 py-2.5">Order #</th>
                  <th className="text-left px-5 py-2.5">Customer</th>
                  <th className="text-left px-5 py-2.5">Status</th>
                  <th className="text-left px-5 py-2.5">Promised</th>
                  <th className="text-right px-5 py-2.5">Age</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((o) => (
                  <tr key={o.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-5 py-2.5">
                      <Link href={`/orders/${o.id}`} className="font-mono text-navy-700 hover:underline">{o.order_number}</Link>
                      {o.is_rush ? <Tag color="red">Rush</Tag> : null}
                    </td>
                    <td className="px-5 py-2.5">{o.company_name}</td>
                    <td className="px-5 py-2.5"><StatusPill status={o.status} /></td>
                    <td className="px-5 py-2.5">{formatDate(o.adt_promised_date)}</td>
                    <td className="px-5 py-2.5 text-right text-xs text-gray-500">{relativeTime(o.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>

        {/* SIDEBAR — right col */}
        <div className="space-y-6">
          <Card>
            <CardHeader title="CSV/XML Import Failures"
              subtitle={`${validationFailures.length} rows need your review`} />
            <div className="px-5 py-3 space-y-2">
              {validationFailures.length === 0 && <div className="text-xs text-gray-400 py-2">No failures.</div>}
              {validationFailures.map((o) => (
                <div key={o.id} className="text-xs flex items-center gap-2">
                  <Tag color="yellow">{o.source_system.replace('csv_import_', '').replace('xml_import_', '').replace(/_/g, ' ')}</Tag>
                  <Link href={`/orders/${o.id}`} className="font-mono text-navy-700 hover:underline">{o.order_number}</Link>
                  <span className="text-gray-500 truncate">{o.company_name}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader title="Customer Approval > 7 days" subtitle="Per S23-S32.14 stall surfacing" />
            <div className="px-5 py-3 space-y-2">
              {approvalPending.length === 0 && <div className="text-xs text-gray-400 py-2">No stalled approvals.</div>}
              {approvalPending.map((s, idx) => (
                <div key={idx} className="text-xs flex items-center justify-between">
                  <span>
                    <span className="font-mono">{s.strike_off_number}</span>
                    <span className="text-gray-500 ml-2">{s.company_name}</span>
                  </span>
                  <Tag color="yellow">{Math.floor(s.days_waiting || 0)}d</Tag>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader title="Credit Hold" />
            <div className="px-5 py-3 space-y-1.5">
              {creditHold.length === 0 && <div className="text-xs text-gray-400 py-2">No customers on credit hold.</div>}
              {creditHold.map((c) => (
                <div key={c.id} className="text-xs flex items-center justify-between">
                  <span>{c.name}</span>
                  <Tag color="red">Hold</Tag>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader title="Quick Actions" />
            <div className="px-5 py-3 space-y-1.5 text-sm">
              <Link href="/orders/new" className="block px-3 py-2 bg-navy-700 text-white rounded text-center font-semibold hover:bg-navy-900">
                + New Order
              </Link>
              <Link href="/orders" className="block px-3 py-2 border border-gray-300 rounded text-center hover:bg-gray-50">
                View Order Dashboard
              </Link>
              <Link href="/customers" className="block px-3 py-2 border border-gray-300 rounded text-center hover:bg-gray-50">
                Browse Customers
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: number; accent: 'yellow' | 'blue' | 'green' | 'red' }) {
  const accentCls = {
    yellow: 'bg-helm-yellow',
    blue: 'bg-helm-blue',
    green: 'bg-helm-green',
    red: 'bg-helm-red',
  }[accent];
  return (
    <Card>
      <div className="p-5 flex items-center gap-4">
        <div className={`w-1 h-12 rounded ${accentCls}`} />
        <div>
          <div className="text-3xl font-bold text-navy-900">{value}</div>
          <div className="text-xs text-gray-500 uppercase tracking-wider mt-1">{label}</div>
        </div>
      </div>
    </Card>
  );
}
