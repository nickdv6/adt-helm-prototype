// /api/artwork-saved — agent file-watcher webhook for the hash-locked promotion workflow.
//
// Fires every time a colorist saves a working file in the Helm-managed working folder
// (\\nas\artwork\<PLANT#>\<COLORWAY>\working\). The agent computes SHA256 of the bytes
// on disk and POSTs the event here. Helm creates a new artwork_files row tagged with
// the colorist, the hash, the working path, and a comment (optional, can be supplied
// via the colorist's NeoStampa Canvas comment field or a Helm prompt on the save event).
//
// Importantly: this DOES NOT print anything. Saves are decoupled from prints. Every save
// grows version history by one row. To print, the colorist must explicitly call
// /api/promote-to-strike-off.
//
// On Vercel the SQLite filesystem is read-only at runtime, so this endpoint validates
// and returns the would-be insert. The contract is real; persistence plugs in when
// production moves to Postgres.
//
//   GET  /api/artwork-saved                          → contract docs
//   POST /api/artwork-saved  with JSON body          → would-insert artwork_files row
//
// Body shape (from the agent on save):
// {
//   "design_plant_number": "P26-1042",      // resolved via the working folder path
//   "colorway_name": "Indigo",              // resolved via the working folder path
//   "file_name": "P26-1042_Floral_Indigo_v4.tiff",
//   "working_path": "\\nas\\artwork\\P26-1042\\Indigo\\working\\P26-1042_Floral_Indigo_v4.tiff",
//   "nas_path": "\\nas\\artwork\\P26-1042\\P26-1042_Floral_Indigo_v4.tiff",
//   "sha256": "a2c4b1...",                  // computed by agent via sha256sum
//   "colorist_email": "jeannine@adt.com",   // from filesystem owner or NS session
//   "comment": "tightened repeat 0.5cm",    // optional, from colorist prompt
//   "file_size_kb": 38420,
//   "dpi": 600,
//   "color_profile": "Adobe RGB (1998)",
//   "width_inches": 54,
//   "height_inches": 36
// }

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

const CONTRACT = {
  name: 'POST /api/artwork-saved',
  purpose: 'Agent file-watcher webhook. Fires on every save in the colorist working folder. NEVER prints — only grows version history.',
  decoupling: {
    save: 'Every save = one artwork_files row. Hash captures byte identity. Version count auto-increments.',
    promote: 'Explicit colorist action via /api/promote-to-strike-off. Only promoted versions get composited + dispatched.',
    why: 'A colorist iterating 7 times produces 7 versions in Helm with zero hot folder writes. Prevents accidental fabric/ink waste.',
  },
  required_fields: ['design_plant_number', 'file_name', 'working_path', 'sha256'],
  optional_fields: ['colorway_name', 'colorist_email', 'comment', 'file_size_kb', 'dpi', 'color_profile', 'width_inches', 'height_inches', 'nas_path'],
  resolution_steps: [
    '1. Look up design by plant_number → design_id',
    '2. Look up colorway by name within design → colorway_id (or NULL)',
    '3. Look up colorist by email → users.id',
    '4. Look up max(version_number) for this (design_id, colorway_id) → next_version',
    '5. Check for duplicate hash on existing rows (same bytes saved twice = no new row)',
    '6. INSERT artwork_files row with status=Draft, is_strike_off_candidate=0',
  ],
  side_effects: {
    none: 'No hot folder writes. No rip_jobs. No XML. The colorist must explicitly promote.',
  },
  duplicate_hash_handling: 'If an artwork_files row already exists with the same SHA256 for this design+colorway, return existing row id and DO NOT insert. Common case: NS Canvas auto-saves the same file twice.',
};

export async function GET() {
  return NextResponse.json(CONTRACT);
}

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body. See GET /api/artwork-saved for contract.' }, { status: 400 });
  }

  const { design_plant_number, file_name, working_path, sha256 } = body;
  if (!design_plant_number || !file_name || !working_path || !sha256) {
    return NextResponse.json({
      error: 'Missing required field. Required: design_plant_number, file_name, working_path, sha256',
      received: Object.keys(body),
      contract: CONTRACT,
    }, { status: 400 });
  }

  // Hash sanity check
  if (!/^[a-f0-9]{64}$/i.test(sha256)) {
    return NextResponse.json({ error: 'sha256 must be a 64-character hex string (lower or upper case).' }, { status: 400 });
  }

  const db = getDb();

  // Resolve design by plant_number
  const design = db.prepare('SELECT id, name, company_id FROM designs WHERE plant_number = ?').get(design_plant_number) as any;
  if (!design) {
    return NextResponse.json({
      error: `No design found with plant_number=${design_plant_number}`,
      resolution: 'Agent should fall back to creating an "orphan" artwork_files row tagged for manual reconciliation. Not implemented in prototype.',
    }, { status: 404 });
  }

  // Resolve colorway (optional)
  let colorway: any = null;
  if (body.colorway_name) {
    colorway = db.prepare('SELECT id, name FROM colorways WHERE design_id = ? AND name = ?').get(design.id, body.colorway_name);
  }

  // Resolve colorist
  let colorist: any = null;
  if (body.colorist_email) {
    colorist = db.prepare('SELECT id, full_name FROM users WHERE email = ?').get(body.colorist_email);
  }

  // Duplicate hash check
  const existing = db.prepare(`
    SELECT id, version_number, file_name FROM artwork_files
    WHERE design_id = ? AND (colorway_id = ? OR (colorway_id IS NULL AND ? IS NULL)) AND file_hash = ?
  `).get(design.id, colorway?.id ?? null, colorway?.id ?? null, sha256.toLowerCase()) as any;
  if (existing) {
    return NextResponse.json({
      result: 'duplicate_hash_no_insert',
      reason: 'An artwork_files row with this SHA256 already exists for this design+colorway. Same bytes = same canonical row. Agent should NOT insert again.',
      existing_artwork_file: existing,
    });
  }

  // Compute next version
  const maxVer = db.prepare(`
    SELECT COALESCE(MAX(version_number), 0) as v FROM artwork_files
    WHERE design_id = ? AND (colorway_id = ? OR (colorway_id IS NULL AND ? IS NULL))
  `).get(design.id, colorway?.id ?? null, colorway?.id ?? null) as any;
  const nextVersion = (maxVer?.v ?? 0) + 1;

  // Compose the would-be insert (Vercel is read-only — this is a contract, not a write)
  const would_insert = {
    table: 'artwork_files',
    columns: {
      design_id: design.id,
      colorway_id: colorway?.id ?? null,
      version_number: nextVersion,
      file_name,
      nas_path: body.nas_path ?? working_path,
      working_path,
      status: 'Draft',
      is_original: nextVersion === 1 ? 1 : 0,
      date_received: new Date().toISOString(),
      submitted_by_user_id: colorist?.id ?? null,
      colorist_user_id: colorist?.id ?? null,
      file_hash: sha256.toLowerCase(),
      comment: body.comment ?? null,
      dpi: body.dpi ?? null,
      color_profile: body.color_profile ?? null,
      width_inches: body.width_inches ?? null,
      height_inches: body.height_inches ?? null,
      file_size_kb: body.file_size_kb ?? null,
      is_strike_off_candidate: 0,
    },
  };

  return NextResponse.json({
    result: 'would_insert',
    note: 'Vercel SQLite filesystem is read-only at runtime. In production (Postgres) this row would be persisted.',
    design_resolved: { id: design.id, name: design.name, company_id: design.company_id, plant_number: design_plant_number },
    colorway_resolved: colorway,
    colorist_resolved: colorist,
    next_version_number: nextVersion,
    would_insert,
    side_effects: {
      hot_folder: 'NONE — saves do not print',
      rip_jobs: 'NONE — saves do not enqueue',
      next_step: 'Colorist must explicitly POST /api/promote-to-strike-off { artwork_file_ids: [...] } to send to NeoStampa',
    },
  });
}
