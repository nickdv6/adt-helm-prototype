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
  -- Customer Automation Profile fields (Phase 1.11 minimum surface — full profile is Wave 2).
  -- These let the Strike-Off Decision Engine skip the strike entirely for pre-approved customer
  -- arrangements like St Frank's Click-and-Print. Without these flags, every new colorway
  -- forces a strike even when contractually unnecessary.
  skip_strike_for_new_colorways INTEGER NOT NULL DEFAULT 0,   -- e.g. St Frank: new colorway on existing design = direct to production
  skip_strike_for_reorders INTEGER NOT NULL DEFAULT 1,        -- Default: reorders skip strike if approved hash exists
  approval_freshness_days INTEGER NOT NULL DEFAULT 365,       -- Approved hashes expire after this many days → re-qualification required
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
  throughput_notes TEXT, -- Free-text for width-dependent throughput (e.g. Durst Alpha 330: 150 @ 126", 240 @ 62")
  last_maintenance_at TEXT,
  -- ICC profile version tracking (Phase 1.11) for the Strike-Off Decision Engine.
  -- When a strike is approved we snapshot the ICC version onto artwork_files.icc_profile_version_when_approved.
  -- When a reorder comes in, the decision engine compares this current value to the approved snapshot.
  -- Mismatch = re-qualification strike-off required (substrate may render differently under a new ICC).
  current_icc_profile_version TEXT,
  icc_profile_updated_at TEXT
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
  -- Hash-locked promotion workflow (Phase 1.11). The SHA256 of the file bytes
  -- is the canonical identifier — filenames lie, hashes don't. Agent watcher
  -- captures this on every save event so version history is automatic.
  file_hash TEXT,                              -- SHA256 hex of the file bytes; cryptographic guarantee of identity
  working_path TEXT,                           -- Where the colorist saved it during work, before promotion (vs nas_path = canonical archive)
  colorist_user_id INTEGER,                    -- Which colorist saved this version (from filesystem owner / NeoStampa session)
  comment TEXT,                                -- Colorist note (e.g. "tightened repeat 0.5cm" or "tweaked navy on channel 3")
  is_strike_off_candidate INTEGER NOT NULL DEFAULT 0,  -- Colorist clicked "Submit for Strike-Off" on this row
  promoted_at TEXT,                            -- When it was submitted as a strike-off candidate
  approved_at TEXT,                            -- When customer approved the strike-off that printed this hash
  approved_by_strike_off_id INTEGER,           -- Which strike-off approval bound this hash
  FOREIGN KEY (design_id) REFERENCES designs(id),
  FOREIGN KEY (colorway_id) REFERENCES colorways(id),
  FOREIGN KEY (submitted_by_user_id) REFERENCES users(id),
  FOREIGN KEY (colorist_user_id) REFERENCES users(id),
  FOREIGN KEY (approved_by_strike_off_id) REFERENCES strike_offs(id)
);
CREATE INDEX IF NOT EXISTS idx_artwork_files_design ON artwork_files(design_id, colorway_id);
CREATE INDEX IF NOT EXISTS idx_artwork_files_hash ON artwork_files(file_hash);

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
  status TEXT NOT NULL DEFAULT 'Draft',
  -- values: Draft | Validated | Waiting on Approval | Approved | In Production | Partially Complete | Ready to Ship | Shipped | Invoiced | Closed | On Hold | Cancelled
  -- See 6.6 + Megan E1 for transition rules. 'Ready to Ship' is reached when all PRs are Complete and all rolls packed (filter on /shipping).
  customer_facing_status TEXT,
  -- values (customer-facing 6-state per 6.5): Received | In Production | Ready to Ship | Shipped | Delivered | Cancelled
  customer_requested_date TEXT,
  estimated_ship_date TEXT,  -- Set at order entry. Provisional / internal estimate, no promise to the customer yet.
  adt_promised_date TEXT,    -- Set only when the order is approved (internally or by the customer). This is the
                             -- commitment the customer hears about. ADT does not promise a date until approval.
                             -- Late-flag logic must use this column, NEVER estimated_ship_date.
  po_number TEXT,
  source_system TEXT NOT NULL DEFAULT 'manual', -- manual | shopify_advdigitaltextiles | shopify_fabricondemand | csv_import_st_frank | csv_import_inside | csv_import_lemieux | csv_import_laura_park | xml_import_fabric_megastore
  primary_csr_user_id INTEGER,
  assigned_to_user_id INTEGER, -- Currently responsible owner (may be reassigned through lifecycle). Drives 'Assigned To' filter on dashboards.
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
  -- Customer VPN + master-SKU mapping (drives Insert Requirement + CUT label content)
  vpn TEXT,                                       -- Customer's product code as it appears in the daily CSV/XML
  product_type_from_master TEXT,                  -- Resolved via master_skus join (e.g. 'PIL_22x22_OUT', 'NAPKIN_20x20')
  insert_required TEXT,                           -- e.g. '26x26-NW'. NULL when product type has no insert (non-pillow).
  master_sku_mapping_status TEXT DEFAULT 'no_vpn',-- 'mapped' | 'unmapped' (VPN exists but not in master) | 'no_vpn'
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (sku_id) REFERENCES skus(id),
  FOREIGN KEY (design_id) REFERENCES designs(id),
  FOREIGN KEY (colorway_id) REFERENCES colorways(id),
  FOREIGN KEY (fabric_id) REFERENCES fabrics(id),
  FOREIGN KEY (colorist_user_id) REFERENCES users(id)
);

-- ============================================================
-- MASTER SKU table — customer VPN → ADT product type mapping
-- ============================================================
-- One row per customer VPN. product_type drives Insert Requirement via the static
-- insert-mapping module in src/lib/insert-mapping.ts. insert_key is denormalized here
-- so query-time lookups don't need to recompute. Refreshed on master SKU import.
CREATE TABLE IF NOT EXISTS master_skus (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  vpn TEXT NOT NULL UNIQUE,
  product_type TEXT NOT NULL,                     -- e.g. 'PIL_22x22_OUT', 'NAPKIN_20x20', 'TABLE_RUNNER_72'
  insert_key TEXT,                                -- e.g. '26x26-NW'. NULL when product_type has no insert.
  customer_id INTEGER,                            -- optional: some VPNs may be customer-specific
  notes TEXT,
  last_updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (customer_id) REFERENCES companies(id)
);
CREATE INDEX IF NOT EXISTS idx_master_skus_vpn ON master_skus(vpn);

-- ============================================================
-- CUT LABELS — printed by Zebra ZT400 at the CUT station
-- ============================================================
-- One row per label printed. QR payload + display text snapshot kept for audit.
CREATE TABLE IF NOT EXISTS cut_labels (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_line_id INTEGER NOT NULL,
  pr_id INTEGER,                                  -- nullable: label can be printed even if PR not yet created
  printed_at TEXT NOT NULL DEFAULT (datetime('now')),
  printer_name TEXT,                              -- e.g. 'Zebra ZT400 · CUT Station A'
  operator_user_id INTEGER,
  print_status TEXT NOT NULL DEFAULT 'printed',   -- 'printed' | 'failed' | 'reprinted'
  reprint_count INTEGER NOT NULL DEFAULT 0,
  qr_payload TEXT NOT NULL,                       -- Same payload as Traveler QR (lookup key)
  display_text_json TEXT,                         -- Snapshot of PO#, VPN, Qty, Insert/NO INSERT for audit
  FOREIGN KEY (order_line_id) REFERENCES order_lines(id),
  FOREIGN KEY (pr_id) REFERENCES print_requests(id),
  FOREIGN KEY (operator_user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_cut_labels_pr_id ON cut_labels(pr_id);

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
  -- values: Draft | Pending Profile | Pending Approval | Approved | Ready for Scheduling | Scheduled | Printing | Printed | Pending Internal Proof | On Hold | Issue — Contact Us | Complete | Cancelled
  -- 'Open PR' across dashboards = status NOT IN ('Complete', 'Cancelled').
  planned_yardage REAL,
  printed_yardage REAL,
  reprint_of_pr_id INTEGER, -- recursive per 6.10
  reprint_reason_code TEXT,
  rip_recalled INTEGER NOT NULL DEFAULT 0,
  rip_recall_acknowledged_at TEXT,
  assigned_to_user_id INTEGER, -- Currently responsible owner (colorist / print op / etc.). Drives 'Assigned To' filter on dashboards.
  -- Traveler Compositing Engine fields (S35-Traveler):
  -- The Traveler QR is the small QR printed BELOW the artwork on each print. The QR payload
  -- is the lookup key (PO#/order id today, extensible to PR# / line id / customer / VPN / fabric).
  -- The Traveler Compositing Engine produces a composite file = original artwork + Traveler QR +
  -- human-readable metadata strip, then routes the composite to the printer's hot folder.
  traveler_qr_payload TEXT,                          -- Lookup key encoded in the QR (typically order_id or PO#)
  traveler_composite_status TEXT NOT NULL DEFAULT 'not_required', -- 'not_required' | 'pending' | 'generated' | 'failed'
  traveler_composite_file_path TEXT,                 -- UNC path to the composite PRN/TIFF/PDF
  composite_generated_at TEXT,
  composite_error TEXT,                              -- Free-text on failure ('missing artwork', 'QR encode failed', etc.)
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
  -- NeoStampa Sync / RIP lifecycle (Phase 1 build): an explicit RIP job wraps
  -- the existing composite step + adds NeoStampa hot-folder submission, agent
  -- monitoring, and a 12-state lifecycle. external_job_name is the deterministic
  -- name that follows the job through NeoStampa and back: CUSTOMER_PR-#_FO-#_DESIGN_COLORWAY_yyYD.
  external_job_name TEXT,
  fabric_output_id INTEGER,                          -- Parent QR record (one printed run = one FabricOutput)
  current_rip_job_id INTEGER,                        -- The active/latest RipJob for this PR
  -- The canonical artwork file the dispatcher uses when generating the XML.
  -- Set when a strike-off is approved (hash-locked to the version the customer
  -- signed off on) or when the colorist promotes a draft direct to production.
  -- Helm-side dispatcher uses artwork_files.nas_path for this id, not "the most recent file".
  production_artwork_file_id INTEGER,
  rip_status TEXT NOT NULL DEFAULT 'not_started',
  -- 12-state RIP lifecycle, DENORMALIZED from rip_jobs.status for fast dashboard queries.
  -- DO NOT WRITE TO THIS DIRECTLY — rip_jobs.status is source of truth; updates flow through /api/rip-events.
  -- values: not_started | ready_for_rip | package_created | submitted | accepted | ripping | rip_complete | queued_for_print | printing | print_complete_software | print_complete_qr | error | held
  rip_retry_count INTEGER NOT NULL DEFAULT 0,
  rip_last_event_at TEXT,
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
-- HOT FOLDERS — registry of NeoStampa hot folders per printer
-- ============================================================
-- One row per hot folder. Multiple hot folders may exist per printer if
-- the RIP machine watches more than one path (e.g. RUSH vs STANDARD).
CREATE TABLE IF NOT EXISTS hot_folders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  printer_id INTEGER NOT NULL,
  name TEXT NOT NULL,                                -- e.g. 'Durst-Alpha-STANDARD'
  unc_path TEXT NOT NULL,                            -- e.g. '\\rip-bay-a\hotfolder\durst\standard\'
  is_active INTEGER NOT NULL DEFAULT 1,
  neostampa_agent_id INTEGER,                        -- which agent watches this folder
  is_rush_lane INTEGER NOT NULL DEFAULT 0,
  -- Vendor abstraction: which RIP product this hot folder feeds. Today: 'inedit_neostampa'.
  -- Future adapters could target 'efi_fiery' | 'colorgate' | 'caldera' | 'inhouse_rip'.
  -- The dispatcher dispatches via the adapter matching this value — so swapping vendors
  -- on a single printer is a config change, not a code change.
  rip_target TEXT NOT NULL DEFAULT 'inedit_neostampa',
  FOREIGN KEY (printer_id) REFERENCES printers(id)
);

-- ============================================================
-- NEOSTAMPA SYNC AGENTS — simulated local services on RIP machines
-- ============================================================
-- One per RIP computer. Sends heartbeats, monitors hot folders, reports
-- NeoStampa events back to Helm. Used by the IT Admin agent panel.
CREATE TABLE IF NOT EXISTS neostampa_agents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,                                -- e.g. 'RIP-Bay-A'
  hostname TEXT NOT NULL,                            -- e.g. 'rip-bay-a.adt.local'
  version TEXT NOT NULL DEFAULT '1.0.0',
  status TEXT NOT NULL DEFAULT 'online',             -- 'online' | 'offline' | 'degraded' | 'updating'
  last_heartbeat_at TEXT,
  uptime_seconds INTEGER NOT NULL DEFAULT 0,
  jobs_processed_today INTEGER NOT NULL DEFAULT 0,
  jobs_failed_today INTEGER NOT NULL DEFAULT 0,
  neostampa_version TEXT,                            -- e.g. 'NeoStampa 11.2'
  notes TEXT
);

-- ============================================================
-- FABRIC OUTPUTS — the QR-tagged piece of printed fabric
-- ============================================================
-- The "first tier" QR record. One per printed run (typically 1:1 with a
-- successful PR). Survives through finishing, cut, and bundling.
CREATE TABLE IF NOT EXISTS fabric_outputs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  qr_payload TEXT NOT NULL UNIQUE,                   -- e.g. 'FO-98321'
  print_request_id INTEGER NOT NULL,
  generated_at TEXT NOT NULL DEFAULT (datetime('now')),
  yards_produced REAL,                               -- Actual printed yardage
  status TEXT NOT NULL DEFAULT 'pending_print',      -- 'pending_print' | 'printed' | 'finishing' | 'cut' | 'bundled' | 'shipped'
  FOREIGN KEY (print_request_id) REFERENCES print_requests(id)
);

-- ============================================================
-- RIP JOBS — NeoStampa lifecycle wrapper around the composite step
-- ============================================================
-- A RipJob is created when a PR is ready for RIP. It moves through 12
-- statuses, with events captured in rip_job_events. The same PR may have
-- multiple RipJobs over its lifetime if reprocessed.
CREATE TABLE IF NOT EXISTS rip_jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  -- print_request_id is NULLABLE: many jobs originate in the NeoStampa Canvas GUI (a
  -- colorist opens a file, makes adjustments, clicks print) and reach Helm via the
  -- agent BEFORE they're bound to a Helm PR. Those rows sit in the Reconciliation
  -- Queue until an operator binds them (manual_associate event) or auto-match succeeds.
  print_request_id INTEGER,
  -- origin tracks who started the job. 'helm' = Helm minted the external_job_name +
  -- wrote XML to the hot folder. 'neostampa_gui' = colorist started it in the Canvas;
  -- agent observed it via log-tail / hot-folder watch and reported it back.
  origin TEXT NOT NULL DEFAULT 'helm',                -- 'helm' | 'neostampa_gui' | 'unknown'
  -- NeoStampa's internal job ID (e.g. nS_job_a3f9c2). Helm doesn't control this —
  -- it's the agent's way of disambiguating between simultaneous Canvas jobs.
  neostampa_job_id TEXT,
  fabric_output_id INTEGER,
  external_job_name TEXT NOT NULL UNIQUE,            -- For Helm-originated: CUSTOMER_PR-#_FO-#_DESIGN_COLORWAY_yyYD. For Canvas-originated: the artwork filename the colorist saved.
  status TEXT NOT NULL DEFAULT 'ready_for_rip',
  -- 12-state RIP flow (source of truth — print_requests.rip_status mirrors this):
  -- not_started | ready_for_rip | package_created | submitted | accepted | ripping | rip_complete | queued_for_print | printing | print_complete_software | print_complete_qr | error | held
  hot_folder_id INTEGER,
  neostampa_agent_id INTEGER,
  package_path TEXT,                                 -- UNC to the composite package
  retry_count INTEGER NOT NULL DEFAULT 0,
  is_held INTEGER NOT NULL DEFAULT 0,
  hold_reason TEXT,
  error_message TEXT,
  -- Auto-match confidence score (0-100). 0 = no PR bound. >70 = high-confidence
  -- auto-match (filename contained PR-#). 30-70 = suggestion only, manual review.
  auto_match_score INTEGER NOT NULL DEFAULT 0,
  reconciliation_status TEXT NOT NULL DEFAULT 'attributed',  -- 'attributed' | 'awaiting_review' | 'auto_matched' | 'manual_associated' | 'flagged_no_pr'
  -- Which RIP spec version this job's XML was built against. Pinned per-row
  -- so we can detect drift when an Inèdit version upgrade rolls out.
  -- Today: '4.23.0'. When 5.0 ships, new jobs get built against the new spec
  -- but in-flight 4.23.0 jobs continue under their original spec.
  xml_spec_version TEXT,
  submitted_at TEXT,
  accepted_at TEXT,
  rip_started_at TEXT,
  rip_completed_at TEXT,
  print_started_at TEXT,
  print_completed_software_at TEXT,
  print_completed_qr_at TEXT,                        -- Confirmed by physical QR scan (truth)
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (print_request_id) REFERENCES print_requests(id),
  FOREIGN KEY (fabric_output_id) REFERENCES fabric_outputs(id),
  FOREIGN KEY (hot_folder_id) REFERENCES hot_folders(id),
  FOREIGN KEY (neostampa_agent_id) REFERENCES neostampa_agents(id)
);
CREATE INDEX IF NOT EXISTS idx_rip_jobs_pr_id ON rip_jobs(print_request_id);
CREATE INDEX IF NOT EXISTS idx_rip_jobs_status ON rip_jobs(status);

-- ============================================================
-- RIP JOB EVENTS — append-only event log for each RipJob
-- ============================================================
-- Captures every state change + retry + manual override + error. Drives
-- the RIP Activity timeline on PR Detail and the Auto-RIP Engine panel
-- on the Intake Command Center.
CREATE TABLE IF NOT EXISTS rip_job_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rip_job_id INTEGER NOT NULL,
  event_type TEXT NOT NULL,                          -- 'package_created' | 'submitted' | 'accepted' | 'rip_started' | 'rip_completed' | 'print_started' | 'print_completed_software' | 'print_completed_qr' | 'error' | 'retried' | 'held' | 'released' | 'manual_override'
  event_at TEXT NOT NULL DEFAULT (datetime('now')),
  source TEXT NOT NULL DEFAULT 'agent',              -- 'agent' | 'manual' | 'system'
  user_id INTEGER,                                   -- Set on manual events
  details TEXT,                                      -- Free-text or JSON payload
  FOREIGN KEY (rip_job_id) REFERENCES rip_jobs(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_rip_job_events_job_id ON rip_job_events(rip_job_id);

-- ============================================================
-- PR ROLLS — each row is one physical roll cut from a PR's printed yardage
-- ============================================================
-- A single PR may yield multiple rolls (overage/underage normal). Rolls are
-- ONLY created at pack-out time, not at print time. Roll numbers are surfaced
-- only on the Shipping page + roll registry + packing-correction UI.
CREATE TABLE IF NOT EXISTS pr_rolls (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pr_id INTEGER NOT NULL,
  roll_number TEXT NOT NULL UNIQUE,
  yards REAL NOT NULL,
  packed_at TEXT,
  packed_by_user_id INTEGER,
  ship_status TEXT NOT NULL DEFAULT 'packed', -- packed | shipped
  shipped_at TEXT,
  shipment_id INTEGER,                        -- back-ref to the shipment that took this roll out the door
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (pr_id) REFERENCES print_requests(id),
  FOREIGN KEY (packed_by_user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_pr_rolls_pr_id ON pr_rolls(pr_id);
CREATE INDEX IF NOT EXISTS idx_pr_rolls_roll_number ON pr_rolls(roll_number);

-- ============================================================
-- STRIKE-OFF (14 statuses incl. 'Approved with Changes')
-- ============================================================
CREATE TABLE IF NOT EXISTS strike_offs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  strike_off_number TEXT NOT NULL UNIQUE,
  print_request_id INTEGER NOT NULL,
  artwork_file_id INTEGER,
  status TEXT NOT NULL DEFAULT 'Requested',
  -- 14 values: Requested | In Queue | In Color Matching | Printing | Quality Check | Awaiting Approval | Customer Reviewing | Approved | Approve with Changes | Rejected | Revision Required | On Hold | Cancelled | Closed
  -- Source: hardcoded STATUS_COLORS map in /strike-offs page. Should be lifted to a shared constant in src/lib.
  customer_decision_at TEXT,
  customer_decision_outcome TEXT, -- Approved | Approve with Changes | Rejected | Revision Required
  customer_change_notes TEXT,
  approval_token TEXT,
  approval_sent_at TEXT,
  -- Phase 1.11 hash-locked workflow.
  -- change_severity disambiguates "Approve with Changes" — minor tweaks go DIRECT to production
  -- with a new hash; substantive changes trigger a new strike-off cycle. Without this field,
  -- every "Approve with Changes" forces a redundant strike-off even for 2-shade navy tweaks.
  change_severity TEXT,                            -- NULL | minor_color_tweak | substantive_change
  -- Multi-variant comparison strike-off: colorist promotes 2-4 versions on one print run so
  -- customer can pick the winner. variant_artwork_file_ids is a JSON array of artwork_files.id
  -- in the order they appear on the printed fabric. is_multi_variant=1 with 2+ ids.
  is_multi_variant INTEGER NOT NULL DEFAULT 0,
  variant_artwork_file_ids TEXT,                   -- JSON array, e.g. [421, 422, 423]
  variant_winner_artwork_file_id INTEGER,          -- After customer picks, which variant won
  -- ICC snapshot at the time of approval (Phase 1.11). Used by the decision engine to detect
  -- "ICC drift" — if the printer's current ICC differs from this snapshot, re-qualification
  -- strike-off is required even though the design+colorway was previously approved.
  icc_profile_version_at_approval TEXT,
  printer_id_at_approval INTEGER,                  -- The printer the strike was run on (must match production printer)
  FOREIGN KEY (print_request_id) REFERENCES print_requests(id),
  FOREIGN KEY (artwork_file_id) REFERENCES artwork_files(id),
  FOREIGN KEY (variant_winner_artwork_file_id) REFERENCES artwork_files(id),
  FOREIGN KEY (printer_id_at_approval) REFERENCES printers(id)
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
  -- values: Created | Awaiting Material | Awaiting Cut | Cutting | Cut Complete | Awaiting Sew | Sewing | Awaiting QC | QC Passed | Ready to Ship | Shipped | Cancelled
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
  -- values: Available | LowStock | OutOfStock | Allocated | Discontinued
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
  -- values: Awaiting Material | Received | Inspected | In Use | Depleted | Discarded
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
  -- values: Not Ready | Ready to Pack | Packed | Label Printed | Picked Up | In Transit | Delivered | Returned | Cancelled
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
  status TEXT NOT NULL DEFAULT 'pending', -- values: pending | running | succeeded | partial | failed
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
