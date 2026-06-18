'use client';

import { useState } from 'react';
import { Plus, Trash2, Upload, FileCheck, FolderInput, FolderOutput, Archive, KeyRound } from 'lucide-react';
import { Card, CardHeader, Tag, Button } from '@/components/ui';

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
const COLORISTS = ['Jeannine Rivera', 'Maya Chen', 'Auto-assign (round-robin)'];
const FABRIC_OPTIONS = ['Cotton Sateen 110-thread', 'Cotton Sateen 90-thread', 'Linen Blend Natural', 'Velvet Cotton', 'Textured Linen', 'Performance Outdoor'];
const HOT_FOLDERS = ['MS JP4 hot folder', 'MS JP7 hot folder', 'Durst Alpha 330 hot folder', 'Zimmer Colaris hot folder', 'HP Latex 830W hot folder', 'HP Latex 800W hot folder'];

// =====================================================================
// Initial form values for a preset (rough mock — fields admins would tweak)
// =====================================================================

type FieldMappingRow = { id: string; source_col: string; helm_field: string; required: boolean; default_value: string; transform: string; notes: string };
type SKUMapRow = { id: string; customer_sku: string; adt_sku: string; design: string; colorway: string; fabric: string };
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
  default_print_profile: '',
  strikeoff_rule: '',
  strikeoff_approval: '',
  default_colorist: '',
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
    { id: 's1', customer_sku: 'SF-CYP-Y15', adt_sku: 'CYP-IND-Yardage', design: 'Cypress',  colorway: 'Indigo', fabric: 'Cotton Sateen 110-thread' },
    { id: 's2', customer_sku: 'SF-MAR-Y15', adt_sku: 'MAR-WHT-Yardage', design: 'Marigold', colorway: 'White',  fabric: 'Linen Blend Natural' },
    { id: 's3', customer_sku: 'SF-COR-Y15', adt_sku: 'COR-PINK-Yardage', design: 'Coral',   colorway: 'Pink',   fabric: 'Cotton Sateen 90-thread' },
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
  default_hot_folder: HOT_FOLDERS[0],
  hot_folder_overrides: [
    { id: 'ho1', fabric: 'Linen Blend Natural', hot_folder: HOT_FOLDERS[1] },
  ],
  fulfillment_mode: FULFILLMENT_MODES[0],
  label_mode: LABEL_MODES[3],
  blind_ship_default: false,
  preferred_carrier: CARRIERS[1],
  default_print_profile: PRINT_PROFILES[0],
  strikeoff_rule: STRIKEOFF_RULES[1],
  strikeoff_approval: STRIKEOFF_APPROVAL[0],
  default_colorist: COLORISTS[0],
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
    { id: 's1', customer_sku: 'CYP-IND-PLW-18', adt_sku: 'PLW-CYP-18x18', design: 'Cypress',  colorway: 'Indigo', fabric: 'Cotton Sateen 110-thread' },
    { id: 's2', customer_sku: 'CYP-IND-PLW-20', adt_sku: 'PLW-CYP-20x20', design: 'Cypress',  colorway: 'Indigo', fabric: 'Cotton Sateen 110-thread' },
    { id: 's3', customer_sku: 'MAR-WHT-PLW-14', adt_sku: 'PLW-MAR-14x14', design: 'Marigold', colorway: 'White',  fabric: 'Linen Blend Natural' },
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
  label_mode: LABEL_MODES[0],
  blind_ship_default: true,
  preferred_carrier: CARRIERS[0],
  default_print_profile: PRINT_PROFILES[0],
  strikeoff_rule: STRIKEOFF_RULES[4],
  strikeoff_approval: 'N/A',
  default_colorist: COLORISTS[0],
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
                                      strikeoff_rule: STRIKEOFF_RULES[0], strikeoff_approval: STRIKEOFF_APPROVAL[1] };
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
  const addSKUMap = () => setForm((f) => ({ ...f, sku_mapping: [...f.sku_mapping, { id: nextId(), customer_sku: '', adt_sku: '', design: '', colorway: '', fabric: '' }] }));
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
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-navy-900">Customer CSV/XML Configurations</h1>
        <p className="text-sm text-gray-500 mt-1">
          Admin tool for onboarding new CSV / XML / email-driven customers and editing existing pipelines · drives C9 (file routing + strike-off initiation) and C10 (CSV/XML intake) downstream.
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

      {/* SECTION 4 — SKU Mapping */}
      <Card className="mb-5">
        <CardHeader
          title="4 · SKU Mapping"
          subtitle="Customer SKU → ADT SKU / Design / Colorway / Fabric"
          action={
            <div className="flex gap-2">
              <Button variant="secondary" size="sm"><Upload className="w-3.5 h-3.5 mr-1" />Bulk Import</Button>
              <Button size="sm" onClick={addSKUMap}><Plus className="w-3.5 h-3.5 mr-1" />Add SKU</Button>
            </div>
          }
        />
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-gray-500 uppercase tracking-wider border-b border-gray-200">
              <tr>
                <th className="text-left px-3 py-2">Customer SKU</th>
                <th className="text-left px-3 py-2">ADT SKU</th>
                <th className="text-left px-3 py-2">Design</th>
                <th className="text-left px-3 py-2">Colorway</th>
                <th className="text-left px-3 py-2">Fabric</th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody>
              {form.sku_mapping.length === 0 && (
                <tr><td colSpan={6} className="text-center py-6 text-sm text-gray-400 italic">No SKU mappings yet.</td></tr>
              )}
              {form.sku_mapping.map((row) => (
                <tr key={row.id} className="border-t border-gray-100">
                  <td className="px-3 py-1.5"><Input value={row.customer_sku} onChange={(v) => updateSKUMap(row.id, { customer_sku: v })} mono sm /></td>
                  <td className="px-3 py-1.5"><Input value={row.adt_sku} onChange={(v) => updateSKUMap(row.id, { adt_sku: v })} mono sm /></td>
                  <td className="px-3 py-1.5"><Input value={row.design} onChange={(v) => updateSKUMap(row.id, { design: v })} sm /></td>
                  <td className="px-3 py-1.5"><Input value={row.colorway} onChange={(v) => updateSKUMap(row.id, { colorway: v })} sm /></td>
                  <td className="px-3 py-1.5"><Select value={row.fabric} onChange={(v) => updateSKUMap(row.id, { fabric: v })} options={FABRIC_OPTIONS} sm placeholder="Select fabric…" /></td>
                  <td className="px-3 py-1.5"><RemoveBtn onClick={() => removeSKUMap(row.id)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

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
      <div className="grid grid-cols-2 gap-5 mb-5">
        <Card>
          <CardHeader title="6 · Fulfillment Model" />
          <div className="p-5 space-y-3">
            <FormField label="Fulfillment mode" required>
              <Select value={form.fulfillment_mode} onChange={(v) => update('fulfillment_mode', v)} options={FULFILLMENT_MODES} placeholder="Select fulfillment mode…" />
            </FormField>
            <FormField label="Label mode" hint="Determines how shipping labels are generated for this customer">
              <Select value={form.label_mode} onChange={(v) => update('label_mode', v)} options={LABEL_MODES} placeholder="Select label mode…" />
            </FormField>
            <FormField label="Preferred carrier">
              <Select value={form.preferred_carrier} onChange={(v) => update('preferred_carrier', v)} options={CARRIERS} placeholder="Select carrier…" />
            </FormField>
            <FormField label="Blind ship default">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.blind_ship_default} onChange={(e) => update('blind_ship_default', e.target.checked)} className="w-4 h-4" />
                Blind ship (no ADT branding on outer package)
              </label>
            </FormField>
          </div>
        </Card>

        <Card>
          <CardHeader title="7 · Production Defaults" />
          <div className="p-5 space-y-3">
            <FormField label="Default Print Profile">
              <Select value={form.default_print_profile} onChange={(v) => update('default_print_profile', v)} options={PRINT_PROFILES} placeholder="Select default print profile…" />
            </FormField>
            <FormField label="Strike-off rule">
              <Select value={form.strikeoff_rule} onChange={(v) => update('strikeoff_rule', v)} options={STRIKEOFF_RULES} placeholder="Select strike-off rule…" />
            </FormField>
            <FormField label="Strike-off approval path">
              <Select value={form.strikeoff_approval} onChange={(v) => update('strikeoff_approval', v)} options={STRIKEOFF_APPROVAL} placeholder="Select approval path…" />
            </FormField>
            <FormField label="Default Colorist">
              <Select value={form.default_colorist} onChange={(v) => update('default_colorist', v)} options={COLORISTS} placeholder="Select default colorist…" />
            </FormField>
          </div>
        </Card>
      </div>

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
