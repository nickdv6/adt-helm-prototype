import Link from 'next/link';
import { Card, CardHeader, Tag } from '@/components/ui';

// /customer-configs — Customer Configuration deep-detail view
// Per Wave 1 Core Scope C2 (broadened Customer Profile): the single place ADT configures
// EVERYTHING specific to how a given customer's work is intaken, produced, packaged, shipped,
// and billed. Per Nick: this page exists so reviewers can see how Helm understands the
// CSV/XML intake setup + the routing guide + the SKU mapping per customer — not just the
// thin listing shown at /intake.
//
// One detailed config per Wave 1 CSV/XML customer (St. Frank, Inside/Havenly, Laura Park,
// House of MBR, Lemieux Et Cie). Tab selector at top, deep detail below.

type FieldMap = { customer_col: string; helm_field: string; notes?: string };
type SKUMap = { customer_sku: string; adt_sku: string; design: string; colorway: string; fabric: string };
type RecentImport = { date: string; rows: number; pr_created: number; failed: number };
type LabelMode = 'A' | 'B' | 'C';

type CustomerConfig = {
  name: string;
  slug: string;
  tags: string[];
  intake: {
    source: string;
    method: string;
    schedule: string;
    file_format: string;
    file_naming: string;
    auto_route: boolean;
    recent_imports: RecentImport[];
    field_mapping: FieldMap[];
    sample_row: Record<string, string>;
    sample_output: { pr_number: string; sku: string; fabric: string; design: string; qty: number; unit: string }[];
  };
  routing_guide: {
    nas_root: string;
    folder_convention: string;
    strike_off_rule: string;
    strike_off_approval: string;
    hot_folder_destination: string;
  };
  sku_mapping: SKUMap[];
  fulfillment: {
    method: string;
    label_mode?: LabelMode;
    label_mode_note?: string;
  };
  packaging: { product_type: string; profile: string; notes?: string }[];
  shipping: {
    preferred_carrier: string;
    service_level: string;
    blind_ship_default: boolean;
    third_party_billed: boolean;
    carrier_account?: { carrier: string; masked_account: string };
  };
  billing: {
    credit_hold: boolean;
    payment_terms: string;
    overage_policy: string;
    overage_tolerance_pct: number;
    pricing_variance_threshold: string;
    po_required: boolean;
    invoice_routing: string;
  };
  production_requirements: { kind: string; value: string }[];
  credentials: { kind: string; value: string }[];
};

// =====================================================================
// Mock data: 5 Wave 1 CSV/XML customers per C10
// =====================================================================

const CONFIGS: CustomerConfig[] = [
  // --------------- ST. FRANK ---------------
  {
    name: 'St. Frank',
    slug: 'stfrank',
    tags: ['CSV intake', 'SFTP drop', 'Direct-to-customer fulfillment'],
    intake: {
      source: 'CSV file feed (customer-pushed)',
      method: 'SFTP drop — St. Frank pushes to ADT SFTP path',
      schedule: 'Watcher polls every 15 min (07:00–19:00 PT, M-F)',
      file_format: 'CSV (UTF-8, comma-delimited, header row)',
      file_naming: 'stfrank_po_YYYYMMDD_HHMM.csv',
      auto_route: true,
      recent_imports: [
        { date: '2026-06-18 08:15 PT', rows: 14, pr_created: 14, failed: 0 },
        { date: '2026-06-17 16:30 PT', rows: 9, pr_created: 9, failed: 0 },
        { date: '2026-06-17 08:15 PT', rows: 22, pr_created: 21, failed: 1 },
        { date: '2026-06-16 14:45 PT', rows: 6, pr_created: 6, failed: 0 },
        { date: '2026-06-16 08:15 PT', rows: 11, pr_created: 11, failed: 0 },
      ],
      field_mapping: [
        { customer_col: 'po_number',           helm_field: 'Order.po_number' },
        { customer_col: 'customer_sku',        helm_field: 'PR.sku_id (via SKU mapping)' },
        { customer_col: 'design_code',         helm_field: 'PR.design_id (lookup)' },
        { customer_col: 'colorway_code',       helm_field: 'PR.colorway_id (lookup)' },
        { customer_col: 'qty_yards',           helm_field: 'PR.planned_yardage' },
        { customer_col: 'requested_ship_date', helm_field: 'Order.customer_requested_date' },
        { customer_col: 'ship_to_name',        helm_field: 'ShipToAddress.name' },
        { customer_col: 'ship_to_addr_1',      helm_field: 'ShipToAddress.line1' },
        { customer_col: 'ship_to_addr_2',      helm_field: 'ShipToAddress.line2' },
        { customer_col: 'ship_to_city',        helm_field: 'ShipToAddress.city' },
        { customer_col: 'ship_to_state',       helm_field: 'ShipToAddress.state' },
        { customer_col: 'ship_to_zip',         helm_field: 'ShipToAddress.zip' },
        { customer_col: 'notes',               helm_field: 'Order.notes (free-text)', notes: 'Carried through but not used for routing' },
      ],
      sample_row: {
        po_number: 'SF-44291',
        customer_sku: 'SF-CYP-Y15',
        design_code: 'CYP',
        colorway_code: 'IND',
        qty_yards: '15',
        requested_ship_date: '2026-06-26',
        ship_to_name: 'St. Frank Distribution',
        ship_to_addr_1: '440 Brannan St',
        ship_to_city: 'San Francisco',
        ship_to_state: 'CA',
        ship_to_zip: '94107',
        notes: 'Standard',
      },
      sample_output: [
        { pr_number: 'PR-12091', sku: 'CYP-IND-Yardage', fabric: 'Cotton Sateen 110-thread', design: 'Cypress / Indigo', qty: 15, unit: 'yards' },
      ],
    },
    routing_guide: {
      nas_root: '\\\\adt-nas\\artwork\\stfrank',
      folder_convention: '{design_code}/{colorway_code}/_production-ready/*.tif',
      strike_off_rule: 'First-run only — strike-off required only when this Design+Colorway+Fabric has never been produced before',
      strike_off_approval: 'Internal only (Jeannine reviews; no customer email approval)',
      hot_folder_destination: 'Route to MS JP4 hot folder (Cotton Sateen jobs)',
    },
    sku_mapping: [
      { customer_sku: 'SF-CYP-Y15', adt_sku: 'CYP-IND-Yardage',  design: 'Cypress',  colorway: 'Indigo',  fabric: 'Cotton Sateen 110-thread' },
      { customer_sku: 'SF-CYP-Y30', adt_sku: 'CYP-IND-Yardage',  design: 'Cypress',  colorway: 'Indigo',  fabric: 'Cotton Sateen 110-thread' },
      { customer_sku: 'SF-MAR-Y15', adt_sku: 'MAR-WHT-Yardage',  design: 'Marigold', colorway: 'White',   fabric: 'Linen Blend Natural' },
      { customer_sku: 'SF-MAR-Y30', adt_sku: 'MAR-WHT-Yardage',  design: 'Marigold', colorway: 'White',   fabric: 'Linen Blend Natural' },
      { customer_sku: 'SF-COR-Y15', adt_sku: 'COR-PINK-Yardage', design: 'Coral',    colorway: 'Pink',    fabric: 'Cotton Sateen 90-thread' },
    ],
    fulfillment: {
      method: 'Direct-to-customer (production order ships to customer warehouse, no stored inventory)',
    },
    packaging: [
      { product_type: 'Yardage roll', profile: 'St. Frank Standard Roll Pack', notes: 'Kraft paper wrap + ADT roll-end label' },
    ],
    shipping: {
      preferred_carrier: 'UPS',
      service_level: 'Ground',
      blind_ship_default: false,
      third_party_billed: false,
    },
    billing: {
      credit_hold: false,
      payment_terms: 'Net 30',
      overage_policy: 'Accepted up to tolerance',
      overage_tolerance_pct: 5,
      pricing_variance_threshold: 'Admin-configured · alerts Megan on variance over threshold',
      po_required: true,
      invoice_routing: 'ap@stfrank.example (auto on Shipped)',
    },
    production_requirements: [
      { kind: 'Fabric restrictions', value: 'Cotton Sateen 110-thread preferred; Linen Blend Natural acceptable' },
      { kind: 'Inspection threshold', value: 'Standard (Pass / Pass with Notes / Fail)' },
      { kind: 'Finishing', value: 'None (yardage only)' },
    ],
    credentials: [
      { kind: 'SFTP', value: 'sftp.adt.example · user=stfrank_push · key=★★★★★★★★ (rotated 2026-04-12)' },
    ],
  },

  // --------------- INSIDE / HAVENLY ---------------
  {
    name: 'Inside / Havenly',
    slug: 'inside-havenly',
    tags: ['Shopify intake', 'Stored inventory', 'Label mode A', 'Blind ship'],
    intake: {
      source: 'Shopify packing-list email (customer forwards from Shopify)',
      method: 'Helm parses inbound email to fulfillment@adt.example',
      schedule: 'Real-time (on email receipt)',
      file_format: 'HTML email body (Helm extracts order # + line items)',
      file_naming: 'N/A (email-driven, not file-driven)',
      auto_route: true,
      recent_imports: [
        { date: '2026-06-18 09:42 PT', rows: 1, pr_created: 0, failed: 0 },
        { date: '2026-06-18 09:14 PT', rows: 1, pr_created: 0, failed: 0 },
        { date: '2026-06-18 08:51 PT', rows: 2, pr_created: 0, failed: 0 },
        { date: '2026-06-17 19:08 PT', rows: 1, pr_created: 0, failed: 0 },
        { date: '2026-06-17 17:33 PT', rows: 1, pr_created: 0, failed: 0 },
      ],
      field_mapping: [
        { customer_col: 'shopify_order_id',  helm_field: 'FulfillmentRequest.source_id', notes: 'C22 entity, not a Production Order' },
        { customer_col: 'shopify_sku',       helm_field: 'FR.line.sku (via SKU mapping)' },
        { customer_col: 'qty',               helm_field: 'FR.line.qty' },
        { customer_col: 'recipient_name',    helm_field: 'FR.end_recipient.name' },
        { customer_col: 'recipient_addr',    helm_field: 'FR.end_recipient.address' },
        { customer_col: 'shipping_method',   helm_field: 'FR.shipping_method (mapped)' },
      ],
      sample_row: {
        shopify_order_id: '#INS-44291',
        shopify_sku: 'CYP-IND-PLW-18',
        qty: '2',
        recipient_name: 'Emily Park',
        recipient_addr: '742 Maplewood Dr, Columbus, OH 43215',
        shipping_method: 'Standard',
      },
      sample_output: [
        { pr_number: 'FR-3142', sku: 'PLW-CYP-18x18', fabric: 'Cotton Sateen 110-thread', design: 'Cypress / Indigo', qty: 2, unit: 'pillows' },
      ],
    },
    routing_guide: {
      nas_root: '\\\\adt-nas\\artwork\\inside',
      folder_convention: '{design}/{colorway}/production/*.tif',
      strike_off_rule: 'Never — Inside-tier customers; production is from pre-approved combos in stored inventory',
      strike_off_approval: 'N/A',
      hot_folder_destination: 'N/A — pulled from stored inventory; no new PR routing',
    },
    sku_mapping: [
      { customer_sku: 'CYP-IND-PLW-18', adt_sku: 'PLW-CYP-18x18',  design: 'Cypress',  colorway: 'Indigo',  fabric: 'Cotton Sateen 110-thread' },
      { customer_sku: 'CYP-IND-PLW-20', adt_sku: 'PLW-CYP-20x20',  design: 'Cypress',  colorway: 'Indigo',  fabric: 'Cotton Sateen 110-thread' },
      { customer_sku: 'MAR-WHT-PLW-14', adt_sku: 'PLW-MAR-14x14',  design: 'Marigold', colorway: 'White',   fabric: 'Linen Blend Natural' },
      { customer_sku: 'SAG-OLV-PLW-14', adt_sku: 'PLW-SAG-14x14',  design: 'Sage',     colorway: 'Olive',   fabric: 'Linen Blend Natural' },
    ],
    fulfillment: {
      method: 'Customer-stored inventory — pull on Fulfillment Request',
      label_mode: 'A',
      label_mode_note: 'ADT logs into Inside\'s Shopify with stored credentials and prints the label from there.',
    },
    packaging: [
      { product_type: 'Throw Pillow', profile: 'Inside Pillow Tissue Wrap', notes: 'Tissue + branded sticker · no insert paperwork (Inside ships their own welcome card later)' },
    ],
    shipping: {
      preferred_carrier: 'UPS',
      service_level: 'Ground',
      blind_ship_default: true,
      third_party_billed: false,
    },
    billing: {
      credit_hold: false,
      payment_terms: 'Net 60 (volume customer)',
      overage_policy: 'N/A (stored-inventory model — no overage)',
      overage_tolerance_pct: 0,
      pricing_variance_threshold: 'Admin-configured · alerts Megan on variance over threshold',
      po_required: false,
      invoice_routing: 'Monthly summary invoice to ap@inside.example',
    },
    production_requirements: [
      { kind: 'Fabric restrictions', value: 'Cotton Sateen 110-thread for Cypress combos; Linen Blend Natural for Marigold/Sage combos' },
      { kind: 'Inspection threshold', value: 'Standard for pillow construction; reject any visible color shift >ΔE 2.0' },
      { kind: 'Finishing', value: 'Inserts fitted at ADT (Down Alternative standard)' },
    ],
    credentials: [
      { kind: 'Shopify',          value: 'inside-havenly.myshopify.com · API token ★★★★★★★★ (rotated 2026-05-03)' },
      { kind: 'Fulfillment email', value: 'fulfillment@adt.example listens for sender contains "inside.example"' },
    ],
  },

  // --------------- LAURA PARK DESIGNS ---------------
  {
    name: 'Laura Park Designs',
    slug: 'laura-park',
    tags: ['CSV intake', 'Email attachment', 'Stored inventory', 'Label mode A'],
    intake: {
      source: 'CSV file (customer-emailed)',
      method: 'Customer emails CSV attachment to orders@adt.example; Helm watcher polls inbox every 30 min',
      schedule: 'Polled every 30 min',
      file_format: 'CSV (UTF-8, comma-delimited, header row)',
      file_naming: 'lpd_fulfillment_YYYYMMDD.csv',
      auto_route: true,
      recent_imports: [
        { date: '2026-06-18 09:00 PT', rows: 6, pr_created: 0, failed: 0 },
        { date: '2026-06-17 11:30 PT', rows: 11, pr_created: 0, failed: 1 },
        { date: '2026-06-16 09:00 PT', rows: 8, pr_created: 0, failed: 0 },
      ],
      field_mapping: [
        { customer_col: 'lpd_order_ref',     helm_field: 'FulfillmentRequest.source_id' },
        { customer_col: 'sku',               helm_field: 'FR.line.sku (via SKU mapping)' },
        { customer_col: 'qty',               helm_field: 'FR.line.qty' },
        { customer_col: 'recipient_name',    helm_field: 'FR.end_recipient.name' },
        { customer_col: 'recipient_address', helm_field: 'FR.end_recipient.address' },
      ],
      sample_row: {
        lpd_order_ref: 'LPD-9942',
        sku: 'MAR-Y-22',
        qty: '3',
        recipient_name: 'Sarah Chen',
        recipient_address: '210 Bouldin Ave, Austin, TX 78704',
      },
      sample_output: [
        { pr_number: 'FR-3138', sku: 'PLW-MAR-22x22', fabric: 'Cotton Sateen 110-thread', design: 'Marigold / Yellow', qty: 3, unit: 'pillows' },
      ],
    },
    routing_guide: {
      nas_root: '\\\\adt-nas\\artwork\\laura-park',
      folder_convention: '{design}/{colorway}/production/*.tif',
      strike_off_rule: 'Never — pre-approved combos in stored inventory',
      strike_off_approval: 'N/A',
      hot_folder_destination: 'N/A — pulled from stored inventory',
    },
    sku_mapping: [
      { customer_sku: 'MAR-Y-22', adt_sku: 'PLW-MAR-22x22', design: 'Marigold', colorway: 'Yellow', fabric: 'Cotton Sateen 110-thread' },
      { customer_sku: 'MAR-Y-18', adt_sku: 'PLW-MAR-18x18', design: 'Marigold', colorway: 'Yellow', fabric: 'Cotton Sateen 110-thread' },
      { customer_sku: 'COR-P-18', adt_sku: 'PLW-COR-18x18', design: 'Coral',    colorway: 'Pink',   fabric: 'Cotton Sateen 90-thread' },
    ],
    fulfillment: {
      method: 'Customer-stored inventory — pull on Fulfillment Request',
      label_mode: 'A',
      label_mode_note: 'ADT logs into Laura Park\'s Shopify with stored credentials and prints the label from there.',
    },
    packaging: [
      { product_type: 'Throw Pillow', profile: 'Laura Park Tissue Wrap', notes: 'Tissue + LPD branded sticker' },
    ],
    shipping: {
      preferred_carrier: 'USPS',
      service_level: 'Priority',
      blind_ship_default: true,
      third_party_billed: false,
    },
    billing: {
      credit_hold: false,
      payment_terms: 'Net 30',
      overage_policy: 'N/A (stored model)',
      overage_tolerance_pct: 0,
      pricing_variance_threshold: 'Admin-configured',
      po_required: false,
      invoice_routing: 'Monthly summary to ap@laurapark.example',
    },
    production_requirements: [
      { kind: 'Fabric restrictions', value: 'Cotton Sateen variants only' },
      { kind: 'Inspection threshold', value: 'Standard' },
    ],
    credentials: [
      { kind: 'Shopify', value: 'laura-park.myshopify.com · API token ★★★★★★★★ (rotated 2026-04-22)' },
      { kind: 'Orders email watcher', value: 'orders@adt.example listens for sender contains "laurapark.example" + attachment .csv' },
    ],
  },

  // --------------- HOUSE OF MBR ---------------
  {
    name: 'House of MBR',
    slug: 'house-of-mbr',
    tags: ['CSV intake', 'Email attachment', 'Stored inventory', 'Label mode C'],
    intake: {
      source: 'CSV file (customer-emailed)',
      method: 'Customer emails CSV attachment to orders@adt.example; watcher polls inbox',
      schedule: 'Polled every 30 min',
      file_format: 'CSV (UTF-8, comma-delimited, header row)',
      file_naming: 'mbr_fulfill_YYYYMMDD.csv',
      auto_route: true,
      recent_imports: [
        { date: '2026-06-18 08:45 PT', rows: 3, pr_created: 0, failed: 0 },
        { date: '2026-06-17 13:20 PT', rows: 5, pr_created: 0, failed: 0 },
      ],
      field_mapping: [
        { customer_col: 'mbr_ref',           helm_field: 'FulfillmentRequest.source_id' },
        { customer_col: 'sku',               helm_field: 'FR.line.sku (via SKU mapping)' },
        { customer_col: 'qty',               helm_field: 'FR.line.qty' },
        { customer_col: 'recipient_name',    helm_field: 'FR.end_recipient.name' },
        { customer_col: 'recipient_addr',    helm_field: 'FR.end_recipient.address' },
        { customer_col: 'attached_label',    helm_field: 'FR.label_artifact (customer-supplied PDF)' },
      ],
      sample_row: {
        mbr_ref: 'MBR-2091',
        sku: 'LIN-NAT-84',
        qty: '1',
        recipient_name: 'David Kim',
        recipient_addr: '1330 8th Ave, Seattle, WA 98119',
        attached_label: 'mbr-2091-label.pdf',
      },
      sample_output: [
        { pr_number: 'FR-3141', sku: 'DRP-LIN-84', fabric: 'Linen Blend Natural', design: 'Linen / Natural', qty: 1, unit: 'drape' },
      ],
    },
    routing_guide: {
      nas_root: '\\\\adt-nas\\artwork\\mbr',
      folder_convention: '{sku}/production/*.tif',
      strike_off_rule: 'Never — pre-approved combos',
      strike_off_approval: 'N/A',
      hot_folder_destination: 'N/A — pulled from stored inventory',
    },
    sku_mapping: [
      { customer_sku: 'LIN-NAT-84', adt_sku: 'DRP-LIN-84', design: 'Linen',   colorway: 'Natural', fabric: 'Linen Blend Natural' },
      { customer_sku: 'LIN-NAT-96', adt_sku: 'DRP-LIN-96', design: 'Linen',   colorway: 'Natural', fabric: 'Linen Blend Natural' },
    ],
    fulfillment: {
      method: 'Customer-stored inventory — pull on Fulfillment Request',
      label_mode: 'C',
      label_mode_note: 'Customer supplies pre-paid carrier label as PDF attachment on the same email. Helm matches it to the FR by mbr_ref.',
    },
    packaging: [
      { product_type: 'Drape', profile: 'MBR Drape Roll Pack', notes: 'Garment bag + branded ribbon' },
    ],
    shipping: {
      preferred_carrier: 'Customer-supplied label',
      service_level: 'Per label',
      blind_ship_default: true,
      third_party_billed: false,
    },
    billing: {
      credit_hold: false,
      payment_terms: 'Net 30',
      overage_policy: 'N/A (stored model)',
      overage_tolerance_pct: 0,
      pricing_variance_threshold: 'Admin-configured',
      po_required: false,
      invoice_routing: 'Per-shipment invoice to ap@hofmbr.example',
    },
    production_requirements: [
      { kind: 'Fabric restrictions', value: 'Linen Blend Natural only (per current contract)' },
      { kind: 'Inspection threshold', value: 'Standard + drape-length check (±0.5") at packing' },
    ],
    credentials: [
      { kind: 'Orders email watcher', value: 'orders@adt.example listens for sender contains "hofmbr.example" + attachment .csv + .pdf' },
    ],
  },

  // --------------- LEMIEUX ET CIE ---------------
  {
    name: 'Lemieux Et Cie',
    slug: 'lemieux',
    tags: ['CSV intake', 'Email attachment', 'Stored inventory', 'Label mode A', 'Strike-off always required'],
    intake: {
      source: 'CSV file (customer-emailed)',
      method: 'Customer emails CSV attachment to orders@adt.example; watcher polls inbox',
      schedule: 'Polled every 30 min',
      file_format: 'CSV (UTF-8, comma-delimited, header row)',
      file_naming: 'lemieux_orders_YYYYMMDD.csv',
      auto_route: true,
      recent_imports: [
        { date: '2026-06-18 07:30 PT', rows: 2, pr_created: 0, failed: 0 },
        { date: '2026-06-17 16:00 PT', rows: 4, pr_created: 0, failed: 1 },
      ],
      field_mapping: [
        { customer_col: 'lec_ref',         helm_field: 'FulfillmentRequest.source_id' },
        { customer_col: 'sku',             helm_field: 'FR.line.sku (via SKU mapping)' },
        { customer_col: 'qty',             helm_field: 'FR.line.qty' },
        { customer_col: 'recipient_name',  helm_field: 'FR.end_recipient.name' },
        { customer_col: 'recipient_addr',  helm_field: 'FR.end_recipient.address' },
        { customer_col: 'special_note',    helm_field: 'FR.notes (free-text)' },
      ],
      sample_row: {
        lec_ref: 'LEC-1208',
        sku: 'TBL-TXT-72',
        qty: '1',
        recipient_name: 'Margaret O\'Brien',
        recipient_addr: '88 Beacon St, Boston, MA 02108',
        special_note: 'Gift wrap requested',
      },
      sample_output: [
        { pr_number: 'FR-3139', sku: 'TBL-TXT-72', fabric: 'Textured Linen', design: 'Textured / Natural', qty: 1, unit: 'tablecloth' },
      ],
    },
    routing_guide: {
      nas_root: '\\\\adt-nas\\artwork\\lemieux',
      folder_convention: '{design}/{colorway}/production/*.tif',
      strike_off_rule: 'Always — Lemieux requires a customer-approved strike-off on EVERY new design + colorway combination before production',
      strike_off_approval: 'Customer email approval (tokenized link · 30-day expiry)',
      hot_folder_destination: 'After strike-off approved → MS JP7 hot folder',
    },
    sku_mapping: [
      { customer_sku: 'TBL-TXT-72', adt_sku: 'TBL-TXT-72', design: 'Textured', colorway: 'Natural', fabric: 'Textured Linen' },
      { customer_sku: 'TBL-TXT-90', adt_sku: 'TBL-TXT-90', design: 'Textured', colorway: 'Natural', fabric: 'Textured Linen' },
    ],
    fulfillment: {
      method: 'Customer-stored inventory — pull on Fulfillment Request',
      label_mode: 'A',
      label_mode_note: 'ADT logs into Lemieux\'s Shopify with stored credentials and prints the label from there.',
    },
    packaging: [
      { product_type: 'Tablecloth', profile: 'Lemieux Premium Box', notes: 'Rigid gift box + tissue + LEC monogram band' },
    ],
    shipping: {
      preferred_carrier: 'FedEx',
      service_level: 'Ground',
      blind_ship_default: true,
      third_party_billed: false,
    },
    billing: {
      credit_hold: false,
      payment_terms: 'Net 30',
      overage_policy: 'N/A (stored model)',
      overage_tolerance_pct: 0,
      pricing_variance_threshold: 'Admin-configured · strict (Megan reviews any variance)',
      po_required: false,
      invoice_routing: 'Per-shipment invoice to ap@lemieuxetcie.example',
    },
    production_requirements: [
      { kind: 'Fabric restrictions', value: 'Textured Linen only (per current contract)' },
      { kind: 'Inspection threshold', value: 'High — color match within ΔE 1.5; no visible weave defects' },
      { kind: 'Finishing', value: 'Edge hemmed; LEC woven label sewn on corner' },
    ],
    credentials: [
      { kind: 'Shopify', value: 'lemieux-et-cie.myshopify.com · API token ★★★★★★★★ (rotated 2026-03-15)' },
      { kind: 'Orders email watcher', value: 'orders@adt.example listens for sender contains "lemieuxetcie.example" + attachment .csv' },
    ],
  },
];

// =====================================================================
// Page
// =====================================================================

export default function CustomerConfigs({ searchParams }: { searchParams: { customer?: string } }) {
  const slug = searchParams?.customer ?? CONFIGS[0].slug;
  const cfg = CONFIGS.find((c) => c.slug === slug) ?? CONFIGS[0];

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      <header>
        <h1 className="text-2xl font-bold text-navy-900">Customer Configurations</h1>
        <p className="text-sm text-gray-500 mt-1">
          Per C2 (Customer Profile) · how Helm understands each customer's intake source, routing guide, SKU mapping, fulfillment method, packaging, shipping, billing, and production rules · drives C9 (file routing + strike-off initiation) and C10 (CSV/XML intake) downstream.
        </p>
      </header>

      {/* Customer tab selector */}
      <div className="border-b border-gray-200 flex flex-wrap gap-1">
        {CONFIGS.map((c) => (
          <Link
            key={c.slug}
            href={`/customer-configs?customer=${c.slug}`}
            className={`px-4 py-2.5 border-b-2 text-sm font-semibold ${
              c.slug === cfg.slug
                ? 'border-navy-700 text-navy-900'
                : 'border-transparent text-gray-500 hover:text-navy-700 hover:border-gray-300'
            }`}
          >
            {c.name}
          </Link>
        ))}
      </div>

      {/* Customer header */}
      <div className="flex items-center gap-3 flex-wrap">
        <h2 className="text-xl font-bold text-navy-900">{cfg.name}</h2>
        {cfg.tags.map((t) => <Tag key={t} color="blue">{t}</Tag>)}
      </div>

      {/* SECTION 1: Order Intake & Source */}
      <Card>
        <CardHeader title="1 · Order Intake & Source" subtitle="How orders for this customer enter Helm" />
        <div className="p-5 space-y-5">
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <KV label="Source"        value={cfg.intake.source} />
            <KV label="Method"        value={cfg.intake.method} />
            <KV label="Schedule"      value={cfg.intake.schedule} />
            <KV label="File format"   value={cfg.intake.file_format} mono />
            <KV label="File naming"   value={cfg.intake.file_naming} mono />
            <KV label="Auto-route"    value={cfg.intake.auto_route ? 'Enabled (per C10 → C9 downstream)' : 'Disabled — manual CSR review'} />
          </div>

          {/* Field mapping */}
          <div>
            <div className="text-xs uppercase tracking-wider font-semibold text-navy-700 mb-2">Field mapping (customer column → Helm field)</div>
            <table className="w-full text-xs border border-gray-200 rounded overflow-hidden">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold text-gray-700">Customer column</th>
                  <th className="text-left px-3 py-2 font-semibold text-gray-700">→</th>
                  <th className="text-left px-3 py-2 font-semibold text-gray-700">Helm field</th>
                  <th className="text-left px-3 py-2 font-semibold text-gray-700">Notes</th>
                </tr>
              </thead>
              <tbody>
                {cfg.intake.field_mapping.map((fm, i) => (
                  <tr key={i} className="border-t border-gray-200">
                    <td className="px-3 py-1.5 font-mono">{fm.customer_col}</td>
                    <td className="px-3 py-1.5 text-gray-400">→</td>
                    <td className="px-3 py-1.5 font-mono text-navy-700">{fm.helm_field}</td>
                    <td className="px-3 py-1.5 text-gray-600 italic">{fm.notes || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Sample row → sample output */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs uppercase tracking-wider font-semibold text-navy-700 mb-2">Sample incoming row</div>
              <div className="border border-gray-200 rounded p-3 bg-gray-50 text-xs font-mono space-y-0.5">
                {Object.entries(cfg.intake.sample_row).map(([k, v]) => (
                  <div key={k}><span className="text-gray-500">{k}:</span> {v}</div>
                ))}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider font-semibold text-navy-700 mb-2">Resulting Helm record</div>
              <div className="border border-navy-500 rounded p-3 bg-navy-50 text-xs space-y-2">
                {cfg.intake.sample_output.map((o, i) => (
                  <div key={i} className="font-mono">
                    <div><span className="text-gray-500">→ Generated:</span> <strong className="text-navy-700">{o.pr_number}</strong></div>
                    <div><span className="text-gray-500">  SKU:</span> {o.sku}</div>
                    <div><span className="text-gray-500">  Design:</span> {o.design}</div>
                    <div><span className="text-gray-500">  Fabric:</span> {o.fabric}</div>
                    <div><span className="text-gray-500">  Qty:</span> {o.qty} {o.unit}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Recent imports */}
          <div>
            <div className="text-xs uppercase tracking-wider font-semibold text-navy-700 mb-2">Recent imports</div>
            <table className="w-full text-xs">
              <thead className="text-gray-500 border-b border-gray-200">
                <tr>
                  <th className="text-left px-3 py-1.5">Run time</th>
                  <th className="text-right px-3 py-1.5">Rows</th>
                  <th className="text-right px-3 py-1.5">PRs / FRs created</th>
                  <th className="text-right px-3 py-1.5">Failed</th>
                </tr>
              </thead>
              <tbody>
                {cfg.intake.recent_imports.map((r, i) => (
                  <tr key={i} className="border-t border-gray-100">
                    <td className="px-3 py-1.5 font-mono">{r.date}</td>
                    <td className="px-3 py-1.5 text-right font-mono">{r.rows}</td>
                    <td className="px-3 py-1.5 text-right font-mono">{r.pr_created}</td>
                    <td className="px-3 py-1.5 text-right">
                      {r.failed > 0 ? <Tag color="red">{r.failed}</Tag> : <span className="text-gray-400 font-mono">0</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Card>

      {/* SECTION 2: Routing Guide */}
      <Card>
        <CardHeader title="2 · Routing Guide (C9)" subtitle="How Helm locates the design file, decides whether a strike-off is required, and routes to the correct hot folder" />
        <div className="p-5 grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <KV label="NAS root"                value={cfg.routing_guide.nas_root} mono />
          <KV label="Folder convention"       value={cfg.routing_guide.folder_convention} mono />
          <KV label="Strike-off rule"         value={cfg.routing_guide.strike_off_rule} />
          <KV label="Strike-off approval"     value={cfg.routing_guide.strike_off_approval} />
          <KV label="Hot folder destination"  value={cfg.routing_guide.hot_folder_destination} colSpan />
        </div>
      </Card>

      {/* SECTION 3: SKU Mapping */}
      <Card>
        <CardHeader title="3 · SKU Mapping" subtitle="Customer SKU → ADT SKU / Design / Colorway / Fabric · used by C9 for file resolution + C10 for intake translation" />
        <table className="w-full text-xs">
          <thead className="text-gray-500 uppercase tracking-wider border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-2">Customer SKU</th>
              <th className="text-left px-4 py-2">ADT SKU</th>
              <th className="text-left px-4 py-2">Design</th>
              <th className="text-left px-4 py-2">Colorway</th>
              <th className="text-left px-4 py-2 pr-5">Fabric</th>
            </tr>
          </thead>
          <tbody>
            {cfg.sku_mapping.map((s, i) => (
              <tr key={i} className="border-t border-gray-100">
                <td className="px-4 py-1.5 font-mono">{s.customer_sku}</td>
                <td className="px-4 py-1.5 font-mono text-navy-700">{s.adt_sku}</td>
                <td className="px-4 py-1.5">{s.design}</td>
                <td className="px-4 py-1.5">{s.colorway}</td>
                <td className="px-4 py-1.5 pr-5">{s.fabric}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* SECTION 4 & 5: Fulfillment + Packaging side-by-side */}
      <div className="grid grid-cols-2 gap-6">
        <Card>
          <CardHeader title="4 · Fulfillment Method" />
          <div className="p-5 space-y-3 text-sm">
            <KV label="Method" value={cfg.fulfillment.method} />
            {cfg.fulfillment.label_mode && (
              <>
                <KV label="Label mode" value={`Mode ${cfg.fulfillment.label_mode}`} />
                <div className="text-xs text-gray-600 italic pl-1 -mt-2">{cfg.fulfillment.label_mode_note}</div>
              </>
            )}
          </div>
        </Card>
        <Card>
          <CardHeader title="5 · Packaging Rules" subtitle="Default packaging profile(s) per product type" />
          <div className="p-5 space-y-3 text-sm">
            {cfg.packaging.map((p, i) => (
              <div key={i} className="border-l-2 border-navy-500 pl-3">
                <div className="font-semibold">{p.product_type}</div>
                <div className="text-xs">{p.profile}</div>
                {p.notes && <div className="text-xs text-gray-500 italic mt-0.5">{p.notes}</div>}
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* SECTION 6 & 7: Shipping + Billing side-by-side */}
      <div className="grid grid-cols-2 gap-6">
        <Card>
          <CardHeader title="6 · Shipping Rules" />
          <div className="p-5 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <KV label="Preferred carrier"   value={cfg.shipping.preferred_carrier} />
            <KV label="Service level"       value={cfg.shipping.service_level} />
            <KV label="Blind ship default"  value={cfg.shipping.blind_ship_default ? 'Yes' : 'No'} />
            <KV label="3rd-party billed"    value={cfg.shipping.third_party_billed ? 'Yes' : 'No'} />
            {cfg.shipping.carrier_account && (
              <KV label="Carrier account" value={`${cfg.shipping.carrier_account.carrier} #${cfg.shipping.carrier_account.masked_account}`} mono colSpan />
            )}
          </div>
        </Card>
        <Card>
          <CardHeader title="7 · Billing Rules" subtitle="Helm flags + thresholds · dollar values live in QuickBooks" />
          <div className="p-5 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <KV label="Credit hold"            value={cfg.billing.credit_hold ? 'Yes' : 'No'} />
            <KV label="Payment terms"          value={cfg.billing.payment_terms} />
            <KV label="Overage policy"         value={cfg.billing.overage_policy} />
            <KV label="Overage tolerance"      value={`${cfg.billing.overage_tolerance_pct}%`} />
            <KV label="Pricing variance"       value={cfg.billing.pricing_variance_threshold} colSpan />
            <KV label="PO required"            value={cfg.billing.po_required ? 'Yes' : 'No'} />
            <KV label="Invoice routing"        value={cfg.billing.invoice_routing} />
          </div>
        </Card>
      </div>

      {/* SECTION 8: Production Requirements */}
      <Card>
        <CardHeader title="8 · Customer-Specific Production Requirements" />
        <div className="p-5 space-y-2 text-sm">
          {cfg.production_requirements.map((p, i) => (
            <div key={i} className="grid grid-cols-4 gap-2">
              <div className="text-xs uppercase tracking-wider text-gray-500">{p.kind}</div>
              <div className="col-span-3">{p.value}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* SECTION 9: Credentials */}
      <Card>
        <CardHeader title="9 · Credentials & Integrations" subtitle="Stored encrypted · accessed only via service · displayed masked for review" />
        <div className="p-5 space-y-2 text-sm">
          {cfg.credentials.map((c, i) => (
            <div key={i} className="grid grid-cols-4 gap-2">
              <div className="text-xs uppercase tracking-wider text-gray-500">{c.kind}</div>
              <div className="col-span-3 font-mono text-xs">{c.value}</div>
            </div>
          ))}
        </div>
      </Card>

      <div className="px-4 py-3 bg-navy-50 border-l-4 border-navy-500 text-xs text-gray-700 rounded-r">
        <strong className="text-navy-900">Prototype note.</strong> Each customer config above is mock data structured to demonstrate the C2 Customer Profile shape and how it drives C9 (Design File Routing + Hot Folder + Strike-Off Initiation) and C10 (CSV/XML Intake) downstream. In production the configs would be admin-editable via Settings; today they are read-only here. The page exists so Ali (and Nick) can verify Helm's understanding of each customer's setup at a glance.
      </div>
    </div>
  );
}

function KV({ label, value, mono, colSpan }: { label: string; value: string; mono?: boolean; colSpan?: boolean }) {
  return (
    <div className={colSpan ? 'col-span-2' : ''}>
      <div className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">{label}</div>
      <div className={`text-sm mt-0.5 ${mono ? 'font-mono text-xs' : ''}`}>{value}</div>
    </div>
  );
}
