-- ADT Helm Prototype — SQLite schema
-- Matches the Data Model (Deliverable #4) with hybrid DASH extension framing
-- Entities are extended with all blueprint additions (Packaging Profile, open-bank Customer Material,
-- internal proof fields, missing-component override, approval gate fields, classification enum,
-- click-and-print flag, CSV/XML auto-route fields, internal proof status, etc.)
--
-- Per S23-S32.63 hybrid: an `is_legacy` flag separates active records from legacy records.
-- Pre-go-live rows would have is_legacy=1 in production. In this prototype, all seed data is active.

PRAGMA foreign_keys = ON;

-- ============================================================
-- USER + ROLE
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  primary_role TEXT NOT NULL, -- admin | csr | sales | colorist | print_op | finishing | cut_sew | inventory | shipping | accounting | it_admin | prod_mgr
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS user_roles (
  user_id INTEGER NOT NULL,
  role TEXT NOT NULL,
  PRIMARY KEY (user_id, role),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- ============================================================
-- CUSTOMER / COMPANY
-- ============================================================
CREATE TABLE IF NOT EXISTS companies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  industry TEXT,
  lifecycle_stage TEXT,
  payment_terms TEXT DEFAULT 'NET 30',
  is_credit_hold INTEGER NOT NULL DEFAULT 0,
  is_blind_ship_default INTEGER NOT NULL DEFAULT 0,
  is_third_party_billed INTEGER NOT NULL DEFAULT 0,
  carrier_account_number TEXT,
  carrier_account_carrier TEXT,
  primary_csr_user_id INTEGER,
  sales_rep_user_id INTEGER,
  hubspot_owner_email TEXT,
  is_legacy INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (primary_csr_user_id) REFERENCES users(id),
  FOREIGN KEY (sales_rep_user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS contacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  job_title TEXT,
  is_primary INTEGER NOT NULL DEFAULT 0,
  is_legacy INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (company_id) REFERENCES companies(id)
);

CREATE TABLE IF NOT EXISTS ship_to_addresses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  street1 TEXT NOT NULL,
  street2 TEXT,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  postal_code TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'USA',
  is_default INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (company_id) REFERENCES companies(id)
);

-- ============================================================
-- FABRIC + DESIGN + COLORWAY + SKU
-- ============================================================
CREATE TABLE IF NOT EXISTS fabrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  fiber_content TEXT,
  weight TEXT,
  width_inches REAL,
  default_print_profile_id INTEGER -- S23-S32.62 default profile for click-and-print
);

CREATE TABLE IF NOT EXISTS designs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  company_id INTEGER NOT NULL,
  plant_number TEXT NOT NULL UNIQUE, -- PYY-#### per reference_plant_number memory
  plant_year INTEGER NOT NULL,
  plant_sequence INTEGER NOT NULL,
  lifecycle_status TEXT NOT NULL DEFAULT 'Active', -- Active | Archived | Discontinued
  is_legacy INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (company_id) REFERENCES companies(id)
);

CREATE TABLE IF NOT EXISTS colorways (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  design_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  color_code TEXT,
  FOREIGN KEY (design_id) REFERENCES designs(id)
);

CREATE TABLE IF NOT EXISTS skus (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  adt_sku TEXT NOT NULL UNIQUE,
  product_type TEXT NOT NULL, -- yardage | pillow | curtain | tabletop | swatch | wallpaper | customer_owned
  fabric_id INTEGER,
  size TEXT,
  default_print_profile_id INTEGER,
  packaging_profile_id INTEGER, -- S23-S32.34 lookup by customer + product type
  lifecycle_status TEXT NOT NULL DEFAULT 'Active',
  is_legacy INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (fabric_id) REFERENCES fabrics(id)
);

CREATE TABLE IF NOT EXISTS sku_customer_mappings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sku_id INTEGER NOT NULL,
  company_id INTEGER NOT NULL,
  customer_sku TEXT NOT NULL, -- multi-customer per S33-S34.14
  FOREIGN KEY (sku_id) REFERENCES skus(id),
  FOREIGN KEY (company_id) REFERENCES companies(id)
);

-- ============================================================
-- PRINTER + PRINT PROFILE
-- ============================================================
CREATE TABLE IF NOT EXISTS printers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  model TEXT,
  ink_set TEXT NOT NULL, -- Fiber Reactive | Dye Sublimation | Pigment | Latex per Julio
  workstation_location TEXT,
  status TEXT NOT NULL DEFAULT 'idle', -- idle | running | maintenance
  throughput_yards_per_hour REAL,
  last_maintenance_at TEXT
);

CREATE TABLE IF NOT EXISTS print_profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL, -- PRINTER_FABRIC_INKSET_PROFILE_REF#_DATE per S23-S32.44
  fabric_id INTEGER NOT NULL,
  printer_id INTEGER NOT NULL,
  colorway_id INTEGER,
  ink_set TEXT NOT NULL,
  icc_profile_path TEXT,
  calibration_date TEXT,
  ref_number TEXT,
  status TEXT NOT NULL DEFAULT 'active', -- active | archived
  FOREIGN KEY (fabric_id) REFERENCES fabrics(id),
  FOREIGN KEY (printer_id) REFERENCES printers(id),
  FOREIGN KEY (colorway_id) REFERENCES colorways(id)
);

-- ============================================================
-- PACKAGING PROFILE (S40c + OD-7 — 22 baseline fields)
-- ============================================================
CREATE TABLE IF NOT EXISTS packaging_profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  company_id INTEGER NOT NULL,
  product_type TEXT NOT NULL,
  lifecycle_status TEXT NOT NULL DEFAULT 'Active', -- Active | Archived
  is_default_for_combo INTEGER NOT NULL DEFAULT 0,
  packaging_type TEXT NOT NULL, -- poly_bag | box | mailer | tube | roll | other
  insert_spec TEXT,
  label_spec TEXT,
  tag_spec TEXT,
  hangtag_spec TEXT,
  polybag_size TEXT,
  box_size TEXT,
  tube_size TEXT,
  fold_method TEXT,
  roll_method TEXT,
  fill_material TEXT,
  qty_per_package INTEGER,
  packing_instructions TEXT,
  customer_specific_notes TEXT,
  internal_notes TEXT,
  last_updated_by_user_id INTEGER,
  last_updated_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (company_id) REFERENCES companies(id),
  FOREIGN KEY (last_updated_by_user_id) REFERENCES users(id)
);

-- ============================================================
-- ARTWORK FILE
-- ============================================================
CREATE TABLE IF NOT EXISTS artwork_files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  design_id INTEGER NOT NULL,
  colorway_id INTEGER,
  version_number INTEGER NOT NULL DEFAULT 1,
  file_name TEXT NOT NULL, -- PLANT#_DESIGN_COLORWAY_VERSION per S23-S32.42
  nas_path TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Draft', -- Draft | Pending Approval | Approved | Archived
  is_original INTEGER NOT NULL DEFAULT 0, -- S23-S32.43 first upload flag; immutable
  date_received TEXT,
  submitted_by_user_id INTEGER,
  dpi INTEGER,
  color_profile TEXT,
  width_inches REAL,
  height_inches REAL,
  file_size_kb INTEGER,
  thumbnail_path TEXT,
  FOREIGN KEY (design_id) REFERENCES designs(id),
  FOREIGN KEY (colorway_id) REFERENCES colorways(id),
  FOREIGN KEY (submitted_by_user_id) REFERENCES users(id)
);

-- ============================================================
-- PRICING RULE
-- ============================================================
CREATE TABLE IF NOT EXISTS pricing_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL,
  sku_id INTEGER,
  unit_price REAL NOT NULL,
  effective_from TEXT,
  effective_to TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (company_id) REFERENCES companies(id),
  FOREIGN KEY (sku_id) REFERENCES skus(id)
);

-- ============================================================
-- ORDER (with OD-3 approval gate fields)
-- ============================================================
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_number TEXT NOT NULL UNIQUE,
  company_id INTEGER NOT NULL,
  primary_contact_id INTEGER,
  ship_to_address_id INTEGER,
  roadmap TEXT NOT NULL, -- R1 | R2 | R4 | R5 | R6 | R7 | R8
  status TEXT NOT NULL DEFAULT 'Draft', -- Order lifecycle per 6.6 + Megan E1
  customer_facing_status TEXT, -- 6-state per 6.5
  customer_requested_date TEXT,
  adt_promised_date TEXT,
  po_number TEXT,
  source_system TEXT NOT NULL DEFAULT 'manual', -- manual | shopify_advdigitaltextiles | shopify_fabricondemand | csv_import_st_frank | csv_import_inside | csv_import_lemieux | csv_import_laura_park | xml_import_fabric_megastore
  primary_csr_user_id INTEGER,
  subtotal REAL,
  is_blind_ship INTEGER NOT NULL DEFAULT 0,
  is_rush INTEGER NOT NULL DEFAULT 0,
  -- OD-3 + S23-S32.55 approval gate fields:
  approval_required INTEGER NOT NULL DEFAULT 0,
  trigger_reason TEXT, -- new_customer | new_artwork | rush | high_value | manual_flag | prior_issue (comma-separated if multiple)
  trigger_source TEXT, -- automated_rule | manual_flag
  triggered_by_user_id INTEGER,
  trigger_reason_code TEXT, -- manual flag reason code
  hold_status TEXT,
  approval_requested_at TEXT,
  approval_completed_at TEXT,
  approved_by_user_id INTEGER,
  approval_notes TEXT,
  override_reason TEXT,
  is_legacy INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (company_id) REFERENCES companies(id),
  FOREIGN KEY (primary_contact_id) REFERENCES contacts(id),
  FOREIGN KEY (ship_to_address_id) REFERENCES ship_to_addresses(id),
  FOREIGN KEY (primary_csr_user_id) REFERENCES users(id),
  FOREIGN KEY (approved_by_user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS order_lines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  sku_id INTEGER NOT NULL,
  design_id INTEGER,
  colorway_id INTEGER,
  fabric_id INTEGER,
  quantity REAL NOT NULL,
  quantity_unit TEXT NOT NULL DEFAULT 'yards',
  unit_price REAL,
  strike_off_classification TEXT NOT NULL DEFAULT 'Pending Review', -- OD-9 6-option enum
  colorist_user_id INTEGER,
  is_click_and_print INTEGER NOT NULL DEFAULT 0, -- S23-S32.62
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (sku_id) REFERENCES skus(id),
  FOREIGN KEY (design_id) REFERENCES designs(id),
  FOREIGN KEY (colorway_id) REFERENCES colorways(id),
  FOREIGN KEY (fabric_id) REFERENCES fabrics(id),
  FOREIGN KEY (colorist_user_id) REFERENCES users(id)
);

-- ============================================================
-- PRINT REQUEST (19 statuses incl. Pending Internal Proof)
-- ============================================================
CREATE TABLE IF NOT EXISTS print_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pr_number TEXT NOT NULL UNIQUE,
  order_line_id INTEGER NOT NULL,
  artwork_file_id INTEGER,
  printer_id INTEGER,
  fabric_id INTEGER,
  print_process TEXT, -- reactive | pigment | dye_sublimation | latex | direct_disperse | other_manual_review
  status TEXT NOT NULL DEFAULT 'Draft',
  planned_yardage REAL,
  printed_yardage REAL,
  reprint_of_pr_id INTEGER, -- recursive per 6.10
  reprint_reason_code TEXT,
  rip_recalled INTEGER NOT NULL DEFAULT 0,
  rip_recall_acknowledged_at TEXT,
  strike_off_classification TEXT, -- inherited from Order Line; editable
  colorist_user_id INTEGER,
  is_click_and_print INTEGER NOT NULL DEFAULT 0,
  was_csv_auto_routed INTEGER NOT NULL DEFAULT 0,
  -- S23-S32.60 internal proof fields:
  internal_proof_status TEXT NOT NULL DEFAULT 'not_required', -- not_required | pending | approved | failed
  internal_proof_requested_at TEXT,
  internal_proof_resolved_at TEXT,
  internal_proof_resolved_by_user_id INTEGER,
  internal_proof_fail_reason TEXT,
  auto_prep_completed_at TEXT,
  hot_folder_target TEXT,
  scheduled_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (order_line_id) REFERENCES order_lines(id),
  FOREIGN KEY (artwork_file_id) REFERENCES artwork_files(id),
  FOREIGN KEY (printer_id) REFERENCES printers(id),
  FOREIGN KEY (fabric_id) REFERENCES fabrics(id),
  FOREIGN KEY (reprint_of_pr_id) REFERENCES print_requests(id),
  FOREIGN KEY (colorist_user_id) REFERENCES users(id),
  FOREIGN KEY (internal_proof_resolved_by_user_id) REFERENCES users(id)
);

-- ============================================================
-- STRIKE-OFF (14 statuses incl. 'Approved with Changes')
-- ============================================================
CREATE TABLE IF NOT EXISTS strike_offs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  strike_off_number TEXT NOT NULL UNIQUE,
  print_request_id INTEGER NOT NULL,
  artwork_file_id INTEGER,
  status TEXT NOT NULL DEFAULT 'Requested',
  customer_decision_at TEXT,
  customer_decision_outcome TEXT, -- Approved | Approve with Changes | Rejected | Revision Required
  customer_change_notes TEXT,
  approval_token TEXT,
  approval_sent_at TEXT,
  FOREIGN KEY (print_request_id) REFERENCES print_requests(id),
  FOREIGN KEY (artwork_file_id) REFERENCES artwork_files(id)
);

-- ============================================================
-- FPR (Finished Product Request) + Cut/Sew Task
-- ============================================================
CREATE TABLE IF NOT EXISTS fprs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fpr_number TEXT NOT NULL UNIQUE,
  order_line_id INTEGER NOT NULL,
  print_request_id INTEGER,
  status TEXT NOT NULL DEFAULT 'Created',
  packaging_profile_override_id INTEGER, -- per-FPR override per S23-S32.34
  missing_component_override_json TEXT, -- S23-S32.33 reason code + actor + timestamp
  FOREIGN KEY (order_line_id) REFERENCES order_lines(id),
  FOREIGN KEY (print_request_id) REFERENCES print_requests(id),
  FOREIGN KEY (packaging_profile_override_id) REFERENCES packaging_profiles(id)
);

-- ============================================================
-- INVENTORY + CUSTOMER MATERIAL (per-PR + open-bank per Megan C1)
-- ============================================================
CREATE TABLE IF NOT EXISTS inventory_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_type TEXT NOT NULL, -- fabric | insert | label | tag | mailer | packaging
  fabric_id INTEGER,
  name TEXT NOT NULL,
  available_qty REAL NOT NULL DEFAULT 0,
  reserved_qty REAL NOT NULL DEFAULT 0,
  consumed_qty REAL NOT NULL DEFAULT 0,
  low_stock_threshold REAL NOT NULL DEFAULT 10,
  status TEXT NOT NULL DEFAULT 'Available',
  FOREIGN KEY (fabric_id) REFERENCES fabrics(id)
);

CREATE TABLE IF NOT EXISTS customer_materials (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL,
  material_type TEXT NOT NULL, -- per_pr | open_bank per S23-S32.50
  order_id INTEGER,
  print_request_id INTEGER,
  fabric_description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Awaiting Material',
  received_qty REAL NOT NULL DEFAULT 0,
  consumed_qty REAL NOT NULL DEFAULT 0,
  remaining_qty REAL NOT NULL DEFAULT 0,
  draw_history_json TEXT, -- open-bank: list of {order_id, pr_id, qty, drawn_at}
  inspection_notes TEXT,
  received_at TEXT,
  FOREIGN KEY (company_id) REFERENCES companies(id),
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (print_request_id) REFERENCES print_requests(id)
);

-- ============================================================
-- SHIPMENT (with 3rd-party billing per Megan B4)
-- ============================================================
CREATE TABLE IF NOT EXISTS shipments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shipment_number TEXT NOT NULL UNIQUE,
  order_id INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'Not Ready',
  carrier TEXT, -- UPS | FedEx | USPS
  tracking_number TEXT,
  is_third_party_billed INTEGER NOT NULL DEFAULT 0,
  customer_carrier_account TEXT,
  rated_cost REAL,
  actual_cost REAL,
  rated_at TEXT,
  shipped_at TEXT,
  FOREIGN KEY (order_id) REFERENCES orders(id)
);

-- ============================================================
-- NOTIFICATION (49 locked notifications per OD-4)
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  notification_code TEXT NOT NULL, -- N01..N49
  recipient_user_id INTEGER,
  recipient_role TEXT,
  channel TEXT NOT NULL, -- in_app | email | digest
  subject TEXT NOT NULL,
  body TEXT,
  related_entity_type TEXT,
  related_entity_id INTEGER,
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (recipient_user_id) REFERENCES users(id)
);

-- ============================================================
-- CSV/XML INTAKE CONFIG (S42b + S23-S32.61)
-- ============================================================
CREATE TABLE IF NOT EXISTS intake_configs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL,
  intake_mode TEXT NOT NULL, -- manual | email | sftp | watched_folder
  file_format TEXT NOT NULL, -- csv | xml
  auto_route_enabled INTEGER NOT NULL DEFAULT 0, -- S23-S32.61
  mapping_profile_json TEXT,
  source_path TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (company_id) REFERENCES companies(id)
);

CREATE TABLE IF NOT EXISTS intake_import_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  intake_config_id INTEGER NOT NULL,
  imported_at TEXT NOT NULL DEFAULT (datetime('now')),
  file_name TEXT,
  rows_total INTEGER,
  rows_succeeded INTEGER,
  rows_failed INTEGER,
  status TEXT NOT NULL DEFAULT 'pending',
  FOREIGN KEY (intake_config_id) REFERENCES intake_configs(id)
);

-- ============================================================
-- AUDIT
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL,
  entity_id INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  user_id INTEGER,
  payload_json TEXT,
  occurred_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_company ON orders(company_id);
CREATE INDEX IF NOT EXISTS idx_orders_csr ON orders(primary_csr_user_id);
CREATE INDEX IF NOT EXISTS idx_orders_legacy ON orders(is_legacy);
CREATE INDEX IF NOT EXISTS idx_prs_order_line ON print_requests(order_line_id);
CREATE INDEX IF NOT EXISTS idx_prs_status ON print_requests(status);
CREATE INDEX IF NOT EXISTS idx_designs_plant_number ON designs(plant_number);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_companies_legacy ON companies(is_legacy);
