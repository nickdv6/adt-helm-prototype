'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plus, Trash2, Upload, Download, FileCheck, FolderInput, FolderOutput, Archive, KeyRound, Search, X, Pencil, Wand2 } from 'lucide-react';
import { Card, CardHeader, Tag, Button } from '@/components/ui';
import { MockSurfaceBanner } from '@/components/mock-surface-banner';

// /customer-configs — Admin tool to set up a new CSV/XML customer's intake pipeline.
// Per Nick: this is the configuration surface. Admin defines source folders, field mappings,
// destination folders for shipping export (so FedEx/UPS systems can pick up and print labels),
// packing list archive paths, hot folder routing for production, and the production/billing
// rules that flow downstream.

// Existing presets shown as tabs so admin can edit an active customer; rightmost tab is
// '+ Add New Customer Config' for a fresh setup. Form is fully editable.

// =====================================================================
// Mock existing customer presets — populate the form when admin selects a tab.
// =====================================================================

type Preset = {
  slug: string;
  display_name: string;
  status: 'Active' | 'Draft' | 'Inactive';
  customer_id_label: string;
};

const PRESETS: Preset[] = [
  { slug: 'stfrank',         display_name: 'St. Frank',          status: 'Active', customer_id_label: 'CUST-014' },
  { slug: 'inside-havenly',  display_name: 'Inside / Havenly',   status: 'Active', customer_id_label: 'CUST-022' },
  { slug: 'laura-park',      display_name: 'Laura Park Designs', status: 'Active', customer_id_label: 'CUST-031' },
  { slug: 'house-of-mbr',    display_name: 'House of MBR',       status: 'Active', customer_id_label: 'CUST-037' },
  { slug: 'lemieux',         display_name: 'Lemieux Et Cie',     status: 'Draft',  customer_id_label: 'CUST-044' },
];

// =====================================================================
// Option lists
// =====================================================================

const INTAKE_SOURCE_TYPES = [
  'SFTP — customer pushes files to ADT SFTP path',
  'Email attachment — Helm watches an inbox',
  'Hot folder — file watcher on a NAS path',
  'API push — customer system posts to Helm endpoint',
  'Shopify webhook — Shopify posts orders to Helm',
  'Manual upload (CSR uploads file via Helm UI)',
];
const FILE_FORMATS = ['CSV', 'XML', 'JSON', 'EDI 850 (mapped)'];
const SCHEDULES = [
  'Real-time (event-driven)',
  'Every 5 min',
  'Every 15 min',
  'Every 30 min',
  'Hourly',
  'Daily at 06:00 PT',
  'Manual trigger only',
];
const HELM_FIELDS = [
  'Order.po_number',
  'Order.customer_requested_date',
  'Order.notes',
  'PR.sku_id (via SKU mapping)',
  'PR.design_id',
  'PR.colorway_id',
  'PR.planned_yardage',
  'PR.fabric_id',
  'PR.quantity',
  'FR.source_id',
  'FR.line.sku',
  'FR.line.qty',
  'FR.end_recipient.name',
  'FR.end_recipient.address',
  'FR.notes',
  'ShipToAddress.name',
  'ShipToAddress.line1',
  'ShipToAddress.line2',
  'ShipToAddress.city',
  'ShipToAddress.state',
  'ShipToAddress.zip',
  'FR.label_artifact (file attachment)',
];
const TRANSFORMS = ['none', 'uppercase', 'lowercase', 'trim', 'date YYYY-MM-DD', 'lookup table'];
const EXPORT_TRIGGERS = [
  'On Fulfillment Request packed',
  'On Production Order Ready to Ship',
  'On batch (daily 07:00 PT)',
  'On batch (every 4 hours)',
  'Manual export only',
];
const EXPORT_FORMATS = ['CSV (FedEx import)', 'CSV (UPS import)', 'XML (FedEx Ship Manager)', 'XML (UPS WorldShip)', 'JSON (generic)'];
const ARCHIVE_FORMATS = ['PDF', 'HTML', 'CSV row + original payload', 'EDI 856 (ASN)'];
const FULFILLMENT_MODES = [
  'Direct-to-customer (production ships to customer warehouse)',
  'Stored inventory (Bundle pulled on Fulfillment Request)',
  'Mixed (some SKUs direct, others stored)',
];
const LABEL_MODES = [
  'Mode A — ADT logs into customer Shopify (stored credentials)',
  'Mode B — ADT prints via customer\'s carrier account',
  'Mode C — Customer supplies pre-paid label',
  'Mode D — ADT ships to end consumer on client\'s behalf (ADT carrier account · blind-shipped · billed back to client)',
  'N/A (direct-to-customer)',
];
const CARRIERS = ['UPS', 'FedEx', 'USPS', 'DHL', 'Customer-supplied label'];
const STRIKEOFF_RULES = [
  'Always — every new design + colorway combo',
  'First-run only — only when Design + Colorway + Fabric has never been produced',
  'New colorway only',
  'New fabric only',
  'Never (pre-approved combos)',
];
const STRIKEOFF_APPROVAL = [
  'Internal only (Colorist reviews; no customer email)',
  'Customer-approved (tokenized email link · 30-day expiry)',
];
const PRINT_PROFILES = ['Cotton Sateen 110-thread · Default', 'Cotton Sateen 90-thread · Default', 'Linen Blend Natural · Default', 'Velvet Cotton · Default', 'Customer-Supplied · per-PR'];
const FABRIC_OPTIONS = ['Cotton Sateen 110-thread', 'Cotton Sateen 90-thread', 'Linen Blend Natural', 'Velvet Cotton', 'Textured Linen', 'Performance Outdoor'];
const HOT_FOLDERS = [
  'Durst Alpha 330 hot folder',
  'MS JP7 hot folder',
  'MS JP4-A hot folder',
  'MS JP4-B hot folder',
  'HP Latex 830W hot folder',
  'HP Latex 800W hot folder',
  'Zimmer Colaris hot folder',
];

// =====================================================================
// Initial form values for a preset (rough mock — fields admins would tweak)
// =====================================================================

type FieldMappingRow = { id: string; source_col: string; helm_field: string; required: boolean; default_value: string; transform: string; notes: string };
type SKUMapRow = {
  id: string;
  customer_sku: string;
  adt_sku: string;
  design: string;
  colorway: string;
  fabric: string;
  // Production rules — per SKU, not customer-wide (per Nick)
  print_profile: string;
  strikeoff_rule: string;
  strikeoff_approval: string;
};
type ShipExportColumn = { id: string; export_col: string; helm_value: string };
type HotFolderOverride = { id: string; fabric: string; hot_folder: string };

const empty = () => ({
  customer_name: '',
  customer_id_label: '',
  status: 'Draft' as 'Active' | 'Draft' | 'Inactive',
  tags: '',
  intake_source: '',
  source_path: '',
  schedule: '',
  file_format: '',
  file_naming: '',
  auto_route: true,
  field_mapping: [] as FieldMappingRow[],
  sku_mapping: [] as SKUMapRow[],
  ship_export_folder: '',
  ship_export_format: '',
  ship_export_trigger: '',
  ship_export_naming: '',
  ship_export_columns: [] as ShipExportColumn[],
  archive_folder: '',
  archive_format: '',
  archive_naming: '',
  archive_retention_days: '365',
  default_hot_folder: '',
  hot_folder_overrides: [] as HotFolderOverride[],
  fulfillment_mode: '',
  label_mode: '',
  blind_ship_default: false,
  preferred_carrier: '',
});

const stfrankPreset = () => ({
  ...empty(),
  customer_name: 'St. Frank',
  customer_id_label: 'CUST-014',
  status: 'Active' as const,
  tags: 'csv, sftp, direct-ship',
  intake_source: INTAKE_SOURCE_TYPES[0],
  source_path: 'sftp://sftp.adt.example/incoming/stfrank/',
  schedule: SCHEDULES[2],
  file_format: 'CSV',
  file_naming: 'stfrank_po_{YYYYMMDD}_{HHMM}.csv',
  auto_route: true,
  field_mapping: [
    { id: 'fm1', source_col: 'po_number',           helm_field: 'Order.po_number',                  required: true,  default_value: '', transform: 'none', notes: '' },
    { id: 'fm2', source_col: 'customer_sku',        helm_field: 'PR.sku_id (via SKU mapping)',      required: true,  default_value: '', transform: 'none', notes: 'Resolved through SKU Mapping table below' },
    { id: 'fm3', source_col: 'qty_yards',           helm_field: 'PR.planned_yardage',               required: true,  default_value: '', transform: 'none', notes: '' },
    { id: 'fm4', source_col: 'requested_ship_date', helm_field: 'Order.customer_requested_date',    required: true,  default_value: '', transform: 'date YYYY-MM-DD', notes: '' },
    { id: 'fm5', source_col: 'ship_to_name',        helm_field: 'ShipToAddress.name',               required: true,  default_value: '', transform: 'trim', notes: '' },
    { id: 'fm6', source_col: 'ship_to_addr_1',      helm_field: 'ShipToAddress.line1',              required: true,  default_value: '', transform: 'trim', notes: '' },
    { id: 'fm7', source_col: 'ship_to_city',        helm_field: 'ShipToAddress.city',               required: true,  default_value: '', transform: 'trim', notes: '' },
    { id: 'fm8', source_col: 'ship_to_state',       helm_field: 'ShipToAddress.state',              required: true,  default_value: '', transform: 'uppercase', notes: '2-char state code' },
    { id: 'fm9', source_col: 'ship_to_zip',         helm_field: 'ShipToAddress.zip',                required: true,  default_value: '', transform: 'none', notes: '' },
    { id: 'fm10', source_col: 'notes',              helm_field: 'Order.notes',                      required: false, default_value: '', transform: 'none', notes: 'Free-text; not used for routing' },
  ],
  sku_mapping: [
    { id: 's1', customer_sku: 'SF-CYP-Y15', adt_sku: 'CYP-IND-Yardage',  design: 'Cypress',  colorway: 'Indigo', fabric: 'Cotton Sateen 110-thread',
      print_profile: PRINT_PROFILES[0], strikeoff_rule: STRIKEOFF_RULES[1], strikeoff_approval: STRIKEOFF_APPROVAL[0] },
    { id: 's2', customer_sku: 'SF-MAR-Y15', adt_sku: 'MAR-WHT-Yardage', design: 'Marigold', colorway: 'White',  fabric: 'Linen Blend Natural',
      print_profile: PRINT_PROFILES[2], strikeoff_rule: STRIKEOFF_RULES[1], strikeoff_approval: STRIKEOFF_APPROVAL[0] },
    { id: 's3', customer_sku: 'SF-COR-Y15', adt_sku: 'COR-PINK-Yardage', design: 'Coral',   colorway: 'Pink',   fabric: 'Cotton Sateen 90-thread',
      print_profile: PRINT_PROFILES[1], strikeoff_rule: STRIKEOFF_RULES[2], strikeoff_approval: STRIKEOFF_APPROVAL[0] },
  ],
  ship_export_folder: '\\\\adt-nas\\shipping-exports\\stfrank\\outbound\\',
  ship_export_format: EXPORT_FORMATS[0],
  ship_export_trigger: EXPORT_TRIGGERS[1],
  ship_export_naming: 'stfrank_fedex_{YYYYMMDD}_{HHMM}.csv',
  ship_export_columns: [
    { id: 'sc1', export_col: 'order_number',  helm_value: 'Order.order_number' },
    { id: 'sc2', export_col: 'recipient',     helm_value: 'ShipToAddress.name' },
    { id: 'sc3', export_col: 'address1',      helm_value: 'ShipToAddress.line1' },
    { id: 'sc4', export_col: 'city',          helm_value: 'ShipToAddress.city' },
    { id: 'sc5', export_col: 'state',         helm_value: 'ShipToAddress.state' },
    { id: 'sc6', export_col: 'zip',           helm_value: 'ShipToAddress.zip' },
    { id: 'sc7', export_col: 'weight_lb',     helm_value: 'ShipmentPackage.weight' },
    { id: 'sc8', export_col: 'service_level', helm_value: 'literal: FEDEX_GROUND' },
  ],
  archive_folder: '\\\\adt-nas\\archive\\stfrank\\packing-lists\\{YYYY}\\{MM}\\',
  archive_format: ARCHIVE_FORMATS[0],
  archive_naming: 'stfrank_pl_{order_number}_{YYYYMMDD}.pdf',
  archive_retention_days: '2555',
  // St. Frank prints on natural-fiber cotton/linen — defaults to MS JP7 (Fiber Reactive · ideal for natural fibers).
  // Performance Outdoor fabric overrides to HP Latex 830W (Latex prints on PFP directly · best chemistry for outdoor use).
  default_hot_folder: 'MS JP7 hot folder',
  hot_folder_overrides: [
    { id: 'ho1', fabric: 'Performance Outdoor', hot_folder: 'HP Latex 830W hot folder' },
  ],
  fulfillment_mode: FULFILLMENT_MODES[0],
  label_mode: LABEL_MODES[4],   // 'N/A (direct-to-customer)' — note: shifted index after Mode D was inserted
  blind_ship_default: false,
  preferred_carrier: CARRIERS[1],
});

const insidePreset = () => ({
  ...empty(),
  customer_name: 'Inside / Havenly',
  customer_id_label: 'CUST-022',
  status: 'Active' as const,
  tags: 'shopify, stored-inventory, label-mode-A, blind-ship',
  intake_source: INTAKE_SOURCE_TYPES[1],
  source_path: 'fulfillment@adt.example (filter: sender contains "inside.example")',
  schedule: SCHEDULES[0],
  file_format: 'CSV',
  file_naming: 'inside_packing_list_{INS-NNN}.csv (extracted from email body)',
  auto_route: true,
  field_mapping: [
    { id: 'fm1', source_col: 'shopify_order_id', helm_field: 'FR.source_id',              required: true,  default_value: '', transform: 'none', notes: 'Becomes FulfillmentRequest entity (C22), not Production Order' },
    { id: 'fm2', source_col: 'shopify_sku',      helm_field: 'FR.line.sku',               required: true,  default_value: '', transform: 'none', notes: 'Resolved through SKU Mapping table below' },
    { id: 'fm3', source_col: 'qty',              helm_field: 'FR.line.qty',               required: true,  default_value: '', transform: 'none', notes: '' },
    { id: 'fm4', source_col: 'recipient_name',   helm_field: 'FR.end_recipient.name',     required: true,  default_value: '', transform: 'trim', notes: '' },
    { id: 'fm5', source_col: 'recipient_addr',   helm_field: 'FR.end_recipient.address',  required: true,  default_value: '', transform: 'trim', notes: 'Multi-line address parsed downstream' },
    { id: 'fm6', source_col: 'shipping_method',  helm_field: 'FR.notes',                  required: false, default_value: 'Standard', transform: 'none', notes: 'Mapped to carrier service downstream' },
  ],
  sku_mapping: [
    { id: 's1', customer_sku: 'CYP-IND-PLW-18', adt_sku: 'PLW-CYP-18x18', design: 'Cypress',  colorway: 'Indigo', fabric: 'Cotton Sateen 110-thread',
      print_profile: PRINT_PROFILES[0], strikeoff_rule: STRIKEOFF_RULES[4], strikeoff_approval: 'N/A' },
    { id: 's2', customer_sku: 'CYP-IND-PLW-20', adt_sku: 'PLW-CYP-20x20', design: 'Cypress',  colorway: 'Indigo', fabric: 'Cotton Sateen 110-thread',
      print_profile: PRINT_PROFILES[0], strikeoff_rule: STRIKEOFF_RULES[4], strikeoff_approval: 'N/A' },
    { id: 's3', customer_sku: 'MAR-WHT-PLW-14', adt_sku: 'PLW-MAR-14x14', design: 'Marigold', colorway: 'White',  fabric: 'Linen Blend Natural',
      print_profile: PRINT_PROFILES[2], strikeoff_rule: STRIKEOFF_RULES[4], strikeoff_approval: 'N/A' },
  ],
  ship_export_folder: 'N/A (label printed via Shopify; no export file)',
  ship_export_format: EXPORT_FORMATS[2],
  ship_export_trigger: EXPORT_TRIGGERS[0],
  ship_export_naming: 'N/A',
  ship_export_columns: [],
  archive_folder: '\\\\adt-nas\\archive\\inside\\packing-lists\\{YYYY}\\{MM}\\',
  archive_format: ARCHIVE_FORMATS[0],
  archive_naming: 'inside_pl_{fr_number}_{YYYYMMDD}.pdf',
  archive_retention_days: '1825',
  default_hot_folder: 'N/A (pulled from stored inventory)',
  hot_folder_overrides: [],
  fulfillment_mode: FULFILLMENT_MODES[1],
  label_mode: LABEL_MODES[0],   // Mode A — ADT logs into customer Shopify
  blind_ship_default: true,
  preferred_carrier: CARRIERS[0],
});

function presetFor(slug: string) {
  switch (slug) {
    case 'stfrank':         return stfrankPreset();
    case 'inside-havenly':  return insidePreset();
    case 'laura-park':      return { ...insidePreset(), customer_name: 'Laura Park Designs', customer_id_label: 'CUST-031', tags: 'csv, email, stored-inventory, label-mode-A',
                                      intake_source: INTAKE_SOURCE_TYPES[1], source_path: 'orders@adt.example (sender contains "laurapark.example")',
                                      schedule: SCHEDULES[3], file_naming: 'lpd_fulfillment_{YYYYMMDD}.csv' };
    case 'house-of-mbr':    return { ...insidePreset(), customer_name: 'House of MBR', customer_id_label: 'CUST-037', tags: 'csv, email, stored-inventory, label-mode-C',
                                      intake_source: INTAKE_SOURCE_TYPES[1], source_path: 'orders@adt.example (sender contains "hofmbr.example")',
                                      file_naming: 'mbr_fulfill_{YYYYMMDD}.csv', label_mode: LABEL_MODES[2], preferred_carrier: CARRIERS[4] };
    case 'lemieux':         return { ...insidePreset(), customer_name: 'Lemieux Et Cie', customer_id_label: 'CUST-044', status: 'Draft' as const,
                                      tags: 'csv, email, stored-inventory, label-mode-A, strike-off-always',
                                      intake_source: INTAKE_SOURCE_TYPES[1], source_path: 'orders@adt.example (sender contains "lemieuxetcie.example")',
                                      file_naming: 'lemieux_orders_{YYYYMMDD}.csv',
                                      // Lemieux requires always-required strike-off + customer email approval — applied per SKU
                                      sku_mapping: [
                                        { id: 'le1', customer_sku: 'TBL-TXT-72', adt_sku: 'TBL-TXT-72', design: 'Textured', colorway: 'Natural', fabric: 'Textured Linen',
                                          print_profile: PRINT_PROFILES[0], strikeoff_rule: STRIKEOFF_RULES[0], strikeoff_approval: STRIKEOFF_APPROVAL[1] },
                                        { id: 'le2', customer_sku: 'TBL-TXT-90', adt_sku: 'TBL-TXT-90', design: 'Textured', colorway: 'Natural', fabric: 'Textured Linen',
                                          print_profile: PRINT_PROFILES[0], strikeoff_rule: STRIKEOFF_RULES[0], strikeoff_approval: STRIKEOFF_APPROVAL[1] },
                                      ],
                                    };
    default: return empty();
  }
}

// =====================================================================
// Page
// =====================================================================

let idCounter = 100;
const nextId = () => `gen-${idCounter++}`;

export default function CustomerConfigsAdmin() {
  const [activeSlug, setActiveSlug] = useState<string>('stfrank');
  const [form, setForm] = useState(() => presetFor('stfrank'));
  // SKU mapping at scale: edit one-at-a-time via a side drawer; bulk via Import modal
  const [editingSkuId, setEditingSkuId] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [skuSearch, setSkuSearch] = useState('');
  const [skuFilterFabric, setSkuFilterFabric] = useState('');
  const [skuFilterStrikeoff, setSkuFilterStrikeoff] = useState('');

  const switchTo = (slug: string) => {
    setActiveSlug(slug);
    setForm(slug === '__new' ? empty() : presetFor(slug));
  };

  const update = <K extends keyof ReturnType<typeof empty>>(key: K, value: ReturnType<typeof empty>[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  // Field mapping row operations
  const addFieldMapping = () => setForm((f) => ({ ...f, field_mapping: [...f.field_mapping, { id: nextId(), source_col: '', helm_field: '', required: false, default_value: '', transform: 'none', notes: '' }] }));
  const removeFieldMapping = (id: string) => setForm((f) => ({ ...f, field_mapping: f.field_mapping.filter((r) => r.id !== id) }));
  const updateFieldMapping = (id: string, patch: Partial<FieldMappingRow>) => setForm((f) => ({ ...f, field_mapping: f.field_mapping.map((r) => r.id === id ? { ...r, ...patch } : r) }));

  // SKU mapping row operations
  const addSKUMap = () => {
    const newId = nextId();
    setForm((f) => ({ ...f, sku_mapping: [...f.sku_mapping, { id: newId, customer_sku: '', adt_sku: '', design: '', colorway: '', fabric: '', print_profile: '', strikeoff_rule: '', strikeoff_approval: '' }] }));
    return newId;
  };
  const removeSKUMap = (id: string) => setForm((f) => ({ ...f, sku_mapping: f.sku_mapping.filter((r) => r.id !== id) }));
  const updateSKUMap = (id: string, patch: Partial<SKUMapRow>) => setForm((f) => ({ ...f, sku_mapping: f.sku_mapping.map((r) => r.id === id ? { ...r, ...patch } : r) }));

  // Shipping export columns
  const addShipCol = () => setForm((f) => ({ ...f, ship_export_columns: [...f.ship_export_columns, { id: nextId(), export_col: '', helm_value: '' }] }));
  const removeShipCol = (id: string) => setForm((f) => ({ ...f, ship_export_columns: f.ship_export_columns.filter((r) => r.id !== id) }));
  const updateShipCol = (id: string, patch: Partial<ShipExportColumn>) => setForm((f) => ({ ...f, ship_export_columns: f.ship_export_columns.map((r) => r.id === id ? { ...r, ...patch } : r) }));

  // Hot folder overrides
  const addHotFolder = () => setForm((f) => ({ ...f, hot_folder_overrides: [...f.hot_folder_overrides, { id: nextId(), fabric: '', hot_folder: '' }] }));
  const removeHotFolder = (id: string) => setForm((f) => ({ ...f, hot_folder_overrides: f.hot_folder_overrides.filter((r) => r.id !== id) }));
  const updateHotFolder = (id: string, patch: Partial<HotFolderOverride>) => setForm((f) => ({ ...f, hot_folder_overrides: f.hot_folder_overrides.map((r) => r.id === id ? { ...r, ...patch } : r) }));

  const isNew = activeSlug === '__new';

  return (
    <div className="max-w-7xl mx-auto pb-32">
      <div className="mb-4">
        <MockSurfaceBanner reason="Customer presets, field mappings, and transform rules don't persist — edits vanish on page reload. Not yet wired to /intake. Production needs intake_configs table + a real mapping UI." />
      </div>
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-navy-900">Customer CSV/XML Configurations</h1>
        <p className="text-sm text-gray-500 mt-1">
          Admin tool for onboarding new customer programs · profiles drive automation (import method · default printer · fabric defaults · ICC profile · strike-off rules · QR strategy · routing logic) so the <Link href="/intake" className="text-navy-700 hover:underline font-semibold">Intake Command Center</Link> can run hands-off.
        </p>
      </header>

      {/* Customer tab bar */}
      <div className="border-b border-gray-200 flex flex-wrap gap-1 mb-6">
        {PRESETS.map((p) => (
          <button
            key={p.slug}
            onClick={() => switchTo(p.slug)}
            className={`px-4 py-2.5 border-b-2 text-sm font-semibold flex items-center gap-2 ${
              p.slug === activeSlug
                ? 'border-navy-700 text-navy-900'
                : 'border-transparent text-gray-500 hover:text-navy-700 hover:border-gray-300'
            }`}
          >
            {p.display_name}
            {p.status === 'Draft' && <Tag color="yellow">Draft</Tag>}
            {p.status === 'Inactive' && <Tag color="gray">Inactive</Tag>}
          </button>
        ))}
        <button
          onClick={() => switchTo('__new')}
          className={`px-4 py-2.5 border-b-2 text-sm font-semibold flex items-center gap-1.5 ml-auto ${
            isNew
              ? 'border-cyan-500 text-cyan-700'
              : 'border-transparent text-cyan-600 hover:text-cyan-700 hover:border-cyan-300'
          }`}
        >
          <Plus className="w-4 h-4" /> Add New Customer Config
        </button>
      </div>

      {/* Form sections */}

      {/* SECTION 1 — Customer Identity */}
      <Card className="mb-5">
        <CardHeader title="1 · Customer Identity" />
        <div className="p-5 grid grid-cols-3 gap-x-4 gap-y-3">
          <FormField label="Customer name" required>
            <Input value={form.customer_name} onChange={(v) => update('customer_name', v)} placeholder="e.g. St. Frank" />
          </FormField>
          <FormField label="Customer ID">
            <Input value={form.customer_id_label} onChange={(v) => update('customer_id_label', v)} placeholder="auto-assigned" />
          </FormField>
          <FormField label="Status">
            <Select value={form.status} onChange={(v) => update('status', v as any)} options={['Draft', 'Active', 'Inactive']} />
          </FormField>
          <FormField label="Tags" hint="Comma-separated · used to surface operational characteristics on the dashboard" className="col-span-3">
            <Input value={form.tags} onChange={(v) => update('tags', v)} placeholder="csv, sftp, direct-ship" />
          </FormField>
        </div>
      </Card>

      {/* SECTION 2 — Intake Source */}
      <Card className="mb-5">
        <CardHeader title="2 · Intake Source" subtitle="Where incoming order / fulfillment files land" />
        <div className="p-5 grid grid-cols-2 gap-x-4 gap-y-3">
          <FormField label="Source type" required>
            <Select value={form.intake_source} onChange={(v) => update('intake_source', v)} options={INTAKE_SOURCE_TYPES} placeholder="Select source type…" />
          </FormField>
          <FormField label="Schedule">
            <Select value={form.schedule} onChange={(v) => update('schedule', v)} options={SCHEDULES} placeholder="Select schedule…" />
          </FormField>
          <FormField label="Source path / address" required hint="SFTP URL, email address with filter, NAS path, API endpoint, etc." className="col-span-2">
            <Input value={form.source_path} onChange={(v) => update('source_path', v)} mono placeholder="sftp://…   or   orders@adt.example (sender contains…)   or   \\adt-nas\incoming\…" />
          </FormField>
          <FormField label="File format" required>
            <Select value={form.file_format} onChange={(v) => update('file_format', v)} options={FILE_FORMATS} placeholder="Select format…" />
          </FormField>
          <FormField label="File naming pattern" hint="Tokens: {YYYY} {MM} {DD} {HH} {MM_24} {customer} {customer_ref}">
            <Input value={form.file_naming} onChange={(v) => update('file_naming', v)} mono placeholder="cust_orders_{YYYYMMDD}.csv" />
          </FormField>
          <FormField label="Auto-route to production" hint="When enabled, intake routes via C9 directly; otherwise CSR review is required" className="col-span-2">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.auto_route} onChange={(e) => update('auto_route', e.target.checked)} className="w-4 h-4" />
              Auto-route enabled
            </label>
          </FormField>
          <div className="col-span-2">
            <Button variant="secondary" size="sm"><KeyRound className="w-3.5 h-3.5 mr-1.5" />Manage Credentials</Button>
            <span className="text-xs text-gray-500 ml-3 italic">SFTP keys, API tokens, email watcher rules · stored encrypted</span>
          </div>
        </div>
      </Card>

      {/* SECTION 3 — Field Mapping */}
      <Card className="mb-5">
        <CardHeader
          title="3 · Field Mapping"
          subtitle="Incoming column → Helm field · runs against every row of every incoming file"
          action={<Button size="sm" onClick={addFieldMapping}><Plus className="w-3.5 h-3.5 mr-1" />Add Mapping</Button>}
        />
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-gray-500 uppercase tracking-wider border-b border-gray-200">
              <tr>
                <th className="text-left px-3 py-2">Source column</th>
                <th className="text-left px-3 py-2">→ Helm field</th>
                <th className="text-center px-3 py-2 w-20">Required</th>
                <th className="text-left px-3 py-2">Default if missing</th>
                <th className="text-left px-3 py-2">Transform</th>
                <th className="text-left px-3 py-2">Notes</th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody>
              {form.field_mapping.length === 0 && (
                <tr><td colSpan={7} className="text-center py-6 text-sm text-gray-400 italic">No mappings yet. Click "Add Mapping" to define how incoming columns translate to Helm fields.</td></tr>
              )}
              {form.field_mapping.map((row) => (
                <tr key={row.id} className="border-t border-gray-100">
                  <td className="px-3 py-1.5"><Input value={row.source_col} onChange={(v) => updateFieldMapping(row.id, { source_col: v })} mono sm /></td>
                  <td className="px-3 py-1.5"><Select value={row.helm_field} onChange={(v) => updateFieldMapping(row.id, { helm_field: v })} options={HELM_FIELDS} placeholder="—" sm /></td>
                  <td className="px-3 py-1.5 text-center"><input type="checkbox" checked={row.required} onChange={(e) => updateFieldMapping(row.id, { required: e.target.checked })} className="w-4 h-4" /></td>
                  <td className="px-3 py-1.5"><Input value={row.default_value} onChange={(v) => updateFieldMapping(row.id, { default_value: v })} sm /></td>
                  <td className="px-3 py-1.5"><Select value={row.transform} onChange={(v) => updateFieldMapping(row.id, { transform: v })} options={TRANSFORMS} sm /></td>
                  <td className="px-3 py-1.5"><Input value={row.notes} onChange={(v) => updateFieldMapping(row.id, { notes: v })} sm /></td>
                  <td className="px-3 py-1.5"><RemoveBtn onClick={() => removeFieldMapping(row.id)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* SECTION 4 — SKU Mapping (scale-aware: import-driven + searchable + edit-one-at-a-time) */}
      <SKUMappingSection
        rows={form.sku_mapping}
        skuSearch={skuSearch}
        setSkuSearch={setSkuSearch}
        skuFilterFabric={skuFilterFabric}
        setSkuFilterFabric={setSkuFilterFabric}
        skuFilterStrikeoff={skuFilterStrikeoff}
        setSkuFilterStrikeoff={setSkuFilterStrikeoff}
        onImport={() => setShowImport(true)}
        onAddSingle={() => setEditingSkuId(addSKUMap())}
        onEdit={(id) => setEditingSkuId(id)}
        // Realistic scale number for the prototype — emphasizes thousands-of-SKUs reality
        totalSkusForCustomer={form.customer_name === 'St. Frank' ? 4283 : form.customer_name === 'Inside / Havenly' ? 12847 : form.customer_name === 'Laura Park Designs' ? 6921 : form.customer_name === 'House of MBR' ? 1847 : form.customer_name === 'Lemieux Et Cie' ? 312 : 0}
      />

      {/* SECTION 5 — Output Destinations */}
      <Card className="mb-5 border-navy-500 border-2">
        <CardHeader title="5 · Output Destinations" subtitle="Where Helm writes outbound files for downstream systems (FedEx/UPS import, packing list archive, production hot folder routing)" />
        <div className="p-5 space-y-6">

          {/* 5a — Shipping Export */}
          <div>
            <h3 className="text-sm font-bold text-navy-900 mb-2 flex items-center gap-2"><FolderOutput className="w-4 h-4" /> 5a · Shipping Export (for FedEx / UPS to import for label printing)</h3>
            <p className="text-xs text-gray-500 mb-3 italic">Helm writes a file to this folder when the trigger fires. FedEx Ship Manager / UPS WorldShip watches the folder and uses the file to print labels.</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              <FormField label="Output folder" required hint="UNC path / S3 bucket / SFTP destination">
                <Input value={form.ship_export_folder} onChange={(v) => update('ship_export_folder', v)} mono placeholder="\\adt-nas\shipping-exports\…" />
              </FormField>
              <FormField label="Export format" required>
                <Select value={form.ship_export_format} onChange={(v) => update('ship_export_format', v)} options={EXPORT_FORMATS} placeholder="Select format…" />
              </FormField>
              <FormField label="Trigger event" required>
                <Select value={form.ship_export_trigger} onChange={(v) => update('ship_export_trigger', v)} options={EXPORT_TRIGGERS} placeholder="Select trigger…" />
              </FormField>
              <FormField label="Output file naming">
                <Input value={form.ship_export_naming} onChange={(v) => update('ship_export_naming', v)} mono placeholder="cust_fedex_{YYYYMMDD}_{HHMM}.csv" />
              </FormField>
            </div>

            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs uppercase tracking-wider font-semibold text-navy-700">Export columns (what Helm writes to each row)</div>
                <Button size="sm" variant="secondary" onClick={addShipCol}><Plus className="w-3.5 h-3.5 mr-1" />Add Column</Button>
              </div>
              <table className="w-full text-xs border border-gray-200 rounded">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-3 py-1.5">Export column</th>
                    <th className="text-left px-3 py-1.5">Helm value</th>
                    <th className="w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {form.ship_export_columns.length === 0 && (
                    <tr><td colSpan={3} className="text-center py-4 text-gray-400 italic">No columns defined.</td></tr>
                  )}
                  {form.ship_export_columns.map((row) => (
                    <tr key={row.id} className="border-t border-gray-200">
                      <td className="px-3 py-1.5"><Input value={row.export_col} onChange={(v) => updateShipCol(row.id, { export_col: v })} mono sm /></td>
                      <td className="px-3 py-1.5"><Input value={row.helm_value} onChange={(v) => updateShipCol(row.id, { helm_value: v })} mono sm placeholder="Helm field or literal: …" /></td>
                      <td className="px-3 py-1.5"><RemoveBtn onClick={() => removeShipCol(row.id)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="border-t border-gray-200"></div>

          {/* 5b — Packing List Archive */}
          <div>
            <h3 className="text-sm font-bold text-navy-900 mb-2 flex items-center gap-2"><Archive className="w-4 h-4" /> 5b · Packing List Archive</h3>
            <p className="text-xs text-gray-500 mb-3 italic">Helm writes each packing list to this archive folder. Used for compliance, dispute resolution, and audit.</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              <FormField label="Archive folder" required hint="Tokens supported in path: {YYYY} {MM} {DD}">
                <Input value={form.archive_folder} onChange={(v) => update('archive_folder', v)} mono placeholder="\\adt-nas\archive\…\{YYYY}\{MM}\" />
              </FormField>
              <FormField label="Archive format" required>
                <Select value={form.archive_format} onChange={(v) => update('archive_format', v)} options={ARCHIVE_FORMATS} placeholder="Select format…" />
              </FormField>
              <FormField label="Archive file naming">
                <Input value={form.archive_naming} onChange={(v) => update('archive_naming', v)} mono placeholder="cust_pl_{order_number}_{YYYYMMDD}.pdf" />
              </FormField>
              <FormField label="Retention (days)" hint="Helm retains and is responsible for deletion after retention window">
                <Input value={form.archive_retention_days} onChange={(v) => update('archive_retention_days', v)} mono />
              </FormField>
            </div>
          </div>

          <div className="border-t border-gray-200"></div>

          {/* 5c — Hot Folder Routing */}
          <div>
            <h3 className="text-sm font-bold text-navy-900 mb-2 flex items-center gap-2"><FolderInput className="w-4 h-4" /> 5c · Hot Folder Routing (production)</h3>
            <p className="text-xs text-gray-500 mb-3 italic">When C9 (Design File Routing) sends a print file, it lands in the default hot folder unless a per-fabric override applies.</p>
            <FormField label="Default hot folder" required>
              <Select value={form.default_hot_folder} onChange={(v) => update('default_hot_folder', v)} options={HOT_FOLDERS} placeholder="Select printer hot folder…" />
            </FormField>
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs uppercase tracking-wider font-semibold text-navy-700">Per-fabric overrides</div>
                <Button size="sm" variant="secondary" onClick={addHotFolder}><Plus className="w-3.5 h-3.5 mr-1" />Add Override</Button>
              </div>
              <table className="w-full text-xs border border-gray-200 rounded">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-3 py-1.5">Fabric</th>
                    <th className="text-left px-3 py-1.5">→ Hot folder</th>
                    <th className="w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {form.hot_folder_overrides.length === 0 && (
                    <tr><td colSpan={3} className="text-center py-4 text-gray-400 italic">No overrides — all jobs route to default.</td></tr>
                  )}
                  {form.hot_folder_overrides.map((row) => (
                    <tr key={row.id} className="border-t border-gray-200">
                      <td className="px-3 py-1.5"><Select value={row.fabric} onChange={(v) => updateHotFolder(row.id, { fabric: v })} options={FABRIC_OPTIONS} sm placeholder="Select fabric…" /></td>
                      <td className="px-3 py-1.5"><Select value={row.hot_folder} onChange={(v) => updateHotFolder(row.id, { hot_folder: v })} options={HOT_FOLDERS} sm placeholder="Select hot folder…" /></td>
                      <td className="px-3 py-1.5"><RemoveBtn onClick={() => removeHotFolder(row.id)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </Card>

      {/* SECTION 6 — Fulfillment + Production Defaults side-by-side */}
      {/* SECTION 6 — Fulfillment Model (full-width; per-SKU production rules live in Section 4) */}
      <Card className="mb-5">
        <CardHeader title="6 · Fulfillment Model" subtitle="Customer-wide fulfillment + label generation rules" />
        <div className="p-5 grid grid-cols-2 gap-x-6 gap-y-3">
          <FormField label="Fulfillment mode" required>
            <Select value={form.fulfillment_mode} onChange={(v) => update('fulfillment_mode', v)} options={FULFILLMENT_MODES} placeholder="Select fulfillment mode…" />
          </FormField>
          <FormField label="Preferred carrier">
            <Select value={form.preferred_carrier} onChange={(v) => update('preferred_carrier', v)} options={CARRIERS} placeholder="Select carrier…" />
          </FormField>
          <FormField label="Label mode" required hint="How shipping labels are generated for this customer (4 modes + N/A)" className="col-span-2">
            <Select value={form.label_mode} onChange={(v) => update('label_mode', v)} options={LABEL_MODES} placeholder="Select label mode…" />
          </FormField>
          <FormField label="Blind ship default" className="col-span-2">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.blind_ship_default} onChange={(e) => update('blind_ship_default', e.target.checked)} className="w-4 h-4" />
              Blind ship (no ADT branding on outer package)
            </label>
          </FormField>
        </div>
      </Card>

      {/* SECTION 8 — Test */}
      <Card className="mb-5">
        <CardHeader title="8 · Test & Validate" subtitle="Upload a sample file · Helm parses it against the mappings above and shows what records would be created · NO records are actually saved" />
        <div className="p-5 grid grid-cols-2 gap-6">
          <div>
            <div className="text-xs uppercase tracking-wider font-semibold text-gray-700 mb-2">Sample file</div>
            <div className="border-2 border-dashed border-gray-300 rounded p-6 text-center">
              <Upload className="w-8 h-8 mx-auto text-gray-400 mb-2" />
              <div className="text-sm text-gray-600">Drop a CSV / XML sample here, or</div>
              <Button variant="secondary" size="sm" className="mt-2">Browse files</Button>
            </div>
            <div className="mt-3 flex gap-2">
              <Button variant="secondary" size="sm"><FileCheck className="w-3.5 h-3.5 mr-1" />Validate mappings</Button>
              <Button size="sm">Test Parse</Button>
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider font-semibold text-gray-700 mb-2">Test result</div>
            <div className="border border-gray-200 rounded p-4 text-xs text-gray-400 italic min-h-[140px]">
              Upload a sample file and click "Test Parse" to see how Helm would interpret each row, what records it would create, and which rows would fail validation.
            </div>
          </div>
        </div>
      </Card>

      {/* Sticky action bar */}
      <div className="fixed bottom-0 left-60 right-0 bg-white border-t border-gray-200 px-6 py-3 flex items-center justify-between shadow-lg">
        <div className="text-xs text-gray-500">
          {isNew
            ? <span><strong>New customer config</strong> · unsaved</span>
            : <span>Editing <strong>{form.customer_name}</strong> · status <Tag color={form.status === 'Active' ? 'green' : form.status === 'Draft' ? 'yellow' : 'gray'}>{form.status}</Tag></span>
          }
        </div>
        <div className="flex gap-2">
          <Button variant="ghost">Cancel</Button>
          <Button variant="secondary">Save Draft</Button>
          <Button>{isNew ? 'Create & Activate' : 'Save & Activate'}</Button>
        </div>
      </div>

      {/* SKU edit drawer */}
      {editingSkuId && (
        <SKUEditDrawer
          row={form.sku_mapping.find((s) => s.id === editingSkuId)!}
          onChange={(patch) => updateSKUMap(editingSkuId, patch)}
          onDelete={() => { removeSKUMap(editingSkuId); setEditingSkuId(null); }}
          onClose={() => setEditingSkuId(null)}
        />
      )}

      {/* Bulk import modal */}
      {showImport && <ImportDialog customer={form.customer_name || 'this customer'} onClose={() => setShowImport(false)} />}
    </div>
  );
}

// =====================================================================
// SKU Mapping section (scale-aware) — browse / search / filter / edit one
// =====================================================================

function SKUMappingSection({
  rows, skuSearch, setSkuSearch, skuFilterFabric, setSkuFilterFabric, skuFilterStrikeoff, setSkuFilterStrikeoff,
  onImport, onAddSingle, onEdit, totalSkusForCustomer,
}: {
  rows: SKUMapRow[];
  skuSearch: string; setSkuSearch: (s: string) => void;
  skuFilterFabric: string; setSkuFilterFabric: (s: string) => void;
  skuFilterStrikeoff: string; setSkuFilterStrikeoff: (s: string) => void;
  onImport: () => void;
  onAddSingle: () => void;
  onEdit: (id: string) => void;
  totalSkusForCustomer: number;
}) {
  // Apply visible-row filters (search + fabric + strike-off)
  const filtered = rows.filter((r) => {
    if (skuSearch && !`${r.customer_sku} ${r.adt_sku} ${r.design}`.toLowerCase().includes(skuSearch.toLowerCase())) return false;
    if (skuFilterFabric && r.fabric !== skuFilterFabric) return false;
    if (skuFilterStrikeoff && r.strikeoff_rule !== skuFilterStrikeoff) return false;
    return true;
  });

  return (
    <Card className="mb-5">
      <CardHeader
        title="4 · SKU Mapping + Per-SKU Production Rules"
        subtitle="Customer SKU → ADT SKU / Design / Colorway / Fabric · plus Print Profile, Strike-Off Rule, and Strike-Off Approval per SKU · designed for scale (thousands of SKUs per customer)"
        action={
          <div className="flex gap-2">
            <Button onClick={onImport} size="sm"><Upload className="w-3.5 h-3.5 mr-1" />Import CSV / Excel</Button>
            <Button variant="secondary" size="sm"><Download className="w-3.5 h-3.5 mr-1" />Export</Button>
            <Button variant="secondary" size="sm" onClick={onAddSingle}><Plus className="w-3.5 h-3.5 mr-1" />Add Single SKU</Button>
            <Button variant="secondary" size="sm"><Wand2 className="w-3.5 h-3.5 mr-1" />Bulk Apply Rule…</Button>
          </div>
        }
      />

      {/* Summary bar */}
      <div className="px-5 py-2.5 bg-gray-50 border-b border-gray-200 flex items-center justify-between text-xs">
        <div className="text-gray-700">
          <strong className="font-mono">{totalSkusForCustomer.toLocaleString()}</strong> active SKU mappings ·
          <span className="ml-2">Last bulk import: 2 days ago by <strong>Megan B.</strong> (added 195, updated 47, 0 errors)</span>
        </div>
        <div className="text-gray-500">
          <span className="text-green-700 font-semibold">0 errors</span> · 0 unresolved fabrics · 0 duplicate Customer SKUs
        </div>
      </div>

      {/* Search + filter bar */}
      <div className="px-5 py-3 flex items-center gap-2 border-b border-gray-200">
        <div className="flex-1 relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-gray-400" />
          <input
            type="text"
            value={skuSearch}
            onChange={(e) => setSkuSearch(e.target.value)}
            placeholder="Search by Customer SKU, ADT SKU, or Design…"
            className="w-full pl-8 pr-3 py-1.5 border border-gray-300 rounded text-sm"
          />
        </div>
        <select
          value={skuFilterFabric}
          onChange={(e) => setSkuFilterFabric(e.target.value)}
          className="border border-gray-300 rounded px-2 py-1.5 text-sm bg-white"
        >
          <option value="">All fabrics</option>
          {FABRIC_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
        <select
          value={skuFilterStrikeoff}
          onChange={(e) => setSkuFilterStrikeoff(e.target.value)}
          className="border border-gray-300 rounded px-2 py-1.5 text-sm bg-white"
        >
          <option value="">All strike-off rules</option>
          {STRIKEOFF_RULES.map((o) => <option key={o} value={o}>{o.split(' — ')[0]}</option>)}
        </select>
      </div>

      {/* Compact read-only table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="text-gray-500 uppercase tracking-wider border-b border-gray-200 bg-gray-50">
            <tr>
              <th className="text-left px-3 py-2">Customer SKU</th>
              <th className="text-left px-3 py-2">ADT SKU</th>
              <th className="text-left px-3 py-2">Design</th>
              <th className="text-left px-3 py-2">Colorway</th>
              <th className="text-left px-3 py-2">Fabric</th>
              <th className="text-left px-3 py-2 bg-navy-50">Print Profile</th>
              <th className="text-left px-3 py-2 bg-navy-50">Strike-Off</th>
              <th className="text-right px-3 py-2 pr-5">Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={8} className="text-center py-8 text-sm text-gray-400 italic">No SKU mappings match these filters. Try Import to bring in a full mapping.</td></tr>
            )}
            {filtered.map((row) => {
              const strikeShort = row.strikeoff_rule.split(' — ')[0] || row.strikeoff_rule || '—';
              const profileShort = row.print_profile.split(' · ')[0] || row.print_profile || '—';
              return (
                <tr key={row.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-3 py-1.5 font-mono">{row.customer_sku || <span className="text-gray-400 italic">(new)</span>}</td>
                  <td className="px-3 py-1.5 font-mono text-navy-700">{row.adt_sku || <span className="text-gray-400 italic">—</span>}</td>
                  <td className="px-3 py-1.5">{row.design || <span className="text-gray-400 italic">—</span>}</td>
                  <td className="px-3 py-1.5">{row.colorway || <span className="text-gray-400 italic">—</span>}</td>
                  <td className="px-3 py-1.5">{row.fabric || <span className="text-gray-400 italic">—</span>}</td>
                  <td className="px-3 py-1.5 bg-navy-50/30 text-[11px]">{profileShort}</td>
                  <td className="px-3 py-1.5 bg-navy-50/30">
                    <Tag color={strikeShort === 'Always' ? 'red' : strikeShort === 'Never' ? 'gray' : strikeShort.startsWith('First-run') ? 'yellow' : strikeShort.startsWith('New') ? 'blue' : 'gray'}>{strikeShort}</Tag>
                  </td>
                  <td className="px-3 py-1.5 text-right pr-5">
                    <button onClick={() => onEdit(row.id)} className="text-navy-700 hover:underline text-xs font-semibold inline-flex items-center gap-1">
                      <Pencil className="w-3 h-3" /> Edit
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination footer */}
      <div className="px-5 py-2.5 border-t border-gray-200 flex items-center justify-between text-xs text-gray-600">
        <div>Showing <strong>{filtered.length}</strong> of <strong className="font-mono">{totalSkusForCustomer.toLocaleString()}</strong> mappings {(skuSearch || skuFilterFabric || skuFilterStrikeoff) && <span className="text-gray-500 italic ml-1">(filtered view)</span>}</div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" disabled>← Previous</Button>
          <span className="px-2">Page 1 of {Math.max(1, Math.ceil(totalSkusForCustomer / 50)).toLocaleString()}</span>
          <Button variant="secondary" size="sm">Next →</Button>
        </div>
      </div>
    </Card>
  );
}

// =====================================================================
// SKU edit drawer — focused edit of one SKU
// =====================================================================

function SKUEditDrawer({
  row, onChange, onDelete, onClose,
}: {
  row: SKUMapRow;
  onChange: (patch: Partial<SKUMapRow>) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-40 flex">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30" onClick={onClose}></div>
      {/* Drawer */}
      <div className="ml-auto relative w-[480px] bg-white shadow-2xl h-full flex flex-col">
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-wider text-gray-500">Edit SKU mapping</div>
            <div className="font-mono text-sm font-semibold mt-0.5">{row.customer_sku || 'New SKU'}</div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div>
            <div className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-2">Identity</div>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Customer SKU" required>
                <Input value={row.customer_sku} onChange={(v) => onChange({ customer_sku: v })} mono />
              </FormField>
              <FormField label="ADT SKU" required>
                <Input value={row.adt_sku} onChange={(v) => onChange({ adt_sku: v })} mono />
              </FormField>
              <FormField label="Design">
                <Input value={row.design} onChange={(v) => onChange({ design: v })} />
              </FormField>
              <FormField label="Colorway">
                <Input value={row.colorway} onChange={(v) => onChange({ colorway: v })} />
              </FormField>
              <FormField label="Fabric" required className="col-span-2">
                <Select value={row.fabric} onChange={(v) => onChange({ fabric: v })} options={FABRIC_OPTIONS} placeholder="Select fabric…" />
              </FormField>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-4">
            <div className="text-xs uppercase tracking-wider text-navy-700 font-semibold mb-2">Production Rules (per SKU)</div>
            <div className="space-y-3">
              <FormField label="Print Profile" required>
                <Select value={row.print_profile} onChange={(v) => onChange({ print_profile: v })} options={PRINT_PROFILES} placeholder="Select profile…" />
              </FormField>
              <FormField label="Strike-Off Rule" required>
                <Select value={row.strikeoff_rule} onChange={(v) => onChange({ strikeoff_rule: v })} options={STRIKEOFF_RULES} placeholder="Select rule…" />
              </FormField>
              <FormField label="Strike-Off Approval" required>
                <Select value={row.strikeoff_approval} onChange={(v) => onChange({ strikeoff_approval: v })} options={['N/A', ...STRIKEOFF_APPROVAL]} placeholder="Select approval…" />
              </FormField>
            </div>
          </div>
        </div>

        <div className="px-5 py-3 border-t border-gray-200 flex items-center justify-between">
          <Button variant="ghost" onClick={onDelete}>
            <Trash2 className="w-3.5 h-3.5 mr-1 text-red-600" />
            <span className="text-red-600">Delete SKU</span>
          </Button>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button onClick={onClose}>Save</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// =====================================================================
// Bulk import dialog — demonstrates the import preview / validate / commit flow
// =====================================================================

function ImportDialog({ customer, onClose }: { customer: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-black/40" onClick={onClose}></div>
      <div className="relative bg-white rounded shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col">
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <div className="text-base font-bold text-navy-900">Import SKU Mappings — {customer}</div>
            <div className="text-xs text-gray-500 mt-0.5">CSV or Excel · expected columns: customer_sku · adt_sku · design · colorway · fabric · print_profile · strikeoff_rule · strikeoff_approval</div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Step 1: Upload */}
          <div>
            <div className="text-xs uppercase tracking-wider font-semibold text-gray-700 mb-2">Step 1 · Upload file</div>
            <div className="border-2 border-dashed border-gray-300 rounded p-6 text-center">
              <Upload className="w-8 h-8 mx-auto text-gray-400 mb-2" />
              <div className="text-sm text-gray-600 mb-2">Drag a CSV / Excel file here</div>
              <Button variant="secondary" size="sm">Browse files</Button>
              <div className="text-[11px] text-gray-500 mt-2">
                <a className="text-navy-700 hover:underline">Download template</a> · <a className="text-navy-700 hover:underline">Export current mapping as starting point</a>
              </div>
            </div>
          </div>

          {/* Step 2: Map columns */}
          <div>
            <div className="text-xs uppercase tracking-wider font-semibold text-gray-700 mb-2">Step 2 · Confirm column mapping</div>
            <table className="w-full text-xs border border-gray-200 rounded">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-3 py-1.5">File column</th>
                  <th className="text-left px-3 py-1.5">→ SKU field</th>
                  <th className="text-center px-3 py-1.5 w-20">Required</th>
                </tr>
              </thead>
              <tbody className="text-gray-500 italic">
                <tr><td colSpan={3} className="text-center py-3">Column mapping will populate after a file is uploaded.</td></tr>
              </tbody>
            </table>
          </div>

          {/* Step 3: Validate */}
          <div>
            <div className="text-xs uppercase tracking-wider font-semibold text-gray-700 mb-2">Step 3 · Validate</div>
            <div className="text-xs text-gray-600 italic">After upload, Helm validates every row against the customer's allowed fabrics, design library, and existing SKU rules. Rows with errors are listed here so admin can fix and re-upload.</div>
            <div className="mt-3 grid grid-cols-4 gap-3 text-xs">
              <div className="border border-gray-200 rounded p-3"><div className="text-gray-500">Rows parsed</div><div className="font-mono text-lg">—</div></div>
              <div className="border border-green-300 bg-green-50 rounded p-3"><div className="text-green-700">Will add</div><div className="font-mono text-lg">—</div></div>
              <div className="border border-yellow-300 bg-yellow-50 rounded p-3"><div className="text-yellow-700">Will update</div><div className="font-mono text-lg">—</div></div>
              <div className="border border-red-300 bg-red-50 rounded p-3"><div className="text-red-700">Errors</div><div className="font-mono text-lg">—</div></div>
            </div>
          </div>

          {/* Step 4: Commit */}
          <div>
            <div className="text-xs uppercase tracking-wider font-semibold text-gray-700 mb-2">Step 4 · Commit import</div>
            <div className="text-xs text-gray-600 italic">No data is changed until you click "Commit Import" below. Helm writes an audit event recording the file, the admin, the row counts, and a snapshot of the prior state (so the import can be reverted from System Admin if needed).</div>
          </div>
        </div>

        <div className="px-5 py-3 border-t border-gray-200 flex items-center justify-between">
          <span className="text-xs text-gray-500 italic">No file uploaded yet</span>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button variant="secondary" disabled>Validate</Button>
            <Button disabled>Commit Import</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// =====================================================================
// Form bits
// =====================================================================

function FormField({ label, hint, required, className, children }: { label: string; hint?: string; required?: boolean; className?: string; children: React.ReactNode }) {
  return (
    <div className={className}>
      <label className="block text-xs font-semibold text-gray-700 mb-1">
        {label}{required && <span className="text-red-600 ml-0.5">*</span>}
      </label>
      {hint && <div className="text-[10px] text-gray-500 mb-1 italic">{hint}</div>}
      {children}
    </div>
  );
}

function Input({ value, onChange, placeholder, mono, sm }: { value: string; onChange: (v: string) => void; placeholder?: string; mono?: boolean; sm?: boolean }) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full border border-gray-300 rounded ${sm ? 'px-2 py-1 text-xs' : 'px-2.5 py-1.5 text-sm'} ${mono ? 'font-mono' : ''}`}
    />
  );
}

function Select({ value, onChange, options, placeholder, sm }: { value: string; onChange: (v: string) => void; options: string[]; placeholder?: string; sm?: boolean }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full border border-gray-300 rounded bg-white ${sm ? 'px-2 py-1 text-xs' : 'px-2.5 py-1.5 text-sm'}`}
    >
      <option value="">{placeholder ?? 'Select…'}</option>
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

function RemoveBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      type="button"
      title="Remove row"
      className="w-6 h-6 rounded text-red-600 hover:bg-red-50 flex items-center justify-center"
    >
      <Trash2 className="w-3.5 h-3.5" />
    </button>
  );
}
