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

      {/* RIP Backend · Vendor Risk & Mitigation — Phase 1.9
          What's pinned to Inèdit, what's abstracted, and what touch points
          break (or don't) if Inèdit changes the spec or goes away. */}
      <RipBackendRiskPanel />

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
        title="NeoStampa Sync Agents · Inèdit neoRipEngine"
        subtitle="Local Windows services running neoRipEngineCGI on each RIP machine — watch hot folders, post printingStart/End/Abort notifications back to Helm per Inèdit spec 4.23.0. Heartbeat every 30s."
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
      <div className="px-4 py-2 border-t border-gray-100 text-[11px] text-gray-500 italic space-y-1">
        <div>
          Agent code packaged as a Windows service wrapping <code className="font-mono">neoRipEngineCGI</code>.
          Each printingStart / printingEnd / printingAbort / printingMessage Notification URL in the job ticket posts
          back to Helm at <code className="font-mono">/api/rip-events</code> → writes a row to <code className="font-mono">rip_job_events</code>.
        </div>
        <div>
          Reference: <span className="font-semibold">Inèdit neoRipEngine 4.23.0</span> · Job ticket structure §Job ticket (p.4) ·
          Notifications §Notifications (p.85) · CGI flags §neoRipEngineCGI (p.109). Job export uses the <code className="font-mono">.xjb</code> bundle format via <code className="font-mono">-exportjob</code>.
        </div>
      </div>

      {/* Webhook API contract — what the Sync Agent POSTs back */}
      <div className="border-t border-gray-200">
        <CardHeader title="Webhook API · /api/rip-events" subtitle="Endpoint NeoStampa Sync Agents call when print events fire — live in this prototype." />
        <div className="p-5 space-y-3 text-sm">
          <div className="grid grid-cols-3 gap-3 text-xs">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-1">Method · Path</div>
              <code className="font-mono text-navy-700 break-all">GET/POST /api/rip-events</code>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-1">Required params</div>
              <code className="font-mono">event</code>, <code className="font-mono">job</code>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-1">Optional</div>
              <code className="font-mono">pr</code>, <code className="font-mono">agent</code>, <code className="font-mono">qr_payload</code>, <code className="font-mono">details</code>
            </div>
          </div>

          <div>
            <div className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-1">Inèdit Notification URL example (GET)</div>
            <pre className="font-mono text-[10px] bg-gray-50 border border-gray-200 rounded p-2 overflow-x-auto whitespace-pre-wrap break-all">
{`GET https://helm.adt.com/api/rip-events
    ?event=print_started
    &job=STFRANK_PR-104582_FO-98321_BLOOM-BLUE_12YD
    &pr=PR-104582
    &agent=RIP-Bay-A`}
            </pre>
          </div>

          <div>
            <div className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-1">Agent QR-scan event (POST)</div>
            <pre className="font-mono text-[10px] bg-gray-50 border border-gray-200 rounded p-2 overflow-x-auto whitespace-pre">
{`POST https://helm.adt.com/api/rip-events
Content-Type: application/json

{
  "event": "print_completed_qr",
  "job": "STFRANK_PR-104582_FO-98321_BLOOM-BLUE_12YD",
  "pr": "PR-104582",
  "agent": "RIP-Bay-A",
  "qr_payload": "FO-98321",
  "details": "Scanned at Durst Alpha 330 exit · operator JV"
}`}
            </pre>
          </div>

          <div>
            <div className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-1">Success response (200)</div>
            <pre className="font-mono text-[10px] bg-gray-50 border border-gray-200 rounded p-2 overflow-x-auto whitespace-pre">
{`{
  "ok": true,
  "event_id": "evt_…",
  "rip_job_id": 123,
  "pr_number": "PR-104582",
  "external_job_name": "STFRANK_PR-104582_…",
  "previous_status": "printing",
  "new_status": "print_complete_qr",
  "status_changed": true,
  "would_persist": { "insert_into": "rip_job_events", … }
}`}
            </pre>
          </div>

          <div className="flex gap-2 flex-wrap text-[10px]">
            <Tag color="gray">200 ok — event accepted</Tag>
            <Tag color="yellow">400 — missing/invalid params or PR mismatch</Tag>
            <Tag color="red">404 orphaned_event — raises EX-RIP-ORPHANED</Tag>
          </div>

          <div className="border-t border-gray-100 pt-3 mt-1">
            <div className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-1">Two origins — Helm-minted vs Canvas-originated</div>
            <div className="text-xs text-gray-600 space-y-1.5">
              <div>
                <strong className="text-navy-700">Helm-originated:</strong> Helm mints the external_job_name, writes the XML to the hot folder, agent picks up. Standard lifecycle events flow back via the URLs above.
              </div>
              <div>
                <strong className="text-navy-700">Canvas-originated:</strong> Colorist opens a file in NeoStampa Canvas, makes adjustments, clicks print. Agent observes via log-tail and POSTs <code className="font-mono">agent_observed_job</code>. Helm auto-matches the filename (PR-#### = 95% confidence · PLANT# = 70%) or routes to the Reconciliation Queue. Operator later fires <code className="font-mono">manual_associate</code> to bind.
              </div>
              <div className="flex gap-2 mt-2">
                <a href="/api/rip-events?event=agent_observed_job&job=st_frank_cypress_indigo_PR-4506_rerun.tif&agent=RIP-Bay-A" target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-navy-700 bg-white border border-gray-300 hover:bg-gray-50 rounded">
                  <ExternalLink className="w-3.5 h-3.5" />Test auto-match (95%)
                </a>
                <a href="/api/rip-events?event=agent_observed_job&job=untitled_durst_2026-06-22.tif&agent=RIP-Bay-A" target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-navy-700 bg-white border border-gray-300 hover:bg-gray-50 rounded">
                  <ExternalLink className="w-3.5 h-3.5" />Test no-match (Reconciliation)
                </a>
                <Link href="/printer-queue#reconciliation"
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-navy-700 bg-white border border-gray-300 hover:bg-gray-50 rounded">
                  Reconciliation Queue →
                </Link>
              </div>
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <a href="/api/rip-events" target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-navy-700 bg-white border border-gray-300 hover:bg-gray-50 rounded">
              <ExternalLink className="w-3.5 h-3.5" />View live JSON contract docs
            </a>
            <a href="/api/rip-events?event=print_started&job=STFRANK_PR-4506_FO-90001_DESIGN_COLORWAY_12YD&pr=PR-4506&agent=RIP-Bay-A" target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-navy-700 bg-white border border-gray-300 hover:bg-gray-50 rounded">
              <ExternalLink className="w-3.5 h-3.5" />Test orphaned-event 404
            </a>
          </div>

          <div className="text-[10px] text-gray-500 italic pt-1 border-t border-gray-100">
            Prototype mock: endpoint validates + looks up the RipJob + returns the would-be write. Vercel filesystem is read-only at runtime so writes aren't persisted across requests; production (Postgres) executes the INSERT + UPDATE. Identity binding: <code className="font-mono">rip_jobs.external_job_name</code> is UNIQUE — duplicate name = DB-level collision, not just an exception.
          </div>
        </div>
      </div>
    </Card>
  );
}

// RIP Backend Vendor Risk panel — Phase 1.9. Lays out exactly what touches
// Inèdit's spec and what is abstracted behind Helm-owned identifiers.
function RipBackendRiskPanel() {
  const db = getDb();
  const targets = db.prepare(`
    SELECT rip_target, COUNT(*) as folder_count
    FROM hot_folders WHERE is_active = 1 GROUP BY rip_target
  `).all() as any[];

  return (
    <Card>
      <CardHeader
        title="RIP Backend · Vendor Risk & Mitigation"
        subtitle="What's pinned to Inèdit, what's abstracted behind Helm-owned identifiers, and what changes if NeoStampa changes."
        action={<Tag color="yellow">Vendor dependency · documented</Tag>}
      />

      <div className="p-5 space-y-5">
        {/* What's pinned */}
        <div>
          <div className="text-[11px] uppercase tracking-wider text-gray-500 font-bold mb-2">What's pinned to Inèdit today</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
                <tr>
                  <th className="text-left px-3 py-2">Surface</th>
                  <th className="text-left px-3 py-2">Pinned to</th>
                  <th className="text-left px-3 py-2">Where</th>
                  <th className="text-left px-3 py-2">Risk if Inèdit changes</th>
                </tr>
              </thead>
              <tbody>
                <Pin row="Job ticket XML structure" pin="neoRipEngine 4.23.0" where="src/components/neostampa-xml-preview.tsx" risk="Change one function. Other Helm code unaffected." />
                <Pin row="Notification URL contract" pin="Inèdit spec §p.85 query-param format" where="/api/rip-events GET handler" risk="Add a new parser; old format keeps working." />
                <Pin row="Hot folder file naming" pin="${externalJobName}.xml" where="/api/dispatch-to-rip" risk="None — our convention, not Inèdit's." />
                <Pin row="ICC profile binding" pin="<ConvertProfile SourceID …/>" where="buildNeoStampaXml" risk="One-line spec migration." />
                <Pin row="RapportInfo element" pin="<RapportInfo direction=V fraction_high=1 fraction_low=2/>" where="buildNeoStampaXml" risk="Inèdit-specific element. If renamed: one-line change." />
                <Pin row="CGI invocation" pin="neoRipEngineCGI -p ... -out ..." where="Agent (out of Helm scope, runs on RIP machines)" risk="Agent code updates; Helm unaffected." />
                <Pin row="XML spec version per job" pin="rip_jobs.xml_spec_version" where="rip_jobs row" risk="Lets in-flight jobs continue under their original spec when 5.0 ships." />
              </tbody>
            </table>
          </div>
        </div>

        {/* What's abstracted */}
        <div>
          <div className="text-[11px] uppercase tracking-wider text-gray-500 font-bold mb-2">What is NOT pinned (abstracted behind Helm-owned identifiers)</div>
          <div className="grid grid-cols-2 gap-3">
            <Mitigation
              title="external_job_name is Helm's convention"
              detail="CUSTOMER_PR-#_FO-#_DESIGN_COLORWAY_yyYD has zero Inèdit-specific tokens. If we swap RIP vendors tomorrow, the name still resolves to a Helm PR."
            />
            <Mitigation
              title="rip_jobs lives in Helm's DB"
              detail="The 12-state lifecycle, retry tracking, error history, and event timeline are owned by Helm. No NeoStampa table dependency."
            />
            <Mitigation
              title="Physical QR = ground truth, not software status"
              detail="Even if Inèdit's notification URLs break, the Traveler QR scanned at printer exit promotes the print to print_complete_qr. We never need NeoStampa to tell us 'this printed.'"
            />
            <Mitigation
              title="Three inbound channels, not one"
              detail="Inèdit notification URL + agent log-tail + agent folder-watch. If any one breaks, the others detect — and the agent reconciles."
            />
            <Mitigation
              title="rip_target column on hot_folders"
              detail="Each hot folder declares which RIP product it feeds. Today 'inedit_neostampa'. Tomorrow could be 'efi_fiery' / 'colorgate' / 'caldera' / 'inhouse_rip'. Switching is a config change."
            />
            <Mitigation
              title="Reconciliation Queue catches anything"
              detail="If a GUI-originated job appears that Helm doesn't recognize → Reconciliation Queue with EX-RIP-ORPHANED. Vendor switch doesn't drop work on the floor."
            />
          </div>
        </div>

        {/* Today's targets */}
        <div>
          <div className="text-[11px] uppercase tracking-wider text-gray-500 font-bold mb-2">Active RIP targets</div>
          <div className="flex gap-3">
            {targets.map((t) => (
              <div key={t.rip_target} className="border border-gray-200 rounded p-3 flex-1">
                <div className="font-mono text-xs font-semibold text-navy-700">{t.rip_target}</div>
                <div className="text-2xl font-bold text-navy-900 mt-1">{t.folder_count}</div>
                <div className="text-[10px] uppercase tracking-wider text-gray-500">hot folders</div>
              </div>
            ))}
            <div className="border border-dashed border-gray-300 rounded p-3 flex-1 text-center">
              <div className="text-xs text-gray-400 italic">Future adapters: efi_fiery · colorgate · caldera · inhouse_rip</div>
            </div>
          </div>
        </div>

        {/* If Inèdit changes — runbook */}
        <div className="bg-yellow-50 border-l-4 border-yellow-400 rounded p-4">
          <div className="text-xs font-bold text-yellow-900 mb-2">If Inèdit changes the spec — runbook</div>
          <ol className="space-y-1 text-xs text-yellow-900 list-decimal list-inside">
            <li>Inèdit ships a new neoRipEngine version. Read the release notes, identify breaking changes.</li>
            <li>Update <code className="font-mono">buildNeoStampaXml()</code> to emit the new shape. Bump the default <code className="font-mono">xml_spec_version</code> default.</li>
            <li>In-flight jobs continue under their original spec via <code className="font-mono">rip_jobs.xml_spec_version</code>. New jobs use the new spec.</li>
            <li>Update the agent (out-of-process) to parse any new notification URL shape. Existing GET/POST handler on <code className="font-mono">/api/rip-events</code> may already work since we control the URL query params.</li>
            <li>Run the test suite (CI catches any drift in the XML output).</li>
            <li>Stage rollout: one RIP machine first, watch for 24h, then fleet-wide.</li>
          </ol>
        </div>

        {/* If Inèdit goes away */}
        <div className="bg-red-50 border-l-4 border-red-400 rounded p-4">
          <div className="text-xs font-bold text-red-900 mb-2">If Inèdit goes away entirely (acquisition, EOL, etc.) — fallback options</div>
          <ul className="space-y-1 text-xs text-red-900 list-disc list-inside">
            <li>The agent can switch to another RIP backend with no Helm code changes (just <code className="font-mono">hot_folders.rip_target</code> flip).</li>
            <li>Alternatives evaluated: <strong>EFI Fiery</strong> (similar XML job-ticket model, well-documented), <strong>ColorGate Productionserver</strong> (textile-focused, similar capabilities), <strong>Caldera GrandRIP+</strong> (cross-industry, mature).</li>
            <li>External job name + physical QR scan flow is vendor-independent. PR Detail, Reconciliation Queue, dispatcher API all work against any RIP that accepts XML job tickets and watches a hot folder.</li>
            <li>The <code className="font-mono">.xjb</code> archive bundles we already keep (per spec p.83) preserve historical jobs even after Inèdit is gone.</li>
          </ul>
        </div>

        <div className="text-[10px] text-gray-500 italic">
          Reviewed at every major NeoStampa release. Vendor risk is acknowledged in the
          ADT Helm blueprint and remains within tolerance because (a) Inèdit is the
          textile-print industry standard, (b) the spec has been stable across several
          major versions, and (c) our abstraction layer means a switch costs days, not weeks.
        </div>
      </div>
    </Card>
  );
}

function Pin({ row, pin, where, risk }: { row: string; pin: string; where: string; risk: string }) {
  return (
    <tr className="border-t border-gray-100">
      <td className="px-3 py-2 text-xs font-semibold">{row}</td>
      <td className="px-3 py-2 text-xs font-mono text-navy-700">{pin}</td>
      <td className="px-3 py-2 text-[10px] font-mono text-gray-500">{where}</td>
      <td className="px-3 py-2 text-[11px] text-gray-600 italic">{risk}</td>
    </tr>
  );
}

function Mitigation({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="border border-gray-200 rounded p-3 bg-gray-50/30">
      <div className="font-semibold text-navy-700 text-xs mb-1">{title}</div>
      <div className="text-[11px] text-gray-600 leading-relaxed">{detail}</div>
    </div>
  );
}
