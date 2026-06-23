// Color Match Workflow card — Phase 1.11 hash-locked promotion UI.
//
// Shows the entire version chain for a PR's design+colorway with:
//   - Each artwork_files row (version, file_name, hash, colorist, comment, status)
//   - Strike-Off Decision Engine output at the top (skip-strike or which trigger fired)
//   - Submit for Strike-Off action (single or multi-variant)
//   - Approved hash callout (which version is the canonical production source)
//
// Rendered on PR Detail, between the RIP card and the PR Details card. Replaces
// the previous "current artwork file" surface which only showed the latest row.

import Link from 'next/link';
import { getDb } from '@/lib/db';
import { Card, CardHeader, Tag, Button } from '@/components/ui';
import { relativeTime } from '@/lib/utils';
import { CheckCircle2, Hash, FileText, AlertTriangle, Sparkles } from 'lucide-react';
import { PromoteToStrikeOffButton } from '@/components/promote-to-strike-off-button';

export function ColorMatchWorkflowCard({ prId }: { prId: number }) {
  const db = getDb();
  const pr = db.prepare(`
    SELECT pr.id, pr.production_artwork_file_id, pr.printer_id,
           ol.design_id, ol.colorway_id,
           d.plant_number, d.name as design_name,
           cw.name as colorway_name,
           c.name as company_name, c.skip_strike_for_new_colorways
    FROM print_requests pr
    JOIN order_lines ol ON ol.id = pr.order_line_id
    JOIN designs d ON d.id = ol.design_id
    LEFT JOIN colorways cw ON cw.id = ol.colorway_id
    JOIN orders o ON o.id = ol.order_id
    JOIN companies c ON c.id = o.company_id
    WHERE pr.id = ?
  `).get(prId) as any;
  if (!pr) return null;

  // Full version chain for this design+colorway
  const versions = db.prepare(`
    SELECT af.id, af.version_number, af.file_name, af.file_hash, af.status,
           af.working_path, af.comment, af.is_strike_off_candidate, af.promoted_at, af.approved_at,
           af.date_received,
           u.full_name as colorist_name
    FROM artwork_files af
    LEFT JOIN users u ON u.id = af.colorist_user_id
    WHERE af.design_id = ?
      AND (af.colorway_id = ? OR (af.colorway_id IS NULL AND ? IS NULL))
    ORDER BY af.version_number DESC
  `).all(pr.design_id, pr.colorway_id, pr.colorway_id) as any[];

  // Decision engine (called inline for display; in production this would be /api/decide-strike-off)
  const decision = decideStrikeOff(prId);

  return (
    <Card>
      <CardHeader
        title="Color Match · Version History"
        subtitle="Hash-locked promotion workflow. Saves are captured automatically; printing requires explicit promote."
        action={
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-gray-500 uppercase tracking-wider">Versions</span>
            <span className="text-sm font-mono font-bold">{versions.length}</span>
          </div>
        }
      />

      {/* Decision Engine output banner */}
      <DecisionBanner decision={decision} />

      {/* Approved hash callout (the canonical production source) */}
      {pr.production_artwork_file_id && (() => {
        const approved = versions.find((v) => v.id === pr.production_artwork_file_id);
        if (!approved) return null;
        return (
          <div className="mx-5 mt-3 mb-2 bg-green-50 border-l-4 border-green-500 px-4 py-3 rounded-r">
            <div className="flex items-start gap-2 text-sm">
              <CheckCircle2 className="w-4 h-4 text-green-700 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="font-semibold text-green-900">Canonical production source: v{approved.version_number} — {approved.file_name}</div>
                <div className="font-mono text-[10px] text-green-700 break-all mt-1">SHA256 {approved.file_hash?.slice(0, 32)}…</div>
                <div className="text-xs text-green-700 mt-1">Dispatcher reads this exact hash. Re-prints months later use the same bytes.</div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Version chain table */}
      <div className="divide-y divide-gray-100">
        {versions.map((v) => (
          <VersionRow key={v.id} v={v} isCanonical={v.id === pr.production_artwork_file_id} />
        ))}
        {versions.length === 0 && (
          <div className="px-5 py-6 text-center text-sm text-gray-400 italic">
            No saved versions yet. Agent file-watcher will populate this as the colorist saves.
          </div>
        )}
      </div>

      {/* Promotion action */}
      {versions.length > 0 && (
        <div className="border-t border-gray-100 px-5 py-3 flex items-center gap-2">
          <PromoteToStrikeOffButton
            prId={prId}
            versions={versions.map((v) => ({
              id: v.id,
              version_number: v.version_number,
              file_name: v.file_name,
              file_hash: v.file_hash,
              status: v.status,
            }))}
          />
          <span className="text-[11px] text-gray-500">
            Single = standard strike. Multi-variant (2–4) = lay them out on one print run, customer picks the winner.
          </span>
        </div>
      )}
    </Card>
  );
}

function VersionRow({ v, isCanonical }: { v: any; isCanonical: boolean }) {
  return (
    <div className={`px-5 py-3 grid grid-cols-12 gap-3 items-start text-sm ${isCanonical ? 'bg-green-50/30' : ''}`}>
      <div className="col-span-1 text-center">
        <div className="text-[10px] text-gray-500 uppercase">v</div>
        <div className="font-mono font-bold text-navy-900">{v.version_number}</div>
      </div>
      <div className="col-span-5 min-w-0">
        <div className="font-mono text-xs font-semibold text-navy-900 truncate">{v.file_name}</div>
        <div className="font-mono text-[10px] text-gray-500 break-all flex items-center gap-1 mt-0.5">
          <Hash className="w-2.5 h-2.5" />
          {v.file_hash ? `${v.file_hash.slice(0, 24)}…` : <span className="italic">no hash — pre-1.11 row</span>}
        </div>
        {v.comment && (
          <div className="text-[11px] text-gray-700 italic mt-1 flex items-start gap-1">
            <FileText className="w-2.5 h-2.5 mt-0.5 flex-shrink-0" />
            "{v.comment}"
          </div>
        )}
      </div>
      <div className="col-span-3 text-xs space-y-0.5">
        <div className="flex items-center gap-1.5">
          <StatusTag status={v.status} />
          {v.is_strike_off_candidate ? <Tag color="purple">Strike candidate</Tag> : null}
          {isCanonical ? <Tag color="green">Canonical</Tag> : null}
        </div>
        <div className="text-[10px] text-gray-500">{v.colorist_name ?? '—'}</div>
      </div>
      <div className="col-span-3 text-right text-[10px] text-gray-500 space-y-0.5">
        {v.approved_at ? <div className="text-green-700 font-semibold">Approved {relativeTime(v.approved_at)}</div>
          : v.promoted_at ? <div className="text-purple-700">Promoted {relativeTime(v.promoted_at)}</div>
          : <div>Saved {relativeTime(v.date_received)}</div>}
      </div>
    </div>
  );
}

function StatusTag({ status }: { status: string }) {
  const map: Record<string, 'green' | 'blue' | 'yellow' | 'gray' | 'red'> = {
    Approved: 'green',
    'Pending Approval': 'yellow',
    Draft: 'blue',
    Archived: 'gray',
  };
  return <Tag color={map[status] ?? 'gray'}>{status}</Tag>;
}

function DecisionBanner({ decision }: { decision: ReturnType<typeof decideStrikeOff> }) {
  if (!decision) return null;
  const colorMap: Record<string, { bg: string; border: string; text: string; icon: typeof CheckCircle2 }> = {
    reuse_approved_skip_strike:        { bg: 'bg-emerald-50', border: 'border-emerald-500', text: 'text-emerald-900', icon: Sparkles },
    skip_strike_per_customer_profile:  { bg: 'bg-purple-50',  border: 'border-purple-500',  text: 'text-purple-900',  icon: Sparkles },
    strike_required_new_design:        { bg: 'bg-amber-50',   border: 'border-amber-500',   text: 'text-amber-900',   icon: AlertTriangle },
    strike_required_new_colorway:      { bg: 'bg-amber-50',   border: 'border-amber-500',   text: 'text-amber-900',   icon: AlertTriangle },
    strike_required_new_customer:      { bg: 'bg-amber-50',   border: 'border-amber-500',   text: 'text-amber-900',   icon: AlertTriangle },
    restrike_required_icc_drift:       { bg: 'bg-red-50',     border: 'border-red-500',     text: 'text-red-900',     icon: AlertTriangle },
    restrike_required_approval_stale:  { bg: 'bg-red-50',     border: 'border-red-500',     text: 'text-red-900',     icon: AlertTriangle },
    restrike_required_printer_mismatch:{ bg: 'bg-red-50',     border: 'border-red-500',     text: 'text-red-900',     icon: AlertTriangle },
    requires_manual_review:            { bg: 'bg-gray-50',    border: 'border-gray-500',    text: 'text-gray-900',    icon: AlertTriangle },
  };
  const cfg = colorMap[decision.decision] ?? colorMap.requires_manual_review;
  const Icon = cfg.icon;
  return (
    <div className={`mx-5 mt-3 ${cfg.bg} border-l-4 ${cfg.border} px-4 py-3 rounded-r`}>
      <div className="flex items-start gap-2">
        <Icon className={`w-4 h-4 ${cfg.text} flex-shrink-0 mt-0.5`} />
        <div className="flex-1 text-sm">
          <div className="flex items-center gap-2 mb-0.5">
            <span className={`font-semibold ${cfg.text}`}>Strike-Off Decision Engine</span>
            <Tag color={decision.decision.startsWith('reuse') || decision.decision.startsWith('skip') ? 'green' : decision.decision.startsWith('restrike') ? 'red' : 'yellow'}>
              {decision.decision.replace(/_/g, ' ')}
            </Tag>
          </div>
          <div className={`text-xs ${cfg.text}`}>{decision.why}</div>
          <div className="text-[11px] text-gray-700 mt-1.5 italic">Next: {decision.next_step}</div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Inline decision engine — mirror of /api/decide-strike-off
// (Server-side, called during render. The API route is for external/agent use.)
// ============================================================
function decideStrikeOff(prId: number) {
  const db = getDb();
  const pr = db.prepare(`
    SELECT pr.id, pr.production_artwork_file_id, pr.printer_id,
           ol.design_id, ol.colorway_id,
           co.skip_strike_for_new_colorways, co.approval_freshness_days,
           co.name as company_name
    FROM print_requests pr
    JOIN order_lines ol ON ol.id = pr.order_line_id
    JOIN orders o ON o.id = ol.order_id
    JOIN companies co ON co.id = o.company_id
    WHERE pr.id = ?
  `).get(prId) as any;
  if (!pr) return null;

  const approved = db.prepare(`
    SELECT af.id, af.approved_at
    FROM artwork_files af
    WHERE af.design_id = ? AND (af.colorway_id = ? OR (af.colorway_id IS NULL AND ? IS NULL))
      AND af.status = 'Approved'
    ORDER BY af.approved_at DESC LIMIT 1
  `).get(pr.design_id, pr.colorway_id, pr.colorway_id) as any;

  if (approved) {
    if (approved.approved_at) {
      const ageDays = Math.floor((Date.now() - new Date(approved.approved_at).getTime()) / 86400000);
      if (ageDays > (pr.approval_freshness_days ?? 365)) {
        return {
          decision: 'restrike_required_approval_stale' as const,
          why: `Approval is ${ageDays}d old; ${pr.company_name} freshness window is ${pr.approval_freshness_days}d.`,
          next_step: 'Colorist promotes a new version → strike-off → customer re-approves.',
        };
      }
    }
    return {
      decision: 'reuse_approved_skip_strike' as const,
      why: `Approved hash exists and is within freshness window. Reorder path.`,
      next_step: 'Dispatcher reads production_artwork_file_id and writes XML. ~5 min round-trip.',
    };
  }

  if (pr.skip_strike_for_new_colorways) {
    const parentApproved = db.prepare(`SELECT id FROM artwork_files WHERE design_id = ? AND status = 'Approved' LIMIT 1`).get(pr.design_id) as any;
    if (parentApproved) {
      return {
        decision: 'skip_strike_per_customer_profile' as const,
        why: `${pr.company_name} has skip_strike_for_new_colorways = 1. Parent design hash applies.`,
        next_step: 'Direct to production.',
      };
    }
  }

  const parentDesignHasApproved = db.prepare(`SELECT id FROM artwork_files WHERE design_id = ? AND status = 'Approved' LIMIT 1`).get(pr.design_id) as any;
  if (parentDesignHasApproved) {
    return {
      decision: 'strike_required_new_colorway' as const,
      why: `Parent design has approved artwork but no approval for this colorway.`,
      next_step: 'Colorist creates colorway separation → submit → customer approves.',
    };
  }

  return {
    decision: 'strike_required_new_design' as const,
    why: `First-time print of this design. No prior approved hash.`,
    next_step: 'Colorist iterates → submit for strike-off → customer approves.',
  };
}
