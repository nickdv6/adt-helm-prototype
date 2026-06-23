import Link from 'next/link';
import { getDb } from '@/lib/db';
import { Card, CardHeader, Tag, Button, StatusPill } from '@/components/ui';
import { relativeTime } from '@/lib/utils';
import {
  CheckCircle2, AlertTriangle, XCircle, RotateCw, Search, UserPlus, UserMinus,
  Activity, KeyRound, ExternalLink, Plug,
} from 'lucide-react';

// S14 — IT / System Admin Home (Wave 1, desktop-first)
// Per blueprint: integration health + user provisioning + audit search.
// 9 integrations monitored: M365 SSO, HubSpot, PandaDoc, Shopify ×2, QuickBooks,
// EasyPost (+UPS+FedEx), NAS, RIP, DASH.
// Layout follows the locked home template (S02-S15.1). Time window default today + 2 days.

// =====================================================================
// Mock data — integrations + sync queue + failed events + recent audit
// =====================================================================

type IntegrationStatus = 'healthy' | 'degraded' | 'down' | 'paused';

type Integration = {
  key: string;
  name: string;
  category: string;
  status: IntegrationStatus;
  last_sync: string;
  last_sync_ms: number | null;
  records_synced_24h: number;
  failed_24h: number;
  description: string;
};

const INTEGRATIONS: Integration[] = [
  { key: 'm365',     name: 'Microsoft 365 SSO',           category: 'Identity',      status: 'healthy',  last_sync: '2 min ago',  last_sync_ms: 412,  records_synced_24h: 87,   failed_24h: 0,
    description: 'User auth + identity sync (Entra ID). Push direction: Helm reads users + group memberships from M365.' },
  { key: 'hubspot',  name: 'HubSpot CRM',                 category: 'CRM',           status: 'healthy',  last_sync: '4 min ago',  last_sync_ms: 1834, records_synced_24h: 134,  failed_24h: 0,
    description: 'Companies + Contacts one-way read (Phase 2 adds two-way). Drives customer + contact records.' },
  { key: 'pandadoc', name: 'PandaDoc',                    category: 'Documents',     status: 'healthy',  last_sync: '14 min ago', last_sync_ms: 921,  records_synced_24h: 22,   failed_24h: 0,
    description: 'Customer agreements + NDA + onboarding documents. Signed-doc webhook updates customer state.' },
  { key: 'shop_a',   name: 'Shopify · Store A',           category: 'E-commerce',    status: 'healthy',  last_sync: '1 min ago',  last_sync_ms: 287,  records_synced_24h: 41,   failed_24h: 0,
    description: 'advdigitaltextiles.myshopify.com — online order intake + fulfillment-request feed.' },
  { key: 'shop_b',   name: 'Shopify · Store B',           category: 'E-commerce',    status: 'degraded', last_sync: '18 min ago', last_sync_ms: 4421, records_synced_24h: 19,   failed_24h: 3,
    description: 'fabricondemand.myshopify.com — webhook lag exceeding SLA (4.4s vs 1s target). Watching.' },
  { key: 'qb',       name: 'QuickBooks Desktop',          category: 'Accounting',    status: 'paused',   last_sync: '6h ago',     last_sync_ms: null, records_synced_24h: 0,    failed_24h: 0,
    description: 'Wave 1: manual export pattern (no live sync). Phase 2 enables auto invoice push on Shipped.' },
  { key: 'easypost', name: 'EasyPost (UPS + FedEx)',      category: 'Shipping',      status: 'healthy',  last_sync: 'just now',   last_sync_ms: 612,  records_synced_24h: 67,   failed_24h: 1,
    description: 'Carrier rate + label + tracking. 1 failure today: USPS address validation timeout.' },
  { key: 'nas',      name: 'NAS · Artwork File Server',   category: 'Files',         status: 'healthy',  last_sync: '6 min ago',  last_sync_ms: 198,  records_synced_24h: 142,  failed_24h: 0,
    description: '\\\\adt-nas\\artwork — design + composite file storage. Watcher polls every 60s.' },
  { key: 'rip',      name: 'RIP · Hot Folder Bridge',     category: 'Production',    status: 'down',     last_sync: '34 min ago', last_sync_ms: null, records_synced_24h: 12,   failed_24h: 4,
    description: 'Hot folder write bridge to printer RIPs. Currently down — see exception EX-2417.' },
  { key: 'dash',     name: 'ADT DASH (legacy)',           category: 'Production',    status: 'healthy',  last_sync: 'just now',   last_sync_ms: 38,   records_synced_24h: 312,  failed_24h: 0,
    description: 'On-prem SQL system of record for orders. Wave 1 hybrid pattern (read/write through Helm).' },
];

type SyncQueueRow = {
  integration: string;
  kind: string;
  queued: number;
  oldest: string;
};
const SYNC_QUEUE: SyncQueueRow[] = [
  { integration: 'NAS',       kind: 'Artwork file index',     queued: 12, oldest: '2 min ago' },
  { integration: 'HubSpot',   kind: 'Company update pull',    queued: 4,  oldest: '6 min ago' },
  { integration: 'Shopify B', kind: 'Order webhook retry',    queued: 3,  oldest: '18 min ago' },
  { integration: 'EasyPost',  kind: 'Tracking poll',          queued: 1,  oldest: '1 min ago' },
];

type FailedEvent = {
  when: string;
  integration: string;
  kind: string;
  payload_ref: string;
  reason: string;
  retry_count: number;
};
const FAILED_EVENTS: FailedEvent[] = [
  { when: '4 min ago',  integration: 'RIP',       kind: 'XML write',           payload_ref: 'PR-12086 · JP7',    reason: 'Hot folder unreachable — network share offline (open EX-2417)', retry_count: 4 },
  { when: '11 min ago', integration: 'RIP',       kind: 'XML write',           payload_ref: 'PR-12091 · JP7',    reason: 'Hot folder unreachable — same root cause as above',              retry_count: 3 },
  { when: '14 min ago', integration: 'EasyPost',  kind: 'Address validation',  payload_ref: 'O-44315 USPS',      reason: 'Carrier API timeout (4500ms) · address could not be validated',  retry_count: 2 },
  { when: '18 min ago', integration: 'Shopify B', kind: 'Order webhook',       payload_ref: 'shop_b_ord:4129',   reason: 'Schema mismatch — payload missing required field "fulfillment_status"', retry_count: 5 },
  { when: '22 min ago', integration: 'Shopify B', kind: 'Order webhook',       payload_ref: 'shop_b_ord:4128',   reason: 'Same schema mismatch as above',                                  retry_count: 5 },
  { when: '32 min ago', integration: 'RIP',       kind: 'XML write',           payload_ref: 'PR-12080 · JP4-A',  reason: 'Hot folder unreachable',                                         retry_count: 6 },
];

type AuditEntry = {
  when: string;
  actor: string;
  action: string;
  target: string;
  detail: string;
};
const AUDIT_FEED: AuditEntry[] = [
  { when: '3 min ago',  actor: 'Megan B.',  action: 'pricing.override',     target: 'O-44512',         detail: 'Pricing variance 14% over threshold · reason logged' },
  { when: '8 min ago',  actor: 'Jeannine R.', action: 'pr.strikeoff.approve', target: 'PR-12085',     detail: 'CAP eligible · routed direct to MS JP4-A hot folder' },
  { when: '12 min ago', actor: 'Lucio H.',  action: 'shipment.partial',     target: 'O-44488 (1 of 3)',detail: 'Partial shipment confirmed · audit reason: "remaining rolls pending pretreatment"' },
  { when: '14 min ago', actor: 'Sarah C.',  action: 'order.create',         target: 'O-44531',         detail: 'St Frank · 3 lines · auto-approved through OD-3' },
  { when: '22 min ago', actor: 'system',    action: 'integration.degrade',  target: 'Shopify Store B', detail: 'Webhook lag exceeded 1s SLA · status flipped Healthy → Degraded' },
  { when: '34 min ago', actor: 'Yuliana C.', action: 'bundle.defect',       target: 'B-12044-A',       detail: 'Defect type: Off Color · reprint route triggered' },
  { when: '47 min ago', actor: 'Nick D.V.', action: 'admin.user.create',    target: 'maya@adt.com',    detail: 'New colorist · role: colorist · M365 sync queued' },
  { when: '1h 5m',      actor: 'Megan B.',  action: 'override.transfer',    target: 'PR-12044',        detail: 'Supervisor override at transfer press · reason: "fabric mismatch override per QC approval"' },
];

type RecentUserChange = {
  when: string;
  who: string;
  action: 'created' | 'deactivated' | 'role_changed';
  detail: string;
};
const USER_CHANGES: RecentUserChange[] = [
  { when: '47 min ago', who: 'Maya Chen (maya@adt.com)',   action: 'created',       detail: 'role: colorist · M365 sync queued' },
  { when: '2 days ago', who: 'Jeannine Romero',             action: 'role_changed',  detail: 'added Print Op secondary role' },
  { when: '6 days ago', who: 'Drew Walters',                action: 'created',       detail: 'role: sales · M365 sync complete' },
];

// =====================================================================
// Page
// =====================================================================

export default function ITAdminHome() {
  const healthy = INTEGRATIONS.filter((i) => i.status === 'healthy').length;
  const degraded = INTEGRATIONS.filter((i) => i.status === 'degraded').length;
  const down = INTEGRATIONS.filter((i) => i.status === 'down').length;
  const paused = INTEGRATIONS.filter((i) => i.status === 'paused').length;
  const totalFailed24h = FAILED_EVENTS.length;
  const totalQueued = SYNC_QUEUE.reduce((s, r) => s + r.queued, 0);

  return (
    <div className="max-w-7xl mx-auto space-y-5 pb-12">
      <header>
        <h1 className="text-2xl font-bold text-navy-900">IT / System Admin Home</h1>
        <p className="text-sm text-gray-500 mt-1">
          Integration health · user provisioning · audit search · 9 integrations monitored · today + 2 days
        </p>
      </header>

      {/* Stats tiles */}
      <div className="grid grid-cols-5 gap-4">
        <Stat label="Healthy" value={healthy} accent="green" icon={<CheckCircle2 className="w-3.5 h-3.5" />} />
        <Stat label="Degraded" value={degraded} accent="yellow" icon={<AlertTriangle className="w-3.5 h-3.5" />} />
        <Stat label="Down" value={down} accent="red" icon={<XCircle className="w-3.5 h-3.5" />} />
        <Stat label="Sync queue" value={totalQueued} accent="blue" />
        <Stat label="Failed events (24h)" value={totalFailed24h} accent={totalFailed24h > 0 ? 'red' : 'green'} />
      </div>

      {/* Integration Health — the main card */}
      <Card>
        <CardHeader
          title="Integration Health"
          subtitle="9 integrations · click into any row for sync history + retry · status flips trigger admin notification"
          action={<Button variant="secondary" size="sm"><Plug className="w-3.5 h-3.5 mr-1" />Configure new integration</Button>}
        />
        <table className="w-full text-sm">
          <thead className="text-xs text-gray-500 uppercase tracking-wider border-b border-gray-200 bg-gray-50">
            <tr>
              <th className="text-left px-3 py-2">Integration</th>
              <th className="text-left px-3 py-2">Category</th>
              <th className="text-left px-3 py-2">Status</th>
              <th className="text-left px-3 py-2">Last sync</th>
              <th className="text-right px-3 py-2">Latency</th>
              <th className="text-right px-3 py-2">Records (24h)</th>
              <th className="text-right px-3 py-2">Failed (24h)</th>
              <th className="text-right px-3 py-2 pr-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {INTEGRATIONS.map((i) => (
              <tr key={i.key} className={`border-t border-gray-100 hover:bg-gray-50 ${i.status === 'down' ? 'bg-red-50/30' : ''}`}>
                <td className="px-3 py-2.5">
                  <div className="font-semibold">{i.name}</div>
                  <div className="text-[11px] text-gray-500 mt-0.5">{i.description}</div>
                </td>
                <td className="px-3 py-2.5 text-xs">{i.category}</td>
                <td className="px-3 py-2.5"><HealthTag status={i.status} /></td>
                <td className="px-3 py-2.5 text-xs text-gray-600">{i.last_sync}</td>
                <td className="px-3 py-2.5 text-right font-mono text-xs">
                  {i.last_sync_ms != null
                    ? <span className={i.last_sync_ms > 2000 ? 'text-yellow-700' : 'text-gray-600'}>{i.last_sync_ms}ms</span>
                    : <span className="text-gray-400">—</span>}
                </td>
                <td className="px-3 py-2.5 text-right font-mono">{i.records_synced_24h.toLocaleString()}</td>
                <td className="px-3 py-2.5 text-right">
                  {i.failed_24h > 0 ? <Tag color="red">{i.failed_24h}</Tag> : <span className="text-gray-400 font-mono">0</span>}
                </td>
                <td className="px-3 py-2.5 text-right pr-3">
                  <Button variant="ghost" size="sm">Detail →</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* Sync queue + Failed events side-by-side */}
      <div className="grid grid-cols-2 gap-5">
        <Card>
          <CardHeader
            title="Sync Queue"
            subtitle={`${totalQueued} records waiting to be synced`}
            action={<Activity className="w-4 h-4 text-navy-700" />}
          />
          <table className="w-full text-xs">
            <thead className="text-gray-500 uppercase tracking-wider border-b border-gray-200">
              <tr>
                <th className="text-left px-3 py-2">Integration</th>
                <th className="text-left px-3 py-2">Kind</th>
                <th className="text-right px-3 py-2">Queued</th>
                <th className="text-left px-3 py-2 pr-3">Oldest</th>
              </tr>
            </thead>
            <tbody>
              {SYNC_QUEUE.length === 0 && <tr><td colSpan={4} className="text-center py-6 text-gray-400">Queue is empty.</td></tr>}
              {SYNC_QUEUE.map((r, i) => (
                <tr key={i} className="border-t border-gray-100">
                  <td className="px-3 py-1.5">{r.integration}</td>
                  <td className="px-3 py-1.5 text-gray-600">{r.kind}</td>
                  <td className="px-3 py-1.5 text-right font-mono">{r.queued}</td>
                  <td className="px-3 py-1.5 text-gray-500 pr-3">{r.oldest}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card>
          <CardHeader
            title="Failed Events (last 24h)"
            subtitle="Retry individually · or open Exception Center for triage"
            action={
              <Link href="/exceptions" className="text-xs text-navy-700 hover:underline font-semibold">
                Exception Center →
              </Link>
            }
          />
          <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
            {FAILED_EVENTS.map((e, i) => (
              <div key={i} className="px-4 py-2.5 text-xs">
                <div className="flex items-center justify-between gap-2 mb-0.5">
                  <div>
                    <span className="font-semibold">{e.integration}</span>
                    <span className="text-gray-500 mx-1.5">·</span>
                    <span className="text-gray-600">{e.kind}</span>
                  </div>
                  <Button size="sm" variant="ghost"><RotateCw className="w-3 h-3 mr-1" />Retry</Button>
                </div>
                <div className="font-mono text-[11px] text-navy-700">{e.payload_ref}</div>
                <div className="text-gray-600 italic mt-0.5">{e.reason}</div>
                <div className="text-[10px] text-gray-400 mt-0.5">{e.when} · {e.retry_count} retries attempted</div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* NeoStampa Sync Agents — Phase 1 surface
          One agent per RIP machine. Each watches hot folders + reports back. */}
      <NeoStampaAgentsPanel />

      {/* User Provisioning + Audit Search */}
      <div className="grid grid-cols-3 gap-5">
        <Card>
          <CardHeader
            title="User Provisioning"
            subtitle="M365 SSO sync direction: read · changes propagate ~5 min"
            action={<Button size="sm"><UserPlus className="w-3.5 h-3.5 mr-1" />Provision user</Button>}
          />
          <div className="px-4 py-3 space-y-2">
            <div className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">Recent changes</div>
            {USER_CHANGES.map((u, i) => (
              <div key={i} className="text-xs border-l-2 border-gray-200 pl-2.5">
                <div className="flex items-center gap-1.5">
                  {u.action === 'created' && <UserPlus className="w-3 h-3 text-green-600" />}
                  {u.action === 'deactivated' && <UserMinus className="w-3 h-3 text-red-600" />}
                  {u.action === 'role_changed' && <KeyRound className="w-3 h-3 text-yellow-600" />}
                  <span className="font-semibold">{u.who}</span>
                </div>
                <div className="text-gray-600 mt-0.5">{u.detail}</div>
                <div className="text-[10px] text-gray-400 mt-0.5">{u.when}</div>
              </div>
            ))}
          </div>
          <div className="px-4 py-2 border-t border-gray-100 flex items-center justify-between text-[11px]">
            <Link href="#" className="text-navy-700 hover:underline">All users →</Link>
            <a href="https://admin.microsoft.com" target="_blank" rel="noreferrer" className="text-gray-500 hover:text-navy-700 inline-flex items-center gap-1">
              M365 admin console <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </Card>

        <Card className="col-span-2">
          <CardHeader
            title="Audit Log"
            subtitle="All state-changing actions · search by actor, target, or action type"
            action={
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2 top-2 text-gray-400" />
                  <input type="text" placeholder="actor · target · action…" className="pl-7 pr-2 py-1.5 text-xs border border-gray-300 rounded w-56" />
                </div>
                <Button size="sm" variant="secondary">Search</Button>
              </div>
            }
          />
          <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
            {AUDIT_FEED.map((e, i) => (
              <div key={i} className="px-4 py-2 text-xs">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-semibold">{e.actor}</span>
                    <span className="text-gray-500 mx-1.5">·</span>
                    <code className="font-mono text-[11px] text-navy-700">{e.action}</code>
                    <span className="text-gray-500 mx-1.5">→</span>
                    <span className="font-mono text-[11px]">{e.target}</span>
                  </div>
                  <span className="text-[10px] text-gray-400">{e.when}</span>
                </div>
                <div className="text-gray-600 mt-0.5 italic">{e.detail}</div>
              </div>
            ))}
          </div>
          <div className="px-4 py-2 border-t border-gray-100 text-[11px] text-gray-500 italic">
            Audit events are append-only · immutable · retention follows the customer data retention policy in Settings.
          </div>
        </Card>
      </div>
    </div>
  );
}

// =====================================================================
// Small components
// =====================================================================

function HealthTag({ status }: { status: IntegrationStatus }) {
  if (status === 'healthy')  return <Tag color="green">Healthy</Tag>;
  if (status === 'degraded') return <Tag color="yellow">Degraded</Tag>;
  if (status === 'down')     return <Tag color="red">Down</Tag>;
  return <Tag color="gray">Paused</Tag>;
}

function Stat({ label, value, accent, icon }: { label: string; value: any; accent?: 'red' | 'yellow' | 'green' | 'blue'; icon?: React.ReactNode }) {
  const bar = {
    yellow: 'bg-helm-yellow', red: 'bg-helm-red', green: 'bg-helm-green', blue: 'bg-helm-blue',
  }[accent || ''] || 'bg-gray-200';
  return (
    <Card>
      <div className="p-4 flex items-center gap-3">
        <div className={`w-1 h-10 rounded ${bar}`} />
        <div>
          <div className="text-2xl font-bold text-navy-900 leading-tight">{value}</div>
          <div className="text-[11px] text-gray-500 uppercase tracking-wider mt-0.5 flex items-center gap-1">{icon}{label}</div>
        </div>
      </div>
    </Card>
  );
}

// NeoStampa Sync Agents — Phase 1 add. Pulls live state from neostampa_agents table.
function NeoStampaAgentsPanel() {
  const db = getDb();
  const agents = db.prepare(`
    SELECT a.*,
      (SELECT COUNT(*) FROM hot_folders hf WHERE hf.neostampa_agent_id = a.id AND hf.is_active = 1) as folder_count,
      (SELECT COUNT(*) FROM rip_jobs rj WHERE rj.neostampa_agent_id = a.id AND rj.status = 'error') as open_errors
    FROM neostampa_agents a ORDER BY a.name
  `).all() as any[];

  return (
    <Card>
      <CardHeader
        title="NeoStampa Sync Agents"
        subtitle="Local services on each RIP machine — watch hot folders, monitor logs, report events back to Helm. Heartbeat every 30s."
        action={<Tag color={agents.some((a) => a.status !== 'online') ? 'yellow' : 'green'}>{agents.filter((a) => a.status === 'online').length}/{agents.length} online</Tag>}
      />
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
            <tr>
              <th className="text-left px-4 py-2.5">Agent</th>
              <th className="text-left px-4 py-2.5">Host</th>
              <th className="text-left px-4 py-2.5">Status</th>
              <th className="text-left px-4 py-2.5">NeoStampa</th>
              <th className="text-left px-4 py-2.5">Hot Folders</th>
              <th className="text-left px-4 py-2.5">Last Heartbeat</th>
              <th className="text-left px-4 py-2.5">Jobs Today</th>
              <th className="text-left px-4 py-2.5">Failed Today</th>
              <th className="text-left px-4 py-2.5">Notes</th>
            </tr>
          </thead>
          <tbody>
            {agents.map((a) => (
              <tr key={a.id} className="border-t border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-2.5 font-semibold text-navy-900">{a.name}</td>
                <td className="px-4 py-2.5 font-mono text-[10px] text-gray-500">{a.hostname}</td>
                <td className="px-4 py-2.5">
                  <Tag color={a.status === 'online' ? 'green' : a.status === 'degraded' ? 'yellow' : a.status === 'offline' ? 'red' : 'gray'}>
                    {a.status}
                  </Tag>
                  {a.open_errors > 0 && <Tag color="red">{a.open_errors} err</Tag>}
                </td>
                <td className="px-4 py-2.5 text-xs">{a.neostampa_version ?? '—'}</td>
                <td className="px-4 py-2.5 font-mono text-xs">{a.folder_count}</td>
                <td className="px-4 py-2.5 text-xs text-gray-500">{a.last_heartbeat_at ? relativeTime(a.last_heartbeat_at) : '—'}</td>
                <td className="px-4 py-2.5 font-mono text-xs">{a.jobs_processed_today}</td>
                <td className="px-4 py-2.5 font-mono text-xs">
                  {a.jobs_failed_today > 0
                    ? <span className="text-helm-red font-bold">{a.jobs_failed_today}</span>
                    : <span className="text-gray-400">0</span>}
                </td>
                <td className="px-4 py-2.5 text-[11px] text-gray-600 italic max-w-xs">{a.notes ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-2 border-t border-gray-100 text-[11px] text-gray-500 italic">
        Agent code packaged as a Windows service. Sends event POSTs to Helm’s /api/rip-events endpoint.
        Future requirements for full Inèdit integration: API access, log file access, queue access, folder monitoring, job metadata, printer status, meter tracking, ink usage, archive status.
      </div>
    </Card>
  );
}
