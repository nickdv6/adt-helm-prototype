import Link from 'next/link';
import { getDb } from '@/lib/db';
import { Card, CardHeader, StatusPill, Tag } from '@/components/ui';
import { formatDate, relativeTime } from '@/lib/utils';

// S03 Megan Tabbed Home
// Per S23-S32.50 (Megan A4): 4 tabs — Approvals / Production / Sales (intake) / Accounting Hand-Off
// Per Decision 8.10: today + 7 days default window
// Per OD-3: Approvals tab is THE work surface for the 6-trigger gate queue
// Helm policy: financial figures are NOT surfaced on operational pages — accounting lives in QuickBooks

export default function MeganHome({ searchParams }: { searchParams: { tab?: string } }) {
  const db = getDb();
  const tab = searchParams?.tab ?? 'approvals';

  // Aggregated counts for tab badges
  const tabCounts = {
    sales: (db.prepare(`SELECT COUNT(*) as c FROM orders WHERE status IN ('Draft','Validated') AND date(created_at) >= date('now', '-7 days')`).get() as any).c,
    production: (db.prepare(`SELECT COUNT(*) as c FROM orders WHERE status IN ('In Production','Partially Complete')`).get() as any).c,
    finance: (db.prepare(`SELECT COUNT(*) as c FROM orders WHERE status IN ('Shipped','Invoiced') AND date(created_at) >= date('now', '-30 days')`).get() as any).c,
    approvals: (db.prepare(`SELECT COUNT(*) as c FROM orders WHERE status = 'Waiting on Approval'`).get() as any).c,
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-navy-900">Megan's Home (S03)</h1>
        <p className="text-sm text-gray-500 mt-1">4-tab production manager workspace · per S23-S32.50</p>
      </header>

      {/* Tab nav */}
      <div className="border-b border-gray-200 flex gap-1">
        <TabLink href="/megan?tab=approvals" label="Approvals (OD-3 Gate)" count={tabCounts.approvals} active={tab === 'approvals'} accent="yellow" />
        <TabLink href="/megan?tab=production" label="Production" count={tabCounts.production} active={tab === 'production'} />
        <TabLink href="/megan?tab=sales" label="Sales / Pipeline" count={tabCounts.sales} active={tab === 'sales'} />
        <TabLink href="/megan?tab=finance" label="Accounting Hand-Off" count={tabCounts.finance} active={tab === 'finance'} />
      </div>

      {tab === 'approvals' && <ApprovalsTab />}
      {tab === 'production' && <ProductionTab />}
      {tab === 'sales' && <SalesTab />}
      {tab === 'finance' && <FinanceTab />}
    </div>
  );
}

function ApprovalsTab() {
  const db = getDb();
  const queue = db.prepare(`
    SELECT o.id, o.order_number, c.name as company_name, o.is_rush,
           o.trigger_reason, o.trigger_source, o.adt_promised_date, o.created_at,
           o.source_system
    FROM orders o JOIN companies c ON o.company_id = c.id
    WHERE o.status = 'Waiting on Approval'
    ORDER BY o.is_rush DESC, o.created_at ASC
  `).all() as any[];

  const reasonStats = db.prepare(`
    SELECT trigger_reason, COUNT(*) as c FROM orders
    WHERE status = 'Waiting on Approval' AND trigger_reason IS NOT NULL
    GROUP BY trigger_reason
  `).all() as any[];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <Stat label="In Queue" value={queue.length} accent="yellow" />
        <Stat label="Rush in Queue" value={queue.filter((q) => q.is_rush).length} accent="red" />
        <Stat label="Oldest in Queue" value={queue.length > 0 ? relativeTime([...queue].sort((a, b) => a.created_at.localeCompare(b.created_at))[0].created_at) : '—'} />
      </div>

      <Card>
        <CardHeader title="Approval Queue" subtitle="6-trigger gate per OD-3 · OR logic · prioritized by rush + age" />
        <table className="w-full text-sm">
          <thead className="text-xs text-gray-500 uppercase tracking-wider border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-2.5">Order #</th>
              <th className="text-left px-4 py-2.5">Customer</th>
              <th className="text-left px-4 py-2.5">Trigger(s)</th>
              <th className="text-left px-4 py-2.5">Source</th>
              <th className="text-left px-4 py-2.5">Promised</th>
              <th className="text-right px-4 py-2.5">Age in Queue</th>
              <th className="text-right px-4 py-2.5 pr-5">Action</th>
            </tr>
          </thead>
          <tbody>
            {queue.length === 0 && (
              <tr><td colSpan={7} className="text-center py-10 text-gray-400">Approval queue is empty.</td></tr>
            )}
            {queue.map((o) => (
              <tr key={o.id} className="border-t border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-2.5">
                  <Link href={`/orders/${o.id}`} className="font-mono font-semibold text-navy-700 hover:underline">{o.order_number}</Link>
                  {o.is_rush ? <Tag color="red">Rush</Tag> : null}
                </td>
                <td className="px-4 py-2.5">{o.company_name}</td>
                <td className="px-4 py-2.5">
                  {(o.trigger_reason || '').split(' + ').filter(Boolean).map((t: string) => (
                    <Tag key={t} color={t === 'rush' || t === 'prior_issue' ? 'red' : t === 'high_value' ? 'yellow' : 'gray'}>{t}</Tag>
                  ))}
                </td>
                <td className="px-4 py-2.5 text-xs text-gray-500">{o.trigger_source || '—'}</td>
                <td className="px-4 py-2.5 text-xs">{formatDate(o.adt_promised_date)}</td>
                <td className="px-4 py-2.5 text-right text-xs text-gray-500">{relativeTime(o.created_at)}</td>
                <td className="px-4 py-2.5 pr-5 text-right">
                  <Link href={`/orders/${o.id}`} className="text-xs font-semibold text-navy-700 hover:underline">Review →</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card>
        <CardHeader title="Trigger Distribution" subtitle="Why are these in queue?" />
        <div className="px-5 py-4 space-y-1.5">
          {reasonStats.length === 0 && <div className="text-xs text-gray-400">No triggered orders.</div>}
          {reasonStats.map((r) => (
            <div key={r.trigger_reason} className="flex items-center gap-3 text-sm">
              <div className="w-48 text-xs font-mono text-gray-600">{r.trigger_reason}</div>
              <div className="flex-1 bg-gray-100 h-2 rounded">
                <div className="bg-navy-700 h-2 rounded" style={{ width: `${(r.c / queue.length) * 100}%` }} />
              </div>
              <div className="text-xs w-10 text-right">{r.c}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function ProductionTab() {
  const db = getDb();
  const inProd = db.prepare(`
    SELECT o.id, o.order_number, c.name as company_name, o.adt_promised_date, o.roadmap, o.is_rush
    FROM orders o JOIN companies c ON o.company_id = c.id
    WHERE o.status IN ('In Production', 'Partially Complete')
    ORDER BY date(o.adt_promised_date) ASC LIMIT 40
  `).all() as any[];

  const prByStatus = db.prepare(`
    SELECT status, COUNT(*) as c FROM print_requests
    WHERE status NOT IN ('Complete', 'Cancelled')
    GROUP BY status ORDER BY c DESC
  `).all() as any[];

  const today = db.prepare(`
    SELECT COUNT(*) as c FROM orders WHERE date(adt_promised_date) = date('now') AND status NOT IN ('Closed','Shipped','Invoiced','Cancelled')
  `).get() as any;
  const overdue = db.prepare(`
    SELECT COUNT(*) as c FROM orders WHERE adt_promised_date IS NOT NULL AND date(adt_promised_date) < date('now') AND status NOT IN ('Closed','Shipped','Invoiced','Cancelled')
  `).get() as any;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-4">
        <Stat label="Active in Production" value={inProd.length} accent="blue" />
        <Stat label="Due Today" value={today.c} accent="yellow" />
        <Stat label="Overdue" value={overdue.c} accent="red" />
        <Stat label="Open PRs" value={prByStatus.reduce((s, r) => s + r.c, 0)} />
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2">
          <Card>
            <CardHeader title="Orders in Production" subtitle="Soonest promised first" />
            <table className="w-full text-sm">
              <thead className="text-xs text-gray-500 uppercase tracking-wider border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-2.5">Order #</th>
                  <th className="text-left px-4 py-2.5">Customer</th>
                  <th className="text-left px-4 py-2.5">Roadmap</th>
                  <th className="text-left px-4 py-2.5 pr-5">Promised</th>
                </tr>
              </thead>
              <tbody>
                {inProd.map((o) => (
                  <tr key={o.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-2.5">
                      <Link href={`/orders/${o.id}`} className="font-mono text-navy-700 hover:underline font-semibold">{o.order_number}</Link>
                      {o.is_rush ? <Tag color="red">Rush</Tag> : null}
                    </td>
                    <td className="px-4 py-2.5">{o.company_name}</td>
                    <td className="px-4 py-2.5 font-mono text-xs">{o.roadmap}</td>
                    <td className="px-4 py-2.5 text-xs pr-5">{formatDate(o.adt_promised_date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
        <Card>
          <CardHeader title="PR Status Mix" />
          <div className="px-5 py-4 space-y-2">
            {prByStatus.map((r) => (
              <div key={r.status} className="flex items-center justify-between text-sm">
                <StatusPill status={r.status} />
                <span className="font-mono text-xs">{r.c}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

function SalesTab() {
  const db = getDb();
  const recent = db.prepare(`
    SELECT o.id, o.order_number, c.name as company_name, o.status, o.created_at, o.source_system
    FROM orders o JOIN companies c ON o.company_id = c.id
    WHERE date(o.created_at) >= date('now', '-7 days')
    ORDER BY o.created_at DESC LIMIT 25
  `).all() as any[];

  const bySource = db.prepare(`
    SELECT source_system, COUNT(*) as c FROM orders
    WHERE date(created_at) >= date('now', '-30 days')
    GROUP BY source_system ORDER BY c DESC
  `).all() as any[];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="New Orders (Last 7 Days)" subtitle="All intake sources combined" />
        <table className="w-full text-sm">
          <thead className="text-xs text-gray-500 uppercase tracking-wider border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-2.5">Order #</th>
              <th className="text-left px-4 py-2.5">Customer</th>
              <th className="text-left px-4 py-2.5">Source</th>
              <th className="text-left px-4 py-2.5">Status</th>
              <th className="text-right px-4 py-2.5 pr-5">Age</th>
            </tr>
          </thead>
          <tbody>
            {recent.map((o) => (
              <tr key={o.id} className="border-t border-gray-100">
                <td className="px-4 py-2.5"><Link href={`/orders/${o.id}`} className="font-mono text-navy-700 hover:underline">{o.order_number}</Link></td>
                <td className="px-4 py-2.5">{o.company_name}</td>
                <td className="px-4 py-2.5 text-xs text-gray-500">{o.source_system}</td>
                <td className="px-4 py-2.5"><StatusPill status={o.status} /></td>
                <td className="px-4 py-2.5 text-right text-xs text-gray-500 pr-5">{relativeTime(o.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <Card>
        <CardHeader title="Order Volume by Source (Last 30 Days)" subtitle="Which intake channels are driving operational load" />
        <table className="w-full text-sm">
          <thead className="text-xs text-gray-500 uppercase tracking-wider border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-2.5">Source System</th>
              <th className="text-right px-4 py-2.5 pr-5">Order Count</th>
            </tr>
          </thead>
          <tbody>
            {bySource.map((r) => (
              <tr key={r.source_system} className="border-t border-gray-100">
                <td className="px-4 py-2.5 text-xs font-mono">{r.source_system}</td>
                <td className="px-4 py-2.5 text-right font-mono pr-5">{r.c}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function FinanceTab() {
  const db = getDb();
  const shipped = db.prepare(`SELECT COUNT(*) as c FROM orders WHERE status IN ('Shipped','Invoiced') AND date(created_at) >= date('now', '-30 days')`).get() as any;
  const closed = db.prepare(`SELECT COUNT(*) as c FROM orders WHERE status = 'Closed' AND date(created_at) >= date('now', '-30 days')`).get() as any;
  const readyForInvoice = db.prepare(`SELECT COUNT(*) as c FROM orders WHERE status = 'Shipped' AND date(created_at) >= date('now', '-30 days')`).get() as any;
  const onHold = db.prepare(`SELECT o.id, o.order_number, c.name as cn, o.status FROM orders o JOIN companies c ON o.company_id = c.id WHERE o.status = 'On Hold'`).all() as any[];
  const creditHold = db.prepare(`SELECT id, name FROM companies WHERE is_credit_hold = 1`).all() as any[];

  return (
    <div className="space-y-6">
      <div className="text-xs text-gray-500 italic">
        Helm tracks operational handoff to accounting — order counts, hold statuses, invoice-ready flags. Dollar amounts, invoice totals, and A/R balances live in QuickBooks; Helm does not surface them on this page.
      </div>
      <div className="grid grid-cols-3 gap-4">
        <Stat label="Shipped Last 30d" value={shipped.c} accent="green" />
        <Stat label="Ready to Invoice (QB Hand-off)" value={readyForInvoice.c} accent="yellow" />
        <Stat label="Closed Last 30d" value={closed.c} />
      </div>
      <div className="grid grid-cols-2 gap-6">
        <Card>
          <CardHeader title="On Hold" subtitle="Orders parked pending CSR / Megan / customer action" />
          <div className="divide-y divide-gray-100">
            {onHold.length === 0 && <div className="px-5 py-6 text-xs text-gray-400">No orders on hold.</div>}
            {onHold.map((o) => (
              <div key={o.id} className="px-5 py-2.5 flex items-center justify-between text-sm">
                <div>
                  <Link href={`/orders/${o.id}`} className="font-mono text-navy-700 hover:underline">{o.order_number}</Link>
                  <span className="text-gray-500 ml-2 text-xs">{o.cn}</span>
                </div>
                <StatusPill status={o.status} />
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <CardHeader title="Customers on Credit Hold" subtitle="Helm flag set; balance / collections handled in QuickBooks" />
          <div className="divide-y divide-gray-100">
            {creditHold.length === 0 && <div className="px-5 py-6 text-xs text-gray-400">No credit holds.</div>}
            {creditHold.map((c) => (
              <div key={c.id} className="px-5 py-2.5 flex items-center justify-between text-sm">
                <Link href={`/customers/${c.id}`} className="text-navy-700 hover:underline">{c.name}</Link>
                <Tag color="red">Hold</Tag>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

function TabLink({ href, label, count, active, accent }: { href: string; label: string; count: number; active: boolean; accent?: 'yellow' }) {
  const cls = active
    ? 'border-navy-700 text-navy-900'
    : 'border-transparent text-gray-500 hover:text-navy-700 hover:border-gray-300';
  const badgeCls = accent === 'yellow' && count > 0
    ? 'bg-helm-yellow text-yellow-900'
    : active ? 'bg-navy-100 text-navy-700' : 'bg-gray-100 text-gray-600';
  return (
    <Link href={href} className={`px-4 py-2.5 border-b-2 text-sm font-semibold flex items-center gap-2 ${cls}`}>
      {label}
      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${badgeCls}`}>{count}</span>
    </Link>
  );
}

function Stat({ label, value, accent }: { label: string; value: any; accent?: 'yellow' | 'red' | 'green' | 'blue' }) {
  const bar = {
    yellow: 'bg-helm-yellow', red: 'bg-helm-red', green: 'bg-helm-green', blue: 'bg-helm-blue',
  }[accent || ''] || 'bg-gray-200';
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
