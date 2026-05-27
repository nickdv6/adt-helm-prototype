import Link from 'next/link';
import { getDb } from '@/lib/db';
import { Card, CardHeader, StatusPill, Tag, Button } from '@/components/ui';
import { formatDate, relativeTime } from '@/lib/utils';

// S06 Colorist Home (Jeannine)
// Per S23-S32.46: Jeannine is default colorist; assignments inherited from order line
// Per S23-S32.60: internal pre-production proof review queue (NEW — Wave 1 scope)
// Per S23-S32.62: click-and-print PRs skip internal proof (auto-prep only)
// Per Jeannine's checklist item 4: auto-prep RIPs for repeat customers (Havenly etc.) — visible as 'Auto-routed' tag

export default function ColoristHome() {
  const db = getDb();

  // Internal proof review queue — the new core work surface
  const proofQueue = db.prepare(`
    SELECT pr.id, pr.pr_number, pr.internal_proof_requested_at, pr.planned_yardage,
           pr.strike_off_classification, pr.is_click_and_print, pr.was_csv_auto_routed,
           ol.order_id, o.order_number, c.name as company_name, o.is_rush,
           d.plant_number, f.name as fabric_name, p.name as printer_name, p.ink_set
    FROM print_requests pr
    JOIN order_lines ol ON pr.order_line_id = ol.id
    JOIN orders o ON ol.order_id = o.id
    JOIN companies c ON o.company_id = c.id
    LEFT JOIN designs d ON ol.design_id = d.id
    LEFT JOIN fabrics f ON pr.fabric_id = f.id
    LEFT JOIN printers p ON pr.printer_id = p.id
    WHERE pr.internal_proof_status = 'pending'
    ORDER BY o.is_rush DESC, pr.internal_proof_requested_at ASC
  `).all() as any[];

  // Customer strike-off queue (separate flow — colorist still owns it)
  const strikeOffQueue = db.prepare(`
    SELECT ol.id, ol.strike_off_classification, o.id as order_id, o.order_number, c.name as company_name,
           d.plant_number, f.name as fabric_name, ol.colorist_user_id
    FROM order_lines ol
    JOIN orders o ON ol.order_id = o.id
    JOIN companies c ON o.company_id = c.id
    LEFT JOIN designs d ON ol.design_id = d.id
    LEFT JOIN fabrics f ON ol.fabric_id = f.id
    WHERE ol.strike_off_classification = 'Customer Strike-Off Required'
      AND o.status NOT IN ('Closed','Shipped','Invoiced','Cancelled')
    LIMIT 15
  `).all() as any[];

  // Auto-routed PRs (Jeannine sees them too — for transparency per her checklist item 4)
  const autoRouted = db.prepare(`
    SELECT pr.id, pr.pr_number, pr.created_at, pr.hot_folder_target,
           o.order_number, c.name as company_name, f.name as fabric_name
    FROM print_requests pr
    JOIN order_lines ol ON pr.order_line_id = ol.id
    JOIN orders o ON ol.order_id = o.id
    JOIN companies c ON o.company_id = c.id
    LEFT JOIN fabrics f ON pr.fabric_id = f.id
    WHERE pr.was_csv_auto_routed = 1
      AND date(pr.created_at) >= date('now', '-3 days')
    ORDER BY pr.created_at DESC LIMIT 10
  `).all() as any[];

  const counts = {
    proof: proofQueue.length,
    proofRush: proofQueue.filter((p) => p.is_rush).length,
    strikeOff: strikeOffQueue.length,
    autoRouted: autoRouted.length,
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-navy-900">Colorist Home — Jeannine Romero</h1>
        <p className="text-sm text-gray-500 mt-1">S06 · Per S23-S32.46 default colorist · Internal proof review per S23-S32.60</p>
      </header>

      <div className="grid grid-cols-4 gap-4">
        <Stat label="Internal Proof Queue" value={counts.proof} accent="yellow" />
        <Stat label="Rush in Proof Queue" value={counts.proofRush} accent="red" />
        <Stat label="Open Customer Strike-Offs" value={counts.strikeOff} accent="blue" />
        <Stat label="Auto-Routed (Last 3d)" value={counts.autoRouted} accent="green" />
      </div>

      {/* Internal Proof Queue — the new Jeannine work surface */}
      <Card>
        <CardHeader
          title="Internal Pre-Production Proof Queue"
          subtitle="Per S23-S32.60 — first piece off the printer; approve to release for full production"
          action={<span className="text-xs text-gray-500">Rush first, then oldest in queue</span>}
        />
        <div className="divide-y divide-gray-100">
          {proofQueue.length === 0 && (
            <div className="px-5 py-10 text-center text-sm text-gray-400">
              No PRs awaiting internal proof. Auto-routed and Click-and-Print PRs skip this step (per S23-S32.62).
            </div>
          )}
          {proofQueue.map((pr) => (
            <div key={pr.id} className="px-5 py-3 flex items-center gap-4 hover:bg-gray-50">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Link href={`/print-requests/${pr.id}`} className="font-mono font-semibold text-navy-700 hover:underline">{pr.pr_number}</Link>
                  {pr.is_rush ? <Tag color="red">Rush</Tag> : null}
                  {pr.plant_number ? <Tag color="blue">{pr.plant_number}</Tag> : null}
                  {pr.is_click_and_print ? <Tag color="purple">C+P</Tag> : null}
                </div>
                <div className="text-xs text-gray-600">
                  <Link href={`/orders/${pr.order_id}`} className="font-mono text-navy-700 hover:underline">{pr.order_number}</Link>
                  <span className="mx-2">·</span>
                  {pr.company_name}
                  <span className="mx-2">·</span>
                  {pr.fabric_name}
                  <span className="mx-2">·</span>
                  <span className="text-gray-500">{pr.printer_name} ({pr.ink_set})</span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-gray-500">Awaiting {relativeTime(pr.internal_proof_requested_at)}</div>
                <div className="text-xs text-gray-400 mt-0.5">{pr.planned_yardage} yds planned</div>
              </div>
              <div className="flex gap-1.5">
                <Button variant="secondary">Approve</Button>
                <Button variant="danger">Fail</Button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-6">
        <Card>
          <CardHeader
            title="Customer Strike-Off Queue"
            subtitle="Per OD-9 — orders needing customer strike-off before production"
          />
          <div className="divide-y divide-gray-100">
            {strikeOffQueue.length === 0 && (
              <div className="px-5 py-6 text-sm text-gray-400">No open customer strike-offs.</div>
            )}
            {strikeOffQueue.map((sl) => (
              <div key={sl.id} className="px-5 py-2.5 flex items-center gap-3 text-sm">
                <div className="flex-1">
                  <Link href={`/orders/${sl.order_id}`} className="font-mono text-navy-700 hover:underline">{sl.order_number}</Link>
                  <span className="text-gray-500 mx-2">·</span>
                  <span className="text-gray-700">{sl.company_name}</span>
                </div>
                <div className="text-xs text-gray-500">{sl.plant_number} · {sl.fabric_name}</div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Auto-Routed PRs (Visibility Only)"
            subtitle="Per Jeannine #4 — CSV/XML auto-prep, no proof needed; here for awareness"
          />
          <div className="divide-y divide-gray-100">
            {autoRouted.length === 0 && (
              <div className="px-5 py-6 text-sm text-gray-400">No recent auto-routed PRs.</div>
            )}
            {autoRouted.map((pr) => (
              <div key={pr.id} className="px-5 py-2.5 flex items-center gap-3 text-sm">
                <div className="flex-1">
                  <Link href={`/print-requests/${pr.id}`} className="font-mono text-navy-700 hover:underline">{pr.pr_number}</Link>
                  <Tag color="blue">Auto-routed</Tag>
                </div>
                <div className="text-xs text-gray-500">{pr.company_name} · {relativeTime(pr.created_at)}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
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
          <div className="text-2xl font-bold text-navy-900 leading-tight">{value}</div>
          <div className="text-[11px] text-gray-500 uppercase tracking-wider mt-0.5">{label}</div>
        </div>
      </div>
    </Card>
  );
}
