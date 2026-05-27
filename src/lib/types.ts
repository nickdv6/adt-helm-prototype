// Type definitions matching the SQLite schema
// Keep in sync with src/db/schema.sql

export type Role =
  | 'admin'
  | 'csr'
  | 'sales'
  | 'colorist'
  | 'print_op'
  | 'finishing'
  | 'cut_sew'
  | 'inventory'
  | 'shipping'
  | 'accounting'
  | 'it_admin'
  | 'prod_mgr';

export interface User {
  id: number;
  email: string;
  full_name: string;
  primary_role: Role;
  is_active: 0 | 1;
  created_at: string;
}

export interface Company {
  id: number;
  name: string;
  industry: string | null;
  lifecycle_stage: string | null;
  payment_terms: string;
  is_credit_hold: 0 | 1;
  is_blind_ship_default: 0 | 1;
  is_third_party_billed: 0 | 1;
  carrier_account_number: string | null;
  carrier_account_carrier: string | null;
  primary_csr_user_id: number | null;
  sales_rep_user_id: number | null;
  hubspot_owner_email: string | null;
  is_legacy: 0 | 1;
  created_at: string;
}

export interface Contact {
  id: number;
  company_id: number;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  job_title: string | null;
  is_primary: 0 | 1;
}

export type OrderStatus =
  | 'Draft'
  | 'Submitted'
  | 'Waiting on Customer'
  | 'Waiting on Artwork'
  | 'Waiting on Approval'
  | 'Validated'
  | 'In Production'
  | 'Partially Complete'
  | 'Ready to Ship'
  | 'Partially Shipped'
  | 'Shipped'
  | 'Ready to Invoice'
  | 'Invoiced'
  | 'Closed'
  | 'Cancelled'
  | 'On Hold'
  | 'Return Requested'
  | 'Return Authorized'
  | 'Return Received'
  | 'Refunded';

export type StrikeOffClassification =
  | 'Customer Strike-Off Required'
  | 'Internal Strike-Off Required'
  | 'Strike-Off Not Required'
  | 'Previously Approved'
  | 'Waived by Agreement'
  | 'Pending Review';

export interface Order {
  id: number;
  order_number: string;
  company_id: number;
  primary_contact_id: number | null;
  ship_to_address_id: number | null;
  roadmap: 'R1' | 'R2' | 'R4' | 'R5' | 'R6' | 'R7' | 'R8';
  status: OrderStatus;
  customer_facing_status: string | null;
  customer_requested_date: string | null;
  adt_promised_date: string | null;
  po_number: string | null;
  source_system: string;
  primary_csr_user_id: number | null;
  subtotal: number | null;
  is_blind_ship: 0 | 1;
  is_rush: 0 | 1;
  approval_required: 0 | 1;
  trigger_reason: string | null;
  trigger_source: string | null;
  triggered_by_user_id: number | null;
  trigger_reason_code: string | null;
  hold_status: string | null;
  approval_requested_at: string | null;
  approval_completed_at: string | null;
  approved_by_user_id: number | null;
  approval_notes: string | null;
  override_reason: string | null;
  is_legacy: 0 | 1;
  created_at: string;
}

export interface OrderLine {
  id: number;
  order_id: number;
  sku_id: number;
  design_id: number | null;
  colorway_id: number | null;
  fabric_id: number | null;
  quantity: number;
  quantity_unit: string;
  unit_price: number | null;
  strike_off_classification: StrikeOffClassification;
  colorist_user_id: number | null;
  is_click_and_print: 0 | 1;
}

export interface PrintRequest {
  id: number;
  pr_number: string;
  order_line_id: number;
  artwork_file_id: number | null;
  printer_id: number | null;
  fabric_id: number | null;
  print_process: string | null;
  status: string;
  planned_yardage: number | null;
  printed_yardage: number | null;
  reprint_of_pr_id: number | null;
  reprint_reason_code: string | null;
  rip_recalled: 0 | 1;
  rip_recall_acknowledged_at: string | null;
  strike_off_classification: StrikeOffClassification | null;
  colorist_user_id: number | null;
  is_click_and_print: 0 | 1;
  was_csv_auto_routed: 0 | 1;
  internal_proof_status: 'not_required' | 'pending' | 'approved' | 'failed';
  internal_proof_requested_at: string | null;
  internal_proof_resolved_at: string | null;
  internal_proof_resolved_by_user_id: number | null;
  internal_proof_fail_reason: string | null;
  auto_prep_completed_at: string | null;
  hot_folder_target: string | null;
  scheduled_at: string | null;
  created_at: string;
}

export interface Notification {
  id: number;
  notification_code: string;
  recipient_user_id: number | null;
  recipient_role: string | null;
  channel: 'in_app' | 'email' | 'digest';
  subject: string;
  body: string | null;
  related_entity_type: string | null;
  related_entity_id: number | null;
  is_read: 0 | 1;
  created_at: string;
}
