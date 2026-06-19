// S53 Quality Dashboard
// Reprint rate, internal-proof fail rate, RIP recalls, top reprint reasons,
// strike-off rejection rate by customer.
import Link from 'next/link';
import { getDb } from '@/lib/db';
import { Card, CardHeader, Tag } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default function QualityDashboard() {
  const db = getDb();

  // Overall reprint rate (last 90 days of created PRs)
  const reprintStats = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN reprint_of_pr_id IS NOT NULL THEN 1 ELSE 0 END) as reprints
    FROM print_requests
    WHERE date(created_at) >= date('now','-90 days')
  `).get() as any;
  const reprintRate = reprintStats.total > 0 ? (reprintStats.reprints / reprintStats.total * 100) : 0;

  // Internal proof outcomes
  const proofStats = db.prepare(`
    SELECT
      SUM(CASE WHEN internal_proof_status='approved' THEN 1 ELSE 0 END) as approved,
      SUM(CASE WHEN internal_proof_status='failed' THEN 1 ELSE 0 END) as failed,
      SUM(CASE WHEN internal_proof_status='pending' THEN 1 ELSE 0 END) as pending
    FROM print_requests
    WHERE internal_proof_status != 'not_required'
  `).get() as any;
  const proofTotal = proofStats.approved + proofStats.failed;
  const proofFailRate = proofTotal > 0 ? (proofStats.failed / proofTotal * 100) : 0;

  // RIP recall events
  const ripRecalls = db.prepare(`
    SELECT COUNT(*) as n FROM print_requests WHERE rip_recalled = 1
  `).get() as any;

  // Composite failure rate
  const compStats = db.prepare(`
    SELECT
      SUM(CASE WHEN traveler_composite_status='generated' THEN 1 ELSE 0 END) as ok,
      SUM(CASE WHEN traveler_composite_status='failed' THEN 1 ELSE 0 END) as failed
    FROM print_requests
    WHERE traveler_composite_status != 'not_required'
  `).get() as any;
  const compTotal = compStats.ok + compStats.failed;
  const compFailRate = compTotal > 0 ? (compStats.failed / compTotal * 100) : 0;

  // Top reprint reasons
  const topReasons = db.prepare(`
    SELECT reprint_reason_code, COUNT(*) as n
    FROM print_requests
    WHERE reprint_reason_code IS NOT NULL
    GROUP BY reprint_reason_code
    ORDER BY n DESC
    LIMIT 10
  `).all() as any[];

  // Strike-off rejection by customer
  const strikeReject = db.prepare(`
    SELECT c.name as company_name, c.id as company_id,
      COUNT(*) as total,
      SUM(CASE WHEN so.customer_decision_outcome IN ('Rejected','Revision Required') THEN 1 ELSE 0 END) as rejected,
      SUM(CASE WHEN so.customer_decision_outcome = 'Approve with Changes' THEN 1 ELSE 0 END) as changes
    FROM strike_offs so
    JOIN print_requests pr ON so.print_request_id = pr.id
    JOIN order_lines ol ON pr.order_line_id = ol.id
    JOIN orders o ON ol.order_id = o.id
    JOIN companies c ON o.company_id = c.id
    WHERE so.customer_decision_at IS NOT NULL
    GROUP BY c.id
    HAVING total >= 2
    ORDER BY rejected DESC, changes DESC
    LIMIT 10
  `).all() as any[];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-navy-900">Quality Dashboard</h1>
        <p className="text-sm text-gray-600 mt-0.5">Reprint rate, proof outcomes, RIP recalls, strike-off rejection by customer.</p>
      </header>

      <div className="grid grid-cols-4 gap-4">
        <Stat label="Reprint rate (90d)"
              value={`${reprintRate.toFixed(1)}%`}
              sub={`${reprintStats.reprints} of ${reprintStats.total} PRs`}
              accent={reprintRate > 5 ? 'red' : 'green'} />
        <Stat label="Internal proof fail rate"
              value={`${proofFailRate.toFixed(1)}%`}
              sub={`${proofStats.failed} fails / ${proofTotal} reviewed`}
              accent={proofFailRate > 10 ? 'red' : 'green'} />
        <Stat label="RIP recalls"
              value={ripRecalls.n}
              sub="lifetime"
              accent={ripRecalls.n > 0 ? 'yellow' : 'green'} />
        <Stat label="Composite fail rate"
              value={`${compFailRate.toFixed(1)}%`}
              sub={`${compStats.failed} fails / ${compTotal} attempts`}
              accent={compFailRate > 5 ? 'red' : 'green'} />
      </div>

      <div className="grid grid-cols-2 gap-6">
        <Card>
          <CardHeader title="Top Reprint Reasons" subtitle="From the reprint reason code field" />
          <div className="p-5">
            {topReasons.length === 0 ? (
              <div className="text-sm text-gray-500 italic text-center py-6">No reprints with logged reasons yet.</div>
            ) : (
              <div className="space-y-2">
                {topReasons.map((r) => (
                  <div key={r.reprint_reason_code} className="flex items-center justify-between text-sm">
                    <span>{r.reprint_reason_code}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-32 h-2 bg-gray-100 rounded">
                        <div className="h-2 bg-helm-red rounded" style={{ width: `${Math.min(100, r.n * 10)}%` }} />
                      </div>
                      <span className="font-mono text-xs w-8 text-right">{r.n}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Strike-Off Outcomes by Customer" subtitle="Customers most likely to reject or change a strike" />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-2.5">Customer</th>
                  <th className="text-left px-4 py-2.5">Total</th>
                  <th className="text-left px-4 py-2.5">Reject</th>
                  <th className="text-left px-4 py-2.5">Changes</th>
                  <th className="text-left px-4 py-2.5">Reject %</th>
                </tr>
              </thead>
              <tbody>
                {strikeReject.map((r) => {
                  const pct = (r.rejected / r.total * 100);
                  return (
                    <tr key={r.company_id} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-2.5">
                        <Link href={`/customers/${r.company_id}`} className="text-navy-700 hover:underline">{r.company_name}</Link>
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs">{r.total}</td>
                      <td className="px-4 py-2.5 font-mono text-xs">{r.rejected > 0 ? <Tag color="red">{r.rejected}</Tag> : '0'}</td>
                      <td className="px-4 py-2.5 font-mono text-xs">{r.changes > 0 ? <Tag color="purple">{r.changes}</Tag> : '0'}</td>
                      <td className={`px-4 py-2.5 font-mono text-xs ${pct > 30 ? 'text-helm-red font-bold' : ''}`}>{pct.toFixed(0)}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader title="Notes" />
        <div className="p-5 text-sm text-gray-600 space-y-1">
          <p>• Reprint rate is over the trailing 90 days of created PRs. Target should be set by Megan + Quality lead.</p>
          <p>• Internal proof fail rate excludes click-and-print PRs (which bypass the internal-proof step).</p>
          <p>• Customer strike-off rejection rate above ~30% usually signals an expectation-setting issue worth a CSR conversation.</p>
        </div>
      </Card>
    </div>
  );
}

function Stat({ label, value, sub, accent }: { label: string; value: any; sub?: string; accent?: 'yellow' | 'green' | 'red' }) {
  const accentCls = accent === 'yellow' ? 'text-yellow-700'
    : accent === 'green' ? 'text-green-700'
    : accent === 'red' ? 'text-helm-red'
    : 'text-navy-900';
  return (
    <Card>
      <div className="p-4">
        <div className="text-xs uppercase tracking-wider text-gray-500 mb-1">{label}</div>
        <div className={`text-2xl font-bold ${accentCls}`}>{value}</div>
        {sub && <div className="text-[10px] text-gray-400 mt-0.5">{sub}</div>}
      </div>
    </Card>
  );
}
