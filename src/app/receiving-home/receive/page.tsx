// /receiving-home/receive — Receive Fabric intake form
// Captures a single inbound fabric delivery at the dock. Sample cut is required; the
// resulting swatch goes through two tests (department TBD): white-point measurement
// in CIE L*a*b* color space and an absorbency pass/fail.
//
// Tests can be entered at receipt time OR left blank for follow-up. The record's
// status is 'Awaiting Test' until both are filled in.
//
// Production schema additions needed: a material_receipts table with
//   id, owner_type (customer|adt), owner_company_id, supplier_mill_name, yardage,
//   roll_count, condition_notes, sample_cut_taken, po_reference,
//   white_point_L, white_point_a, white_point_b, absorbency (pass|fail|null),
//   tested_at, tested_by_user_id, received_at, received_by_user_id, status
import { getDb } from '@/lib/db';
import { ReceiveForm } from './receive-form';

export const dynamic = 'force-dynamic';

export default function ReceiveFabricPage() {
  const db = getDb();
  const customers = db.prepare(`SELECT id, name FROM companies ORDER BY name`).all() as { id: number; name: string }[];
  return <ReceiveForm customers={customers} />;
}
