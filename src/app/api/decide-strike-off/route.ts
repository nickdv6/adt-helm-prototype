// /api/decide-strike-off — Strike-Off Decision Engine
//
// Given a Print Request, decides whether a strike-off is required before production
// printing — and if so, why. The decision engine sits BEFORE the colorist touches
// anything: when a PR arrives, Helm runs this engine and routes the PR accordingly.
//
// Decision tree (in priority order — first match wins):
//   1. Is there an APPROVED artwork hash for THIS design+colorway?
//      - YES → check ICC freshness + approval age + Customer skip flag
//             - If all checks pass: SKIP strike, go direct to production (reorder path)
//             - If any check fails: re-strike required (re-qualification)
//      - NO  → strike required (new design or new colorway)
//   2. Customer Automation Profile: skip_strike_for_new_colorways = 1 (e.g. St Frank C&P)
//      → SKIP strike, even on new colorway, IF parent design has an approved hash
//   3. Default: strike required
//
//   GET  /api/decide-strike-off?pr_id=123     → returns decision + reason
//   POST /api/decide-strike-off { pr_id }     → same, with would-be PR update
//
// On Vercel: this is a query-only endpoint (no writes). The PR status update is part
// of the contract but executes server-side only in production.

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

type Decision =
  | 'reuse_approved_skip_strike'           // Best case: reorder path, 5-minute round-trip
  | 'skip_strike_per_customer_profile'    // Customer pre-approved (e.g. St Frank C&P)
  | 'strike_required_new_design'          // First-time print
  | 'strike_required_new_colorway'        // Existing design, new colorway
  | 'strike_required_new_customer'        // Customer has never printed with us
  | 'restrike_required_icc_drift'         // Approved hash is stale wrt current ICC
  | 'restrike_required_approval_stale'    // Approval older than freshness window
  | 'restrike_required_printer_mismatch'  // Approved on different printer than production target
  | 'requires_manual_review';             // Edge case — colorist must decide

interface Result {
  decision: Decision;
  why: string;
  approved_artwork_file_id: number | null;
  production_artwork_file_id_proposed: number | null;
  next_step: string;
  warnings: string[];
}

function decide(prId: number): Result | { error: string; status: number } {
  const db = getDb();

  const pr = db.prepare(`
    SELECT pr.id, pr.order_line_id, pr.production_artwork_file_id, pr.printer_id,
           ol.design_id, ol.colorway_id,
           o.company_id,
           co.name as company_name, co.skip_strike_for_new_colorways, co.skip_strike_for_reorders, co.approval_freshness_days,
           d.plant_number, d.name as design_name
    FROM print_requests pr
    JOIN order_lines ol ON ol.id = pr.order_line_id
    JOIN orders o ON o.id = ol.order_id
    JOIN companies co ON co.id = o.company_id
    JOIN designs d ON d.id = ol.design_id
    WHERE pr.id = ?
  `).get(prId) as any;

  if (!pr) return { error: `PR ${prId} not found`, status: 404 };

  const warnings: string[] = [];

  // ---------- Step 1: look for approved artwork hash ----------
  const approved = db.prepare(`
    SELECT af.id, af.file_hash, af.approved_at, af.approved_by_strike_off_id,
           so.printer_id_at_approval, so.icc_profile_version_at_approval
    FROM artwork_files af
    LEFT JOIN strike_offs so ON so.id = af.approved_by_strike_off_id
    WHERE af.design_id = ?
      AND (af.colorway_id = ? OR (af.colorway_id IS NULL AND ? IS NULL))
      AND af.status = 'Approved'
    ORDER BY af.approved_at DESC LIMIT 1
  `).get(pr.design_id, pr.colorway_id, pr.colorway_id) as any;

  if (approved) {
    // We have an approved hash. Run re-qualification checks.

    // 1a. Approval freshness check (per Customer Automation Profile)
    if (approved.approved_at) {
      const ageDays = Math.floor((Date.now() - new Date(approved.approved_at).getTime()) / 86400000);
      const maxAge = pr.approval_freshness_days ?? 365;
      if (ageDays > maxAge) {
        return {
          decision: 'restrike_required_approval_stale',
          why: `Approval is ${ageDays} days old; ${pr.company_name} freshness window is ${maxAge} days. Re-qualification strike required.`,
          approved_artwork_file_id: approved.id,
          production_artwork_file_id_proposed: null,
          next_step: 'Colorist promotes a new version → strike-off → customer re-approves.',
          warnings: [],
        };
      }
    }

    // 1b. ICC drift check
    if (approved.icc_profile_version_at_approval && pr.printer_id) {
      const printer = db.prepare('SELECT current_icc_profile_version FROM printers WHERE id = ?').get(pr.printer_id) as any;
      if (printer?.current_icc_profile_version && printer.current_icc_profile_version !== approved.icc_profile_version_at_approval) {
        return {
          decision: 'restrike_required_icc_drift',
          why: `Approved against ICC ${approved.icc_profile_version_at_approval}; printer now on ${printer.current_icc_profile_version}. Substrate may render differently.`,
          approved_artwork_file_id: approved.id,
          production_artwork_file_id_proposed: null,
          next_step: 'Re-qualification strike-off required. Colorist promotes a version; same printer that production will run on.',
          warnings: [],
        };
      }
    }

    // 1c. Printer mismatch check
    if (approved.printer_id_at_approval && pr.printer_id && approved.printer_id_at_approval !== pr.printer_id) {
      warnings.push(`Approved on printer ${approved.printer_id_at_approval}, production routed to printer ${pr.printer_id}. ICC profiles differ across printers.`);
      return {
        decision: 'restrike_required_printer_mismatch',
        why: `Strike was approved on a different printer than the production routing target. Different ICC = different color result.`,
        approved_artwork_file_id: approved.id,
        production_artwork_file_id_proposed: null,
        next_step: 'Re-route PR to the original printer, OR run a re-qualification strike on the production printer.',
        warnings,
      };
    }

    // All checks passed — reorder path
    return {
      decision: 'reuse_approved_skip_strike',
      why: `Approved hash exists for ${pr.design_name} ${pr.colorway_id ? '(colorway matched)' : ''}, ICC fresh, within freshness window. Reorder path.`,
      approved_artwork_file_id: approved.id,
      production_artwork_file_id_proposed: approved.id,
      next_step: 'Set PR.production_artwork_file_id and dispatch to RIP. Round-trip ~5 minutes from intake to hot folder.',
      warnings,
    };
  }

  // ---------- Step 2: no approved hash for THIS colorway. Check parent design + customer profile. ----------
  // For "new colorway on existing design" case: if customer has skip_strike_for_new_colorways=1,
  // check whether the parent design has ANY approved hash. If yes → skip strike per Customer Profile.
  if (pr.skip_strike_for_new_colorways) {
    const parentApproved = db.prepare(`
      SELECT id FROM artwork_files
      WHERE design_id = ? AND status = 'Approved'
      ORDER BY approved_at DESC LIMIT 1
    `).get(pr.design_id) as any;
    if (parentApproved) {
      return {
        decision: 'skip_strike_per_customer_profile',
        why: `${pr.company_name} has skip_strike_for_new_colorways=1 (e.g. Click-and-Print arrangement). Parent design has an approved hash → direct to production.`,
        approved_artwork_file_id: parentApproved.id,
        production_artwork_file_id_proposed: parentApproved.id,
        next_step: 'Set PR.production_artwork_file_id to parent design approved hash + dispatch.',
        warnings: ['New colorway is using the parent design hash — Customer Profile responsibility for color accuracy.'],
      };
    }
  }

  // ---------- Step 3: is this customer a first-time printer with ADT? ----------
  const customerHasPrior = db.prepare(`
    SELECT COUNT(*) as n FROM artwork_files af
    JOIN designs d ON d.id = af.design_id
    WHERE d.company_id = ? AND af.status = 'Approved'
  `).get(pr.company_id) as any;
  if ((customerHasPrior?.n ?? 0) === 0) {
    return {
      decision: 'strike_required_new_customer',
      why: `${pr.company_name} has no prior approved artwork in Helm. Strike required to qualify the color match for this customer.`,
      approved_artwork_file_id: null,
      production_artwork_file_id_proposed: null,
      next_step: 'Colorist iterates → submit for strike-off → customer approves → strike approves the hash.',
      warnings: [],
    };
  }

  // ---------- Step 4: parent design has approved hash but THIS colorway does not ----------
  const parentDesignHasApproved = db.prepare(`
    SELECT id FROM artwork_files WHERE design_id = ? AND status = 'Approved' LIMIT 1
  `).get(pr.design_id) as any;
  if (parentDesignHasApproved) {
    return {
      decision: 'strike_required_new_colorway',
      why: `Parent design has approved artwork but no approval for this colorway. New color separation requires strike-off.`,
      approved_artwork_file_id: null,
      production_artwork_file_id_proposed: null,
      next_step: 'Colorist creates colorway separation → submit for strike-off → customer approves.',
      warnings: [],
    };
  }

  // ---------- Step 5: brand-new design, never printed ----------
  return {
    decision: 'strike_required_new_design',
    why: `First-time print of ${pr.design_name} (PLANT ${pr.plant_number}). No prior approved hash exists.`,
    approved_artwork_file_id: null,
    production_artwork_file_id_proposed: null,
    next_step: 'Colorist iterates → submit for strike-off → customer approves.',
    warnings: [],
  };
}

const CONTRACT = {
  name: 'Strike-Off Decision Engine',
  purpose: 'Given a PR, decide whether a strike-off is required before production. Returns: decision + why + next step.',
  decisions: {
    reuse_approved_skip_strike: 'Approved hash exists + ICC fresh + within freshness window. Direct to production. ~5 min.',
    skip_strike_per_customer_profile: 'Customer pre-approved (Click-and-Print). Parent design hash used for new colorway.',
    strike_required_new_design: 'First-time print of this design.',
    strike_required_new_colorway: 'Existing design, new colorway needs color separation.',
    strike_required_new_customer: 'First customer engagement — qualify color match.',
    restrike_required_icc_drift: 'Approved against stale ICC; printer current ICC has changed.',
    restrike_required_approval_stale: 'Approval older than Customer Profile freshness window.',
    restrike_required_printer_mismatch: 'Approved on different printer than production routing target.',
    requires_manual_review: 'Edge case — escalate to colorist + Megan.',
  },
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const prIdStr = searchParams.get('pr_id');
  if (!prIdStr) return NextResponse.json({ contract: CONTRACT });
  const prId = Number(prIdStr);
  if (!Number.isFinite(prId)) return NextResponse.json({ error: 'pr_id must be a number' }, { status: 400 });
  const result = decide(prId);
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  if (!body.pr_id) return NextResponse.json({ error: 'pr_id required' }, { status: 400 });
  const result = decide(Number(body.pr_id));
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({
    ...result,
    would_update_pr: result.production_artwork_file_id_proposed ? {
      table: 'print_requests',
      where: { id: body.pr_id },
      set: {
        production_artwork_file_id: result.production_artwork_file_id_proposed,
        rip_status: 'ready_for_rip',
      },
    } : null,
  });
}
