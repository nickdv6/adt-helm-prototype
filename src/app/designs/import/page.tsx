// /designs/import — bulk import designs + colorways + artwork file links from CSV.
// Decisions baked in (per Nick, 2026-06-19):
//   1. file_path is a UNC NAS path. Validator requires \\server\… format. File is not copied; reference only.
//   2. If a design name already exists for this customer, the row errors. No silent merges.
//   3. PLANT# auto-generated per unique design_name in the CSV. Same name in two rows = same PLANT#.
import { getDb } from '@/lib/db';
import { ImportFlow } from './import-flow';

export const dynamic = 'force-dynamic';

export default function DesignImportPage() {
  const db = getDb();
  const companies = db.prepare(`
    SELECT id, name FROM companies ORDER BY name
  `).all() as { id: number; name: string }[];

  // Existing design names per customer — used for dup-detection in the browser without a round trip
  const existingDesigns = db.prepare(`
    SELECT company_id, LOWER(name) as name_lower
    FROM designs
  `).all() as { company_id: number; name_lower: string }[];

  // Group into { [company_id]: string[] } for client
  const existingByCustomer: Record<string, string[]> = {};
  existingDesigns.forEach((d) => {
    const key = String(d.company_id);
    if (!existingByCustomer[key]) existingByCustomer[key] = [];
    existingByCustomer[key].push(d.name_lower);
  });

  // Next PLANT# preview — derive year + last serial in DB
  const yr = new Date().getFullYear().toString().slice(-2);
  const lastPlant = db.prepare(`
    SELECT MAX(CAST(SUBSTR(plant_number, 5) AS INTEGER)) as max_serial
    FROM designs
    WHERE plant_number LIKE ?
  `).get(`P${yr}-%`) as { max_serial: number | null };
  const nextSerial = (lastPlant.max_serial ?? 1000) + 1;

  return (
    <ImportFlow
      companies={companies}
      existingByCustomer={existingByCustomer}
      nextPlantSerial={nextSerial}
      year={yr}
    />
  );
}
