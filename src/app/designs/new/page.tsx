// /designs/new — Create a single design with multiple colorways.
// Helm replacement for the DASH "Create Design" page with improvements:
//   - Auto-generated PLANT# preview (read-only) — pulled from next-available counter
//   - Per-colorway file upload (customer-supplied artwork) — DASH only had File Notes
//   - Design-level optional fields: description + repeat dimensions
//   - Clear required-field validation + Save-disabled until valid
//   - Remove-colorway button on each row (DASH was add-only)
//
// For bulk imports of many designs at once, use /designs/import (CSV).
import { getDb } from '@/lib/db';
import { CreateDesignForm } from './create-form';

export const dynamic = 'force-dynamic';

export default function NewDesignPage() {
  const db = getDb();
  const customers = db.prepare(`SELECT id, name FROM companies ORDER BY name`).all() as { id: number; name: string }[];

  // Compute next PLANT# preview (PYY-####), same logic as bulk import
  const yr = new Date().getFullYear().toString().slice(-2);
  const lastPlant = db.prepare(`
    SELECT MAX(CAST(SUBSTR(plant_number, 5) AS INTEGER)) as max_serial
    FROM designs
    WHERE plant_number LIKE ?
  `).get(`P${yr}-%`) as { max_serial: number | null };
  const nextSerial = (lastPlant.max_serial ?? 1000) + 1;
  const nextPlant = `P${yr}-${nextSerial}`;

  return <CreateDesignForm customers={customers} nextPlant={nextPlant} />;
}
