// /fabrics/new — Create a fabric record. Mirrors the DASH "Create Fabric" page
// with improvements:
//   - Owner type toggle: Company-specific (requires Owner) vs ADT-common
//   - Composition section with 3 content rows + % auto-validates to sum=100
//   - Weight auto-converts between oz/yd² and g/m² (1 oz/yd² = 33.91 g/m²)
//   - Print Width defaults to Width − 2" (typical selvage)
//   - Wyzenbeek + Martindale inline help text
//   - Tech Sheet PDF preview button — shows what would render in the
//     standardized customer-facing tech sheet
//
// Reachable from: /fabrics + the "+" next to the Fabric selector on /orders/new.
import { getDb } from '@/lib/db';
import { CreateFabricForm } from './create-form';

export const dynamic = 'force-dynamic';

export default function NewFabricPage() {
  const db = getDb();
  const customers = db.prepare(`SELECT id, name FROM companies ORDER BY name`).all() as { id: number; name: string }[];
  return <CreateFabricForm customers={customers} />;
}
