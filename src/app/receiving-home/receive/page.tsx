// /receiving-home/receive — Receive Fabric intake form
// Captures a single inbound fabric delivery at the dock. Routes the receipt to
// Studio (for white-point measurement) or Finishing (for pretreatment / absorbency
// check) based on Tomás's call. Sample cut is a required step before any routing.
//
// Production schema additions needed: a material_receipts table with
//   id, owner_type (customer|adt), owner_company_id, supplier_mill_name, yardage,
//   roll_count, condition_notes, sample_cut_taken, sample_routed_to (studio|finishing),
//   po_reference, received_at, received_by_user_id, status
import { getDb } from '@/lib/db';
import { ReceiveForm } from './receive-form';

export const dynamic = 'force-dynamic';

export default function ReceiveFabricPage() {
  const db = getDb();
  const customers = db.prepare(`SELECT id, name FROM companies ORDER BY name`).all() as { id: number; name: string }[];
  return <ReceiveForm customers={customers} />;
}
