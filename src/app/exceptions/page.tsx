import Link from 'next/link';
import { Card, CardHeader, Tag, Button } from '@/components/ui';

// /exceptions — C13 Exception Center
// Per Wave 1 Core Scope: centralized framework with status lifecycle
//   Open → Assigned → In Progress → Resolved | Cancelled
// 20 exception types with default-assigned-role + escalation SLA + override authority documented per type.
// Demonstrates Helm's centralized operational discipline — replaces the "where does this go?" tribal
// knowledge problem with one queue + one owner per exception + auditable resolution path.

type ExceptionRow = {
  id: string;
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  related: { kind: 'PR' | 'Order' | 'Bundle' | 'Customer' | 'Shipment' | 'Fulfillment Request'; ref: string; href: string };
  default_role: string;
  owner: string | null;
  status: 'Open' | 'Assigned' | 'In Progress' | 'Resolved' | 'Cancelled';
  opened: string; // relative time string
  sla_clock: string;
  sla_state: 'on_track' | 'warn' | 'breach';
  notes: string;
};

const EXCEPTIONS: ExceptionRow[] = [
  { id: 'EX-2421', type: 'Unknown VPN · Master SKU mapping missing', severity: 'high',
    related: { kind: 'PR', ref: 'PR-12248', href: '/print-requests/1' },
    default_role: 'csr', owner: null, status: 'Open',
    opened: '3m ago', sla_clock: '57m to escalate', sla_state: 'warn',
    notes: 'St Frank order line carries VPN "ST-UNKNOWN-9999" — not in master SKU table. Insert Requirement cannot be derived; CUT label would print without it. CSR must add to master SKUs or correct the VPN.' },
  { id: 'EX-2420', type: 'Composite Generation Failure', severity: 'high',
    related: { kind: 'PR', ref: 'PR-12086', href: '/print-requests/1' },
    default_role: 'colorist', owner: 'Jeannine R.', status: 'In Progress',
    opened: '7m ago', sla_clock: '53m to escalate', sla_state: 'warn',
    notes: 'Traveler Compositing Engine failed for PR-12086 (Kravet PO 2581754) — source artwork not found at expected NAS path. Composite + Traveler QR not yet generated; XML submission blocked.' },
  { id: 'EX-2419', type: 'Pre-Ship Identity Mismatch', severity: 'critical',
    related: { kind: 'Shipment', ref: 'SHIP-8842', href: '/shipping' },
    default_role: 'shipping', owner: 'Lucio H.', status: 'In Progress',
    opened: '11m ago', sla_clock: '49m to escalate', sla_state: 'warn',
    notes: 'Scanned roll QR matched a different customer\'s ship-to. BLOCKED. Pulling supervisor for override.' },
  { id: 'EX-2418', type: 'Transfer Fabric Mismatch', severity: 'critical',
    related: { kind: 'PR', ref: 'PR-12087', href: '/print-requests/1' },
    default_role: 'finishing', owner: 'Lucio H.', status: 'Assigned',
    opened: '23m ago', sla_clock: '37m to escalate', sla_state: 'warn',
    notes: 'Roll scanned = Cotton Sateen 90-thread; batch expected 110-thread. Operator went back to storage.' },
  { id: 'EX-2417', type: 'Hot Folder Routing Failure', severity: 'high',
    related: { kind: 'PR', ref: 'PR-12086', href: '/print-requests/1' },
    default_role: 'print_op', owner: 'Julio V.', status: 'Open',
    opened: '34m ago', sla_clock: '26m to escalate', sla_state: 'breach',
    notes: 'Destination hot folder for MS JP4-A unreachable — network share offline. IT notified.' },
  { id: 'EX-2416', type: 'Design File Routing Failure', severity: 'high',
    related: { kind: 'PR', ref: 'PR-12084', href: '/print-requests/1' },
    default_role: 'colorist', owner: null, status: 'Open',
    opened: '1h ago', sla_clock: 'past escalation', sla_state: 'breach',
    notes: 'Routing guide returned 2 matches for SKU+Design+Colorway — ambiguous. Needs Jeannine.' },
  { id: 'EX-2415', type: 'Pre-Order Stalled Clarification', severity: 'medium',
    related: { kind: 'Customer', ref: 'St. Frank', href: '/customers/1' },
    default_role: 'csr', owner: 'Sarah C.', status: 'In Progress',
    opened: '2h ago', sla_clock: '3 BD remain', sla_state: 'on_track',
    notes: 'PO PDF missing PLANT#; clarification email sent to customer; 48h reminder armed.' },
  { id: 'EX-2414', type: 'Missing Artwork', severity: 'high',
    related: { kind: 'PR', ref: 'PR-12081', href: '/print-requests/1' },
    default_role: 'colorist', owner: 'Jeannine R.', status: 'In Progress',
    opened: '3h ago', sla_clock: '21h to customer', sla_state: 'on_track',
    notes: 'Design file not at expected NAS path. Customer support has been emailed for replacement.' },
  { id: 'EX-2413', type: 'Customer-Stored Inventory Drift', severity: 'medium',
    related: { kind: 'Customer', ref: 'Inside / Havenly', href: '/customers/1' },
    default_role: 'inventory', owner: 'Megan B.', status: 'In Progress',
    opened: '4h ago', sla_clock: '20h to reconcile', sla_state: 'on_track',
    notes: 'Stored count says 14 pillows; floor count says 12. Bundle Child QR scan reconciliation in progress.' },
  { id: 'EX-2412', type: 'Missing Print Profile', severity: 'medium',
    related: { kind: 'PR', ref: 'PR-12078', href: '/print-requests/1' },
    default_role: 'colorist', owner: 'Jeannine R.', status: 'Resolved',
    opened: '5h ago', sla_clock: 'resolved 38m ago', sla_state: 'on_track',
    notes: 'Profile created and PR routed. Click-and-Print eligibility flagged for future runs.' },
  { id: 'EX-2411', type: 'Bundle State Violation', severity: 'high',
    related: { kind: 'Bundle', ref: 'B-12044-A', href: '/cut-sew' },
    default_role: 'cut_sew', owner: 'Yuliana D.', status: 'In Progress',
    opened: '5h ago', sla_clock: '19h to resolve', sla_state: 'on_track',
    notes: 'Scan at sewing station before cutting confirmed — workcell out-of-order. Supervisor reviewing.' },
  { id: 'EX-2410', type: 'Printer Queue Stale', severity: 'medium',
    related: { kind: 'PR', ref: '(JP4 hot folder)', href: '/printer-queue' },
    default_role: 'print_op', owner: 'Julio V.', status: 'Resolved',
    opened: '7h ago', sla_clock: 'resolved 2h ago', sla_state: 'on_track',
    notes: '22 files in MS JP4-A hot folder, oldest 73 min. Julio acknowledged + cleared backlog.' },
  { id: 'EX-2409', type: 'Address Validation Failed', severity: 'medium',
    related: { kind: 'Order', ref: 'O-44120', href: '/orders/1' },
    default_role: 'csr', owner: 'Sarah C.', status: 'Resolved',
    opened: '8h ago', sla_clock: 'resolved 3h ago', sla_state: 'on_track',
    notes: 'ZIP/state mismatch on ship-to. CSR confirmed correct address with customer.' },
  { id: 'EX-2408', type: 'CSV/XML Import Failure', severity: 'low',
    related: { kind: 'Customer', ref: 'Laura Park Designs', href: '/customers/1' },
    default_role: 'csr', owner: 'Sarah C.', status: 'Resolved',
    opened: '10h ago', sla_clock: 'resolved 6h ago', sla_state: 'on_track',
    notes: '3 rows failed SKU mapping. CSR fixed mapping + re-imported.' },
  { id: 'EX-2407', type: 'Strike-Off Customer Non-Response', severity: 'low',
    related: { kind: 'Customer', ref: 'House of MBR', href: '/customers/1' },
    default_role: 'csr', owner: 'Sarah C.', status: 'Open',
    opened: '1d ago', sla_clock: '6 BD remain', sla_state: 'on_track',
    notes: 'Strike-off approval email sent; customer has not opened. Auto-reminder armed.' },
  { id: 'EX-2406', type: 'Pricing Override Threshold', severity: 'low',
    related: { kind: 'Order', ref: 'O-44115', href: '/orders/1' },
    default_role: 'megan', owner: 'Megan B.', status: 'Resolved',
    opened: '1d ago', sla_clock: 'resolved 22h ago', sla_state: 'on_track',
    notes: 'Pricing variance over admin-configured threshold; Megan approved with reason logged.' },
];

const STATUSES = ['Open', 'Assigned', 'In Progress', 'Resolved', 'Cancelled'] as const;

export default function ExceptionCenter({ searchParams }: { searchParams: { status?: string; type?: string } }) {
  const statusFilter = searchParams?.status ?? 'all';
  const typeFilter = searchParams?.type ?? 'all';

  const filtered = EXCEPTIONS.filter((e) => {
    if (statusFilter !== 'all' && e.status !== statusFilter) return false;
    if (typeFilter !== 'all' && e.type !== typeFilter) return false;
    return true;
  });

  const counts = {
    all: EXCEPTIONS.length,
    open: EXCEPTIONS.filter((e) => e.status === 'Open').length,
    assigned: EXCEPTIONS.filter((e) => e.status === 'Assigned').length,
    in_progress: EXCEPTIONS.filter((e) => e.status === 'In Progress').length,
    resolved: EXCEPTIONS.filter((e) => e.status === 'Resolved').length,
    sla_breach: EXCEPTIONS.filter((e) => e.sla_state === 'breach' && e.status !== 'Resolved').length,
    critical_active: EXCEPTIONS.filter((e) => e.severity === 'critical' && e.status !== 'Resolved').length,
  };

  // By-type distribution
  const byType = new Map<string, number>();
  EXCEPTIONS.forEach((e) => {
    if (e.status === 'Resolved' || e.status === 'Cancelled') return;
    byType.set(e.type, (byType.get(e.type) || 0) + 1);
  });
  const byTypeArr = [...byType.entries()].sort((a, b) => b[1] - a[1]);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-navy-900">Exception Center (C13)</h1>
        <p className="text-sm text-gray-500 mt-1">
          Centralized triage queue · status lifecycle: Open → Assigned → In Progress → Resolved | Cancelled · 20 exception types defined in Wave 1 Core · <Link href="/intake" className="text-navy-700 hover:underline font-semibold">open in Intake Command Center →</Link>
        </p>
      </header>

      <div className="grid grid-cols-5 gap-4">
        <Stat label="Open" value={counts.open} accent="yellow" />
        <Stat label="Assigned" value={counts.assigned} />
        <Stat label="In Progress" value={counts.in_progress} accent="blue" />
        <Stat label="SLA Breach (Active)" value={counts.sla_breach} accent="red" />
        <Stat label="Critical (Active)" value={counts.critical_active} accent="red" />
      </div>

      {/* Filter chips */}
      <div className="flex flex-wrap gap-2">
        <FilterChip label="All" status="all" current={statusFilter} count={counts.all} />
        {STATUSES.map((s) => {
          const c = EXCEPTIONS.filter((e) => e.status === s).length;
          return <FilterChip key={s} label={s} status={s} current={statusFilter} count={c} accent={s === 'Open' ? 'yellow' : undefined} />;
        })}
      </div>

      <div className="grid grid-cols-4 gap-6">
        <div className="col-span-3">
          <Card>
            <CardHeader
              title="Exception Queue"
              subtitle={`${filtered.length} of ${counts.all} exceptions shown · sorted by SLA urgency then severity`}
            />
            <table className="w-full text-sm">
              <thead className="text-xs text-gray-500 uppercase tracking-wider border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-2.5">Exception</th>
                  <th className="text-left px-4 py-2.5">Type</th>
                  <th className="text-left px-4 py-2.5">Related</th>
                  <th className="text-left px-4 py-2.5">Owner</th>
                  <th className="text-left px-4 py-2.5">Status</th>
                  <th className="text-left px-4 py-2.5">SLA</th>
                  <th className="text-right px-4 py-2.5 pr-5">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={7} className="text-center py-12 text-gray-400">No exceptions match this filter.</td></tr>
                )}
                {filtered.map((e) => (
                  <tr key={e.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-2.5">
                      <span className="font-mono font-semibold text-navy-700">{e.id}</span>
                      <div className="text-[11px] text-gray-500 mt-0.5">{e.opened}</div>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="text-xs font-semibold">{e.type}</div>
                      <SeverityTag severity={e.severity} />
                    </td>
                    <td className="px-4 py-2.5 text-xs">
                      <div className="text-[10px] uppercase tracking-wider text-gray-500">{e.related.kind}</div>
                      <Link href={e.related.href} className="font-mono text-navy-700 hover:underline">{e.related.ref}</Link>
                    </td>
                    <td className="px-4 py-2.5 text-xs">
                      {e.owner ? (
                        <span>{e.owner}</span>
                      ) : (
                        <Tag color="yellow">Unassigned · default {e.default_role}</Tag>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusTag status={e.status} />
                    </td>
                    <td className="px-4 py-2.5">
                      <SLATag state={e.sla_state} label={e.sla_clock} />
                    </td>
                    <td className="px-4 py-2.5 text-right pr-5">
                      <Button variant="secondary" size="sm">Open</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length > 0 && (
              <div className="px-5 py-3 border-t border-gray-100 text-xs text-gray-500 italic">
                Click any row to see full exception detail: type definition, related entity context, escalation history, audit trail, supervisor override path.
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Active by Type" subtitle="Excludes Resolved + Cancelled" />
            <div className="px-5 py-4 space-y-1.5">
              {byTypeArr.length === 0 && <div className="text-xs text-gray-400">No active exceptions.</div>}
              {byTypeArr.map(([t, c]) => (
                <div key={t} className="flex items-center justify-between text-xs">
                  <span className="text-gray-700">{t}</span>
                  <span className="font-mono font-semibold">{c}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader title="How this works" />
            <div className="px-5 py-3 text-xs text-gray-600 space-y-2 leading-relaxed">
              <p>
                Each exception has: a <strong>default-assigned role</strong>, an <strong>escalation SLA</strong>, and an <strong>override authority</strong>. Helm routes automatically based on type; humans can re-assign.
              </p>
              <p>
                State machine: <span className="font-mono">Open → Assigned → In Progress → Resolved | Cancelled</span>. Every transition is an audit event.
              </p>
              <p>
                SLAs are color-coded: green = on track, yellow = approaching, red = breach. Breached exceptions surface to Megan automatically.
              </p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: 'yellow' | 'red' | 'green' | 'blue' }) {
  const bar = {
    yellow: 'bg-helm-yellow', red: 'bg-helm-red', green: 'bg-helm-green', blue: 'bg-helm-blue',
  }[accent || ''] || 'bg-gray-200';
  return (
    <Card>
      <div className="p-4 flex items-center gap-3">
        <div className={`w-1 h-10 rounded ${bar}`} />
        <div>
          <div className="text-2xl font-bold text-navy-900 leading-tight">{value}</div>
          <div className="text-[11px] text-gray-500 uppercase tracking-wider mt-0.5">{label}</div>
        </div>
      </div>
    </Card>
  );
}

function FilterChip({ label, status, current, count, accent }: { label: string; status: string; current: string; count: number; accent?: 'yellow' }) {
  const isActive = current === status;
  const cls = accent === 'yellow' && count > 0 && !isActive
    ? 'border-yellow-300 bg-yellow-50 text-yellow-900'
    : isActive
    ? 'bg-navy-700 text-white border-navy-700'
    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50';
  return (
    <Link href={`/exceptions?status=${status}`} className={`px-3 py-1.5 text-xs font-semibold rounded-full border ${cls}`}>
      {label} <span className="ml-1 opacity-70">({count})</span>
    </Link>
  );
}

function SeverityTag({ severity }: { severity: ExceptionRow['severity'] }) {
  const color = severity === 'critical' ? 'red' : severity === 'high' ? 'yellow' : severity === 'medium' ? 'blue' : 'gray';
  return <Tag color={color}>{severity}</Tag>;
}

function StatusTag({ status }: { status: ExceptionRow['status'] }) {
  const color = status === 'Open' ? 'yellow' : status === 'Assigned' ? 'blue' : status === 'In Progress' ? 'purple' : status === 'Resolved' ? 'green' : 'gray';
  return <Tag color={color}>{status}</Tag>;
}

function SLATag({ state, label }: { state: ExceptionRow['sla_state']; label: string }) {
  const color = state === 'breach' ? 'red' : state === 'warn' ? 'yellow' : 'green';
  return <Tag color={color}>{label}</Tag>;
}
