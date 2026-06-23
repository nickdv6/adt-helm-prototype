// /api/promote-to-strike-off — colorist promotes 1 or more artwork versions to a strike-off
//
// This is the EXPLICIT human action that converts a Draft artwork_files row into a print
// event. Saves are decoupled from prints (see /api/artwork-saved); only promote-to-strike
// causes a hot folder write. Two modes:
//
//   Single-variant   (1 artwork_file)    → 1 strike-off, 1 print, 1 fabric output
//   Multi-variant    (2-4 artwork_files) → 1 strike-off, 1 print run with N variants laid
//                                          out side-by-side, customer picks the winner.
//
// POST body:
//   {
//     "pr_id": 123,
//     "artwork_file_ids": [421],                       // single-variant
//   }
//   OR
//   {
//     "pr_id": 123,
//     "artwork_file_ids": [421, 422, 423],             // multi-variant
//   }
//
// What this endpoint does (would-do, in Vercel read-only mode):
//   1. Validate every artwork_file_id belongs to the same design+colorway as the PR
//   2. Validate every file's hash exists on disk (in production)
//   3. Mark each artwork_files.is_strike_off_candidate = 1 + promoted_at = now
//   4. CREATE a strike_offs row: is_multi_variant = (ids.length > 1), variant_artwork_file_ids = JSON
//   5. CREATE a rip_jobs row tied to the strike-off (the composite engine builds an XML
//      that lays out all N variants if multi-variant)
//   6. WRITE the XML to the hot folder targeted by the printer for this PR
//   7. PR.rip_status moves to ready_for_rip
//
// This is the "send to NeoStampa" trigger. Nothing prints before this is called.

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

const CONTRACT = {
  name: 'POST /api/promote-to-strike-off',
  purpose: 'Colorist promotes 1+ artwork versions for a strike-off run. Triggers composite + hot folder write.',
  modes: {
    single_variant: '1 artwork_file_id. Standard strike-off — one version, one print, one fabric output.',
    multi_variant: '2-4 artwork_file_ids. Composite engine lays them out side-by-side on one fabric run. Customer compares + picks the winner on review. Winner becomes canonical, losers archived.',
  },
  side_effects: [
    'artwork_files.is_strike_off_candidate = 1 + promoted_at = now (per id)',
    'INSERT strike_offs row with is_multi_variant flag + variant_artwork_file_ids JSON',
    'INSERT rip_jobs row tied to the strike-off',
    'WRITE composite XML to the hot folder (Phase 1.8 dispatcher)',
    'UPDATE print_requests.rip_status = ready_for_rip',
  ],
  validation_rules: [
    'Every artwork_file_id must reference the same (design_id, colorway_id) as the PR',
    'Every artwork_file must have a file_hash (not NULL)',
    'Multi-variant: 2-4 ids only (max 4 to fit a 60-inch fabric run with reasonable repeats)',
  ],
};

export async function GET() {
  return NextResponse.json(CONTRACT);
}

export async function POST(req: NextRequest) {
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }); }

  const prId = Number(body.pr_id);
  const ids: number[] = Array.isArray(body.artwork_file_ids) ? body.artwork_file_ids.map(Number) : [];

  if (!prId) return NextResponse.json({ error: 'pr_id required' }, { status: 400 });
  if (ids.length === 0) return NextResponse.json({ error: 'artwork_file_ids required (non-empty array)' }, { status: 400 });
  if (ids.length > 4) return NextResponse.json({ error: 'Multi-variant capped at 4 variants per run' }, { status: 400 });

  const db = getDb();

  const pr = db.prepare(`
    SELECT pr.id, pr.printer_id,
           ol.design_id, ol.colorway_id,
           d.plant_number, d.name as design_name,
           cw.name as colorway_name,
           co.name as company_name
    FROM print_requests pr
    JOIN order_lines ol ON ol.id = pr.order_line_id
    JOIN designs d ON d.id = ol.design_id
    LEFT JOIN colorways cw ON cw.id = ol.colorway_id
    JOIN orders o ON o.id = ol.order_id
    JOIN companies co ON co.id = o.company_id
    WHERE pr.id = ?
  `).get(prId) as any;
  if (!pr) return NextResponse.json({ error: `PR ${prId} not found` }, { status: 404 });

  // Validate every artwork_file belongs to this PR's design+colorway
  const placeholders = ids.map(() => '?').join(',');
  const files = db.prepare(`
    SELECT id, design_id, colorway_id, version_number, file_name, file_hash, working_path, nas_path, status
    FROM artwork_files WHERE id IN (${placeholders})
  `).all(...ids) as any[];

  if (files.length !== ids.length) {
    return NextResponse.json({
      error: 'One or more artwork_file_ids not found',
      requested: ids,
      found: files.map((f) => f.id),
    }, { status: 404 });
  }

  const mismatched = files.filter((f) =>
    f.design_id !== pr.design_id ||
    ((f.colorway_id ?? null) !== (pr.colorway_id ?? null))
  );
  if (mismatched.length > 0) {
    return NextResponse.json({
      error: 'One or more artwork files do not belong to the PR design+colorway',
      pr_expects: { design_id: pr.design_id, colorway_id: pr.colorway_id },
      mismatched: mismatched.map((f) => ({ id: f.id, design_id: f.design_id, colorway_id: f.colorway_id })),
    }, { status: 422 });
  }

  const missingHash = files.filter((f) => !f.file_hash);
  if (missingHash.length > 0) {
    return NextResponse.json({
      error: 'Cannot promote — artwork rows missing file_hash. Did the agent capture this save?',
      missing: missingHash.map((f) => f.id),
    }, { status: 422 });
  }

  const isMulti = ids.length > 1;
  const now = new Date().toISOString();
  const strikeOffNumber = `SO-${pr.plant_number}-${Date.now().toString().slice(-6)}`;
  const externalJobName = isMulti
    ? `${pr.company_name.replace(/\s+/g, '')}_PR-${prId}_${pr.design_name.replace(/\s+/g, '-')}_MULTIVAR-${ids.length}`
    : `${pr.company_name.replace(/\s+/g, '')}_PR-${prId}_${pr.design_name.replace(/\s+/g, '-')}_${files[0].file_name.replace('.tiff','')}`;

  return NextResponse.json({
    result: 'would_promote',
    note: 'Vercel SQLite filesystem is read-only at runtime. In production this would write strike_offs + rip_jobs + the hot folder XML.',
    mode: isMulti ? 'multi_variant' : 'single_variant',
    pr: {
      id: pr.id,
      design: pr.design_name,
      colorway: pr.colorway_name,
      company: pr.company_name,
    },
    files_being_promoted: files.map((f, i) => ({
      slot: isMulti ? `variant_${i + 1}` : 'primary',
      artwork_file_id: f.id,
      version: f.version_number,
      file_name: f.file_name,
      hash: f.file_hash,
      nas_path: f.nas_path,
    })),
    would_update_artwork_files: files.map((f) => ({
      where: { id: f.id },
      set: { is_strike_off_candidate: 1, promoted_at: now, status: 'Pending Approval' },
    })),
    would_insert_strike_off: {
      strike_off_number: strikeOffNumber,
      print_request_id: prId,
      artwork_file_id: isMulti ? null : files[0].id,
      is_multi_variant: isMulti ? 1 : 0,
      variant_artwork_file_ids: isMulti ? JSON.stringify(ids) : null,
      status: 'Requested',
      printer_id_at_approval: pr.printer_id,
    },
    would_dispatch_to_rip: {
      external_job_name: externalJobName,
      composite_engine: isMulti
        ? `Lays out ${ids.length} variants side-by-side on a single fabric run. Each variant gets its own label printed on the strike for customer comparison.`
        : 'Standard single-design composite.',
      next_step: 'Hot folder drop → NeoStampa picks up XML → strike-off prints',
    },
  });
}
