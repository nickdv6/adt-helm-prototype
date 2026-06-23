/**
 * Helm Prototype — Seed Data Generator
 *
 * Generates a "larger fake dataset" per Nick 2026-05-14:
 *   - 8 users (one per role family)
 *   - 15 companies (incl. all 5 CSV/XML intake customers + Shopify-A + Shopify-B + 8 generic)
 *   - ~30 contacts
 *   - ~40 fabrics
 *   - ~120 designs (PLANT# P25-#### + P26-####)
 *   - ~240 colorways
 *   - ~200 SKUs across product types
 *   - 7 printers (Durst Alpha 330, MS JP7, MS JP4-A, MS JP4-B, HP Latex 830W, HP Latex 800W, Zimmer Colaris)
 *   - ~40 print profiles
 *   - ~30 packaging profiles
 *   - 250+ orders spanning the last 18 months (mix of statuses)
 *   - 400+ print requests (mix of statuses, some with internal proof pending)
 *   - ~80 strike-offs (mix of outcomes incl. Approve with Changes)
 *   - ~120 FPRs
 *   - inventory items + customer materials (per-PR + open-bank)
 *   - 5 intake configs (St Frank / Inside / Lemieux / Laura Park / Fabric Megastore)
 *   - ~30 notifications for active CSR/Megan/Jeannine
 *
 * Run with: npm run seed
 */
import Database from 'better-sqlite3';
import { readFileSync, existsSync, mkdirSync, unlinkSync } from 'fs';
import path from 'path';
import { faker } from '@faker-js/faker';

faker.seed(42); // deterministic

const DB_PATH = path.join(process.cwd(), 'data', 'helm.db');
const SCHEMA_PATH = path.join(process.cwd(), 'src', 'db', 'schema.sql');

// Ensure data dir + clean slate
if (!existsSync(path.dirname(DB_PATH))) {
  mkdirSync(path.dirname(DB_PATH), { recursive: true });
}
if (existsSync(DB_PATH)) unlinkSync(DB_PATH);

const db = new Database(DB_PATH);
db.pragma('foreign_keys = ON');

console.log('Creating schema...');
db.exec(readFileSync(SCHEMA_PATH, 'utf-8'));

console.log('Seeding users...');
const users = [
  ['nick@adt.com', 'Nick Del Verme', 'admin'],
  ['megan@adt.com', 'Megan Burleson', 'prod_mgr'],
  ['sarah.csr@adt.com', 'Sarah Castillo', 'csr'],
  ['drew.sales@adt.com', 'Drew Walters', 'sales'],
  ['jeannine@adt.com', 'Jeannine Romero', 'colorist'],
  ['maya@adt.com', 'Maya Chen', 'colorist'],
  ['julio@adt.com', 'Julio Vargas', 'print_op'],
  ['lucio@adt.com', 'Lucio Hernandez', 'finishing'],
  ['yuliana@adt.com', 'Yuliana Cruz', 'cut_sew'],
  ['karen.purchasing@adt.com', 'Karen Boyd', 'inventory'],
  ['marcus.ship@adt.com', 'Marcus Hill', 'shipping'],
  ['tomas.receiving@adt.com', 'Tomás Rivera', 'receiving'],
  ['diana.acct@adt.com', 'Diana Park', 'accounting'],
];
const insUser = db.prepare(
  'INSERT INTO users (email, full_name, primary_role) VALUES (?, ?, ?)',
);
users.forEach((u) => insUser.run(u[0], u[1], u[2]));
const userByRole: Record<string, number> = {};
db.prepare('SELECT id, primary_role FROM users')
  .all()
  .forEach((r: any) => (userByRole[r.primary_role] = r.id));
const userByEmail: Record<string, number> = {};
db.prepare('SELECT id, email FROM users')
  .all()
  .forEach((r: any) => (userByEmail[r.email] = r.id));
// Two colorists in the fleet — each owns specific printers (Assigned To on a PR = the colorist
// working that machine, per Nick).
const COLORIST_JEANNINE = userByEmail['jeannine@adt.com'];
const COLORIST_MAYA = userByEmail['maya@adt.com'];

console.log('Seeding companies...');
const namedCompanies = [
  { name: 'St Frank', industry: 'Home Goods', terms: 'NET 30', is_3pb: 1, carrier: 'UPS', acct: 'A1B2C3D4' },
  { name: 'Inside', industry: 'Home Goods', terms: 'NET 30', is_3pb: 1, carrier: 'UPS', acct: 'X9Y8Z7W6' },
  { name: 'Lemieux Et Cie', industry: 'Interior Design', terms: 'NET 30', is_3pb: 0, carrier: null, acct: null },
  { name: 'Laura Park Designs', industry: 'Interior Design', terms: 'NET 30', is_3pb: 0, carrier: null, acct: null },
  { name: 'Fabric Megastore', industry: 'Retail', terms: 'NET 30', is_3pb: 0, carrier: null, acct: null },
  { name: 'Havenly', industry: 'Interior Design', terms: 'NET 30', is_3pb: 0, carrier: null, acct: null },
  { name: 'Acme Interiors', industry: 'Interior Design', terms: 'NET 30', is_3pb: 0, carrier: null, acct: null },
  { name: 'Verdant Studio', industry: 'Home Goods', terms: 'NET 30', is_3pb: 0, carrier: null, acct: null },
];
const insCo = db.prepare(`
  INSERT INTO companies (name, industry, lifecycle_stage, payment_terms, is_third_party_billed,
                         carrier_account_number, carrier_account_carrier, primary_csr_user_id, sales_rep_user_id)
  VALUES (?, ?, 'Customer', ?, ?, ?, ?, ?, ?)
`);
namedCompanies.forEach((c) =>
  insCo.run(c.name, c.industry, c.terms, c.is_3pb, c.acct, c.carrier, userByRole['csr'], userByRole['sales']),
);
for (let i = 0; i < 7; i++) {
  insCo.run(
    faker.company.name(),
    faker.helpers.arrayElement(['Home Goods', 'Interior Design', 'Hospitality', 'Retail']),
    'NET 30',
    0,
    null,
    null,
    userByRole['csr'],
    userByRole['sales'],
  );
}
const companies = db.prepare('SELECT id, name FROM companies').all() as { id: number; name: string }[];

console.log('Seeding contacts + addresses...');
const insContact = db.prepare(`
  INSERT INTO contacts (company_id, first_name, last_name, email, phone, job_title, is_primary)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);
const insAddr = db.prepare(`
  INSERT INTO ship_to_addresses (company_id, name, street1, city, state, postal_code, country, is_default)
  VALUES (?, ?, ?, ?, ?, ?, 'USA', ?)
`);
companies.forEach((c) => {
  const n = faker.number.int({ min: 1, max: 3 });
  for (let i = 0; i < n; i++) {
    const fn = faker.person.firstName();
    const ln = faker.person.lastName();
    insContact.run(c.id, fn, ln, faker.internet.email({ firstName: fn, lastName: ln, provider: 'company.com' }),
      faker.phone.number(), faker.person.jobTitle(), i === 0 ? 1 : 0);
  }
  const nAddr = faker.number.int({ min: 1, max: 2 });
  for (let i = 0; i < nAddr; i++) {
    insAddr.run(c.id, i === 0 ? 'HQ' : 'Warehouse',
      faker.location.streetAddress(), faker.location.city(),
      faker.location.state({ abbreviated: true }), faker.location.zipCode(),
      i === 0 ? 1 : 0);
  }
});

console.log('Seeding fabrics + printers + print profiles...');
const fabricNames = [
  'Cotton Sateen', 'Linen 110-Thread', 'Belgian Linen', 'Polyester Denver', 'Hemp Linen',
  'Cotton Twill', 'Velvet Cotton', 'Performance Linen', 'Outdoor Polyester', 'Silk Charmeuse',
  'Cotton Duck', 'Bull Denim', 'Cotton Voile', 'Sheer Linen', 'Heavy Linen',
  'Recycled Polyester', 'Organic Cotton', 'Wool Felt', 'Polyester Crepe', 'Eco Canvas',
];
const insFabric = db.prepare(`INSERT INTO fabrics (name, fiber_content, weight, width_inches) VALUES (?, ?, ?, ?)`);
fabricNames.forEach((n) =>
  insFabric.run(
    n,
    faker.helpers.arrayElement(['100% Cotton', '100% Linen', '100% Polyester', '55% Hemp / 45% Linen', '60% Cotton / 40% Recycled Poly']),
    faker.helpers.arrayElement(['6 oz', '8 oz', '10 oz', '12 oz']),
    faker.helpers.arrayElement([54, 56, 60, 108, 110]),
  ),
);
const fabrics = db.prepare('SELECT id, name FROM fabrics').all() as { id: number; name: string }[];

const insPrinter = db.prepare(`
  INSERT INTO printers (name, model, ink_set, workstation_location, status, throughput_yards_per_hour, throughput_notes)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);
// Real ADT printer fleet (7 machines) — corrected per Nick (printer spec table)
// Pretreatment requirements:
//   - Fiber Reactive printers (MS JP7)         → require Fiber Reactive prepped fabric
//   - Pigment printers (Durst Alpha 330, Zimmer Colaris) → require Pigment prepped fabric
//   - Dye Sublimation printers (MS JP4-A, MS JP4-B)      → print on PFP directly (no further pretreatment)
//   - Latex printers (HP Latex 800W, 830W)               → print on PFP directly (no further pretreatment)
const printerSpecs = [
  ['Durst Alpha 330',  'Durst Alpha 330',    'Pigment',          'Printer Room A', 'running',     150,  '150 yds/hr @ 126" width · 240 yds/hr @ 62" width'],
  ['MS JP7',           'MS JP7',             'Fiber Reactive',   'Printer Room B', 'running',     210,  null],
  ['MS JP4-A',         'MS JP4',             'Dye Sublimation',  'Printer Room C', 'running',     100,  'Transfer paper output → heat press (Lucio) per C24 batch-ticket flow'],
  ['MS JP4-B',         'MS JP4',             'Dye Sublimation',  'Printer Room C', 'idle',        100,  'Transfer paper output → heat press (Lucio) per C24 batch-ticket flow'],
  ['Zimmer Colaris',   'Zimmer Colaris',     'Pigment',          'Printer Room B', 'maintenance',  30,  null],
  ['HP Latex 800W',    'HP Latex 800W',      'Latex',            'Printer Room D', 'idle',         10,  null],
  ['HP Latex 830W',    'HP Latex 830W',      'Latex',            'Printer Room D', 'running',      10,  null],
];
printerSpecs.forEach((p) => insPrinter.run(...(p as any[])));
const printers = db.prepare('SELECT id, name, ink_set FROM printers').all() as { id: number; name: string; ink_set: string }[];

const insProfile = db.prepare(`
  INSERT INTO print_profiles (name, fabric_id, printer_id, ink_set, calibration_date, ref_number, status)
  VALUES (?, ?, ?, ?, ?, ?, 'active')
`);
// Sample profiles per S23-S32.44 naming convention
let profRef = 100;
fabrics.slice(0, 10).forEach((f) => {
  printers.slice(0, 4).forEach((p) => {
    if (Math.random() < 0.4) {
      const refNum = `PROF${String(profRef++).padStart(4, '0')}`;
      const cal = faker.date.recent({ days: 120 }).toISOString().slice(0, 10);
      const name = `${p.name.replace(/\s+/g, '')}_${f.name.replace(/\s+/g, '')}_${p.ink_set.replace(/\s+/g, '')}_${refNum}_${cal}`;
      insProfile.run(name, f.id, p.id, p.ink_set, cal, refNum);
    }
  });
});

console.log('Seeding designs + colorways + SKUs...');
const insDesign = db.prepare(`
  INSERT INTO designs (name, company_id, plant_number, plant_year, plant_sequence, lifecycle_status)
  VALUES (?, ?, ?, ?, ?, 'Active')
`);
const insColorway = db.prepare(`INSERT INTO colorways (design_id, name, color_code) VALUES (?, ?, ?)`);
let plant26 = 1000;
let plant25 = 1000;
for (let i = 0; i < 120; i++) {
  const co = faker.helpers.arrayElement(companies);
  const useYear = Math.random() < 0.7 ? 26 : 25;
  const seq = useYear === 26 ? plant26++ : plant25++;
  const plantNumber = `P${useYear}-${seq}`;
  const designName = faker.commerce.productName();
  insDesign.run(designName, co.id, plantNumber, 2000 + useYear, seq);
}
const designs = db.prepare('SELECT id, plant_number FROM designs').all() as { id: number; plant_number: string }[];
designs.forEach((d) => {
  const nColors = faker.number.int({ min: 1, max: 3 });
  const colorways = ['Ivory', 'Charcoal', 'Sage', 'Crimson', 'Navy', 'Off-White', 'Indigo', 'Terracotta', 'Mustard'];
  faker.helpers.arrayElements(colorways, nColors).forEach((c) =>
    insColorway.run(d.id, c, faker.color.rgb({ format: 'hex' })),
  );
});

const productTypes = ['yardage', 'pillow', 'curtain', 'tabletop', 'swatch'];
const insSku = db.prepare(`
  INSERT INTO skus (adt_sku, product_type, fabric_id, size, lifecycle_status)
  VALUES (?, ?, ?, ?, 'Active')
`);
let skuCounter = 1;
for (let i = 0; i < 200; i++) {
  const pt = faker.helpers.arrayElement(productTypes);
  const fab = faker.helpers.arrayElement(fabrics);
  const skuCode = `${pt.toUpperCase().slice(0, 3)}-${String(skuCounter++).padStart(4, '0')}`;
  insSku.run(skuCode, pt, fab.id, faker.helpers.arrayElement(['20x20', '24x24', '36W', '72W', '50yd', '1yd']));
}
const skus = db.prepare('SELECT id, product_type, fabric_id FROM skus').all() as { id: number; product_type: string; fabric_id: number }[];

console.log('Seeding packaging profiles (S40c — 22 fields)...');
const insPkg = db.prepare(`
  INSERT INTO packaging_profiles (name, company_id, product_type, is_default_for_combo, packaging_type,
    insert_spec, label_spec, qty_per_package, packing_instructions, customer_specific_notes,
    last_updated_by_user_id, last_updated_at)
  VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
`);
const pkgCombos = [
  ['St Frank — Pillows', 'St Frank', 'pillow', 'poly_bag', 'St Frank-branded insert', 'Pre-printed St Frank label', 1, 'Pillow + insert + tissue', 'Inside-out fold'],
  ['St Frank — Curtains', 'St Frank', 'curtain', 'tube', 'None', 'Pre-printed St Frank label', 1, 'Roll-fold; weights at bottom', 'Tube ID label on outside'],
  ['Inside — Pillows', 'Inside', 'pillow', 'poly_bag', 'Inside-branded hangtag', 'Inside SKU label', 1, 'Pillow + tissue paper interior', 'Use white tissue only'],
  ['Inside — Curtains', 'Inside', 'curtain', 'tube', 'None', 'Inside SKU label', 1, 'Roll-fold', null],
  ['Lemieux — Pillows', 'Lemieux Et Cie', 'pillow', 'box', 'Lemieux note card', 'Lemieux logo label', 1, 'Pillow + custom box + ribbon', null],
  ['Lemieux — Curtains', 'Lemieux Et Cie', 'curtain', 'tube', 'Care card', 'Lemieux logo label', 1, 'Roll-fold; weights inside tube', null],
  ['Laura Park — Pillows', 'Laura Park Designs', 'pillow', 'poly_bag', 'Custom hangtag', 'LP-branded label', 1, 'Standard pillow pack', null],
  ['Acme — Yardage', 'Acme Interiors', 'yardage', 'roll', 'None', 'Yardage barcode', 1, 'Roll on tube; identify by SKU label', null],
];
pkgCombos.forEach((p) => {
  const co = companies.find((c) => c.name === p[1]);
  if (co) {
    insPkg.run(p[0], co.id, p[2], p[3], p[4], p[5], p[6], p[7], p[8], userByRole['cut_sew']);
  }
});

// ============================================================
// Master SKUs — customer VPN → product type mapping (drives Insert Requirement)
// ============================================================
console.log('Seeding master SKUs (St Frank + others)...');
import { PRODUCT_TYPE_TO_INSERT } from '../src/lib/insert-mapping';
const insMasterSku = db.prepare(`
  INSERT INTO master_skus (vpn, product_type, insert_key, customer_id, notes)
  VALUES (?, ?, ?, ?, ?)
`);
const stFrank = companies.find((c) => c.name === 'St Frank');
const havenly = companies.find((c) => c.name === 'Inside') ?? companies.find((c) => c.name === 'Havenly');
const masterSkuRows: Array<[string, string, string | null, number | null, string | null]> = [
  // St Frank — full pillow + non-pillow range
  ['ST-PIL-1216-OUT', 'PIL_12x16_OUT', PRODUCT_TYPE_TO_INSERT['PIL_12x16_OUT'] ?? null, stFrank?.id ?? null, null],
  ['ST-PIL-1216-IN',  'PIL_12x16_IN',  PRODUCT_TYPE_TO_INSERT['PIL_12x16_IN']  ?? null, stFrank?.id ?? null, null],
  ['ST-PIL-1818-OUT', 'PIL_18x18_OUT', PRODUCT_TYPE_TO_INSERT['PIL_18x18_OUT'] ?? null, stFrank?.id ?? null, null],
  ['ST-PIL-1818-IN',  'PIL_18x18_IN',  PRODUCT_TYPE_TO_INSERT['PIL_18x18_IN']  ?? null, stFrank?.id ?? null, null],
  ['ST-PIL-2020-IN',  'PIL_20x20_IN',  PRODUCT_TYPE_TO_INSERT['PIL_20x20_IN']  ?? null, stFrank?.id ?? null, null],
  ['ST-PIL-2222-OUT', 'PIL_22x22_OUT', PRODUCT_TYPE_TO_INSERT['PIL_22x22_OUT'] ?? null, stFrank?.id ?? null, null],
  ['ST-PIL-2222-IN',  'PIL_22x22_IN',  PRODUCT_TYPE_TO_INSERT['PIL_22x22_IN']  ?? null, stFrank?.id ?? null, null],
  ['ST-PIL-2626-OUT', 'PIL_26x26_OUT', PRODUCT_TYPE_TO_INSERT['PIL_26x26_OUT'] ?? null, stFrank?.id ?? null, null],
  ['ST-PIL-2626-IN',  'PIL_26x26_IN',  PRODUCT_TYPE_TO_INSERT['PIL_26x26_IN']  ?? null, stFrank?.id ?? null, null],
  ['ST-NAP-2020',     'NAPKIN_20x20',  null, stFrank?.id ?? null, 'Non-pillow · NO INSERT'],
  ['ST-RUN-72',       'TABLE_RUNNER_72', null, stFrank?.id ?? null, 'Non-pillow · NO INSERT'],
  ['ST-TBL-60R',      'TABLECLOTH_60_ROUND', null, stFrank?.id ?? null, 'Non-pillow · NO INSERT'],
  // Inside / Havenly — pillows only (e-commerce stored inventory pattern)
  ['IH-CYP-PIL-18',   'PIL_18x18_OUT', PRODUCT_TYPE_TO_INSERT['PIL_18x18_OUT'] ?? null, havenly?.id ?? null, null],
  ['IH-CYP-PIL-22',   'PIL_22x22_OUT', PRODUCT_TYPE_TO_INSERT['PIL_22x22_OUT'] ?? null, havenly?.id ?? null, null],
  ['IH-MAR-PIL-14',   'PIL_16x26_IN',  PRODUCT_TYPE_TO_INSERT['PIL_16x26_IN']  ?? null, havenly?.id ?? null, null],
];
masterSkuRows.forEach((r) => insMasterSku.run(...r));
const masterByVpn = new Map<string, { product_type: string; insert_key: string | null }>();
masterSkuRows.forEach(([vpn, pt, ik]) => masterByVpn.set(vpn, { product_type: pt, insert_key: ik }));

// Pool of VPNs by customer used when seeding order lines (mix of mapped + intentionally unmapped
// VPNs so the Unknown-VPN exception path is exercised in mock data).
const vpnsByCustomerName: Record<string, string[]> = {
  'St Frank': ['ST-PIL-2222-OUT', 'ST-PIL-1818-IN', 'ST-PIL-2020-IN', 'ST-PIL-2626-OUT',
               'ST-NAP-2020', 'ST-RUN-72', 'ST-TBL-60R',
               'ST-UNKNOWN-9999'  /* intentionally unmapped — exercises mapping_status='unmapped' */],
  'Inside':   ['IH-CYP-PIL-18', 'IH-CYP-PIL-22', 'IH-MAR-PIL-14'],
  'Havenly':  ['IH-CYP-PIL-18', 'IH-CYP-PIL-22'],
};

console.log('Seeding artwork files (PLANT#_DESIGN_COLORWAY_VERSION)...');
const insArtwork = db.prepare(`
  INSERT INTO artwork_files (design_id, colorway_id, version_number, file_name, nas_path,
    status, is_original, date_received, submitted_by_user_id, dpi, color_profile,
    width_inches, height_inches, file_size_kb)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const ARTWORK_STATUSES = ['Approved', 'Approved', 'Approved', 'Pending Approval', 'Draft', 'Archived'];
const designsWithCo = db.prepare(`SELECT d.id, d.plant_number, d.name, d.company_id FROM designs d`).all() as any[];
const allColorwaysByDesign = new Map<number, { id: number; name: string }[]>();
db.prepare('SELECT id, design_id, name FROM colorways').all().forEach((c: any) => {
  if (!allColorwaysByDesign.has(c.design_id)) allColorwaysByDesign.set(c.design_id, []);
  allColorwaysByDesign.get(c.design_id)!.push(c);
});
designsWithCo.forEach((d) => {
  const cws = allColorwaysByDesign.get(d.id) ?? [{ id: 0, name: 'default' }];
  cws.forEach((cw) => {
    const versionCount = faker.number.int({ min: 1, max: 3 });
    for (let v = 1; v <= versionCount; v++) {
      const status = v === versionCount ? ARTWORK_STATUSES[faker.number.int({ min: 0, max: 2 })] : 'Archived';
      const fileName = `${d.plant_number}_${d.name.replace(/\s+/g, '-')}_${cw.name.replace(/\s+/g, '-')}_v${v}.tiff`;
      const nasPath = `\\\\nas\\artwork\\${d.plant_number}\\${fileName}`;
      insArtwork.run(
        d.id,
        cw.id || null,
        v,
        fileName,
        nasPath,
        status,
        v === 1 ? 1 : 0,
        faker.date.recent({ days: 120 }).toISOString(),
        userByRole['colorist'],
        faker.helpers.arrayElement([300, 600, 720]),
        faker.helpers.arrayElement(['Adobe RGB (1998)', 'sRGB IEC61966-2.1', 'ProPhoto RGB']),
        faker.number.float({ min: 24, max: 60, fractionDigits: 1 }),
        faker.number.float({ min: 24, max: 36, fractionDigits: 1 }),
        faker.number.int({ min: 1200, max: 48000 }),
      );
    }
  });
});

console.log('Seeding orders + lines + PRs (last 18 months)...');
const insOrder = db.prepare(`
  INSERT INTO orders (order_number, company_id, primary_contact_id, ship_to_address_id, roadmap,
    status, customer_facing_status, customer_requested_date, estimated_ship_date, adt_promised_date,
    po_number, source_system, primary_csr_user_id, assigned_to_user_id, subtotal, is_blind_ship, is_rush,
    approval_required, trigger_reason, trigger_source, approval_completed_at, approved_by_user_id,
    is_legacy, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

// Pre-approval statuses get an Estimated Ship Date only. ADT does not commit to a Promised
// Date until the order is approved for production (internally or by the customer).
const PRE_APPROVAL_STATUSES = new Set([
  'Draft', 'Validated', 'Waiting on Approval', 'Waiting on Customer', 'Waiting on Artwork',
]);
const insLine = db.prepare(`
  INSERT INTO order_lines (order_id, sku_id, design_id, colorway_id, fabric_id, quantity, quantity_unit, unit_price,
    strike_off_classification, colorist_user_id, is_click_and_print,
    vpn, product_type_from_master, insert_required, master_sku_mapping_status)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const insPR = db.prepare(`
  INSERT INTO print_requests (pr_number, order_line_id, printer_id, fabric_id, print_process, status,
    planned_yardage, printed_yardage, strike_off_classification, colorist_user_id,
    is_click_and_print, was_csv_auto_routed, internal_proof_status, internal_proof_requested_at,
    internal_proof_resolved_at, internal_proof_resolved_by_user_id, hot_folder_target, scheduled_at,
    assigned_to_user_id, created_at,
    traveler_qr_payload, traveler_composite_status, traveler_composite_file_path,
    composite_generated_at, composite_error)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

// Rolls are created at pack-out time only. Multi-roll-per-PR is the norm with overage/underage.
const insPRRoll = db.prepare(`
  INSERT INTO pr_rolls (pr_id, roll_number, yards, packed_at, packed_by_user_id, ship_status, shipped_at, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);
let rollSequence = 8400; // global roll counter — roll numbers are sequential physical-roll identifiers

const orderStatuses: { status: string; cfs: string; weight: number }[] = [
  { status: 'Draft', cfs: 'In Progress', weight: 3 },
  { status: 'Validated', cfs: 'In Progress', weight: 8 },
  { status: 'Waiting on Approval', cfs: 'Issue — Contact Us', weight: 4 },
  { status: 'In Production', cfs: 'In Progress', weight: 20 },
  { status: 'Partially Complete', cfs: 'In Progress', weight: 5 },
  { status: 'Ready to Ship', cfs: 'Ready', weight: 6 },
  { status: 'Shipped', cfs: 'Shipped', weight: 15 },
  { status: 'Invoiced', cfs: 'Shipped', weight: 10 },
  { status: 'Closed', cfs: 'Delivered', weight: 25 },
  { status: 'On Hold', cfs: 'Issue — Contact Us', weight: 2 },
  { status: 'Cancelled', cfs: 'Cancelled', weight: 2 },
];
function pickStatus() {
  const total = orderStatuses.reduce((s, o) => s + o.weight, 0);
  let r = Math.random() * total;
  for (const o of orderStatuses) {
    r -= o.weight;
    if (r <= 0) return o;
  }
  return orderStatuses[0];
}

const roadmaps = ['R1', 'R1', 'R1', 'R1', 'R2', 'R4', 'R4', 'R5', 'R7'] as const;
const sourceSystems = ['manual', 'manual', 'manual', 'csv_import_st_frank', 'csv_import_inside',
  'csv_import_lemieux', 'csv_import_laura_park', 'xml_import_fabric_megastore', 'shopify_advdigitaltextiles', 'shopify_fabricondemand'];

const designsByCo = new Map<number, { id: number; plant_number: string }[]>();
db.prepare('SELECT d.id, d.plant_number, d.company_id FROM designs d').all().forEach((d: any) => {
  if (!designsByCo.has(d.company_id)) designsByCo.set(d.company_id, []);
  designsByCo.get(d.company_id)!.push(d);
});
const colorwaysByDesign = new Map<number, { id: number }[]>();
db.prepare('SELECT id, design_id FROM colorways').all().forEach((c: any) => {
  if (!colorwaysByDesign.has(c.design_id)) colorwaysByDesign.set(c.design_id, []);
  colorwaysByDesign.get(c.design_id)!.push(c);
});
const contactByCo = new Map<number, number>();
db.prepare('SELECT id, company_id FROM contacts WHERE is_primary=1').all().forEach((c: any) =>
  contactByCo.set(c.company_id, c.id),
);
const addrByCo = new Map<number, number>();
db.prepare('SELECT id, company_id FROM ship_to_addresses WHERE is_default=1').all().forEach((a: any) =>
  addrByCo.set(a.company_id, a.id),
);

let orderCounter = 4500;
let prCounter = 8000;
const totalOrders = 250;
for (let i = 0; i < totalOrders; i++) {
  const co = faker.helpers.arrayElement(companies);
  const coDesigns = designsByCo.get(co.id) ?? designs;
  const ordStatus = pickStatus();
  const isClosed = ['Closed', 'Invoiced', 'Shipped', 'Cancelled'].includes(ordStatus.status);
  const createdDaysAgo = isClosed ? faker.number.int({ min: 30, max: 540 }) : faker.number.int({ min: 1, max: 60 });
  const createdAt = faker.date.recent({ days: createdDaysAgo }).toISOString();
  const reqDate = faker.date.soon({ days: 30, refDate: createdAt }).toISOString().slice(0, 10);
  // Estimated Ship Date is always set at order entry (provisional, internal).
  const estimatedShipDate = faker.date.soon({ days: 5, refDate: reqDate }).toISOString().slice(0, 10);
  // Promised Date is only set once the order is approved for production. For pre-approval
  // statuses it stays NULL — the customer hasn't been promised a date yet.
  const promisedDate = PRE_APPROVAL_STATUSES.has(ordStatus.status) ? null : estimatedShipDate;
  const orderNum = `ADT-${orderCounter++}`;
  const subtotal = faker.number.int({ min: 800, max: 18000 });
  const isRush = subtotal > 8000 && Math.random() < 0.15 ? 1 : 0;
  const approvalReq = (subtotal > 10000 || isRush) && Math.random() < 0.6 ? 1 : 0;
  const triggers: string[] = [];
  if (subtotal > 10000) triggers.push('high_value');
  if (isRush) triggers.push('rush');

  const source = faker.helpers.arrayElement(sourceSystems);
  const isShopify = source.startsWith('shopify');

  // Assigned-To owner shifts with lifecycle stage. Drives dashboard filtering.
  const orderAssignedTo = (() => {
    if (['Draft', 'Validated', 'Waiting on Customer', 'Waiting on Artwork'].includes(ordStatus.status)) return userByRole['csr'];
    if (ordStatus.status === 'Waiting on Approval') return userByRole['prod_mgr'];
    if (['In Production', 'Partially Complete'].includes(ordStatus.status)) return userByRole['prod_mgr'];
    if (['Ready to Ship'].includes(ordStatus.status)) return userByRole['finishing'];
    if (['Shipped', 'Invoiced', 'Closed'].includes(ordStatus.status)) return userByRole['accounting'] ?? userByRole['csr'];
    if (ordStatus.status === 'On Hold') return userByRole['prod_mgr'];
    return userByRole['csr'];
  })();

  const result = insOrder.run(
    orderNum,
    co.id,
    contactByCo.get(co.id) ?? null,
    addrByCo.get(co.id) ?? null,
    faker.helpers.arrayElement(roadmaps),
    ordStatus.status,
    ordStatus.cfs,
    reqDate,
    estimatedShipDate,
    promisedDate,
    isShopify ? null : `PO-${faker.string.alphanumeric(8).toUpperCase()}`,
    source,
    userByRole['csr'],
    orderAssignedTo,
    subtotal,
    co.is_third_party_billed ?? 0,
    isRush,
    approvalReq,
    triggers.length > 0 ? triggers.join(' + ') : null,
    approvalReq ? 'automated_rule' : null,
    approvalReq && ordStatus.status !== 'Waiting on Approval' ? faker.date.between({ from: createdAt, to: new Date() }).toISOString() : null,
    approvalReq && ordStatus.status !== 'Waiting on Approval' ? userByRole['prod_mgr'] : null,
    0,
    createdAt,
  );
  const orderId = result.lastInsertRowid as number;

  const lineCount = faker.number.int({ min: 1, max: 3 });
  for (let li = 0; li < lineCount; li++) {
    const sku = faker.helpers.arrayElement(skus);
    const design = faker.helpers.arrayElement(coDesigns);
    const colorways = colorwaysByDesign.get(design.id) ?? [];
    const colorway = colorways.length > 0 ? faker.helpers.arrayElement(colorways) : null;
    const qty = sku.product_type === 'yardage' ? faker.number.int({ min: 10, max: 100 }) : faker.number.int({ min: 1, max: 25 });
    const unitPrice = sku.product_type === 'yardage' ? faker.number.float({ min: 28, max: 105, fractionDigits: 2 })
                                                     : faker.number.float({ min: 65, max: 320, fractionDigits: 2 });

    // Strike-off classification — mostly previously approved for CSV intake; mostly customer for new artwork
    let classification: string;
    const r = Math.random();
    if (source.startsWith('csv_') || source.startsWith('xml_')) classification = r < 0.85 ? 'Previously Approved' : 'Strike-Off Not Required';
    else if (isShopify) classification = 'Strike-Off Not Required';
    else classification = r < 0.3 ? 'Customer Strike-Off Required' : r < 0.65 ? 'Previously Approved' : 'Strike-Off Not Required';

    const isCAP = classification !== 'Customer Strike-Off Required' && r < 0.2 ? 1 : 0;

    // VPN + master-SKU mapping. Customers like St Frank, Inside, Havenly have a VPN pool to draw
    // from; everyone else gets no VPN. The 'ST-UNKNOWN-9999' VPN intentionally has no master row
    // so the master_sku_mapping_status = 'unmapped' exception path is exercised.
    const customerName = co.name;
    const vpnPool = vpnsByCustomerName[customerName] || [];
    const vpn = vpnPool.length > 0 ? faker.helpers.arrayElement(vpnPool) : null;
    const masterRow = vpn ? masterByVpn.get(vpn) ?? null : null;
    const productTypeFromMaster = masterRow?.product_type ?? null;
    const insertRequired = masterRow?.insert_key ?? null;
    const mappingStatus = !vpn ? 'no_vpn' : (masterRow ? 'mapped' : 'unmapped');

    const lineRes = insLine.run(
      orderId, sku.id, design.id, colorway?.id ?? null, sku.fabric_id, qty,
      sku.product_type === 'yardage' ? 'yards' : 'units',
      unitPrice, classification,
      classification.includes('Customer') ? userByRole['colorist'] : null,
      isCAP,
      vpn, productTypeFromMaster, insertRequired, mappingStatus,
    );
    const lineId = lineRes.lastInsertRowid as number;

    // Create 1 PR per line for non-yardage product types too (for prototype simplicity)
    const prStatus = ['Draft', 'Pending Internal Proof', 'Ready for Scheduling', 'Scheduled',
                      'Printing', 'Printed', 'Complete'][Math.floor((['Draft','Validated','Waiting on Approval','In Production','Partially Complete','Ready to Ship','Shipped','Invoiced','Closed','On Hold','Cancelled'].indexOf(ordStatus.status)) * 0.6)] ?? 'Draft';
    const printer = faker.helpers.arrayElement(printers);
    const isAutoRouted = (source.startsWith('csv_') || source.startsWith('xml_')) ? 1 : 0;
    const internalProofStatus = isAutoRouted || isCAP ? 'not_required'
                                 : prStatus === 'Pending Internal Proof' ? 'pending'
                                 : ['Ready for Scheduling', 'Scheduled', 'Printing', 'Printed', 'Complete'].includes(prStatus) ? 'approved'
                                 : 'not_required';
    // Assigned-To on a PR = the colorist working that machine, per Nick. Colorists 'own' specific
    // printers (Jeannine: Durst Alpha 330, MS JP7, MS JP4-A; Maya: MS JP4-B, Zimmer Colaris, both
    // HP Latex units). Pre-print PRs (no printer yet) fall back to Jeannine as default.
    const colorByPrinterName: Record<string, number> = {
      'Durst Alpha 330': COLORIST_JEANNINE,
      'MS JP7':          COLORIST_JEANNINE,
      'MS JP4-A':        COLORIST_JEANNINE,
      'MS JP4-B':        COLORIST_MAYA,
      'Zimmer Colaris':  COLORIST_MAYA,
      'HP Latex 800W':   COLORIST_MAYA,
      'HP Latex 830W':   COLORIST_MAYA,
    };
    const prAssignedTo = colorByPrinterName[printer.name] ?? COLORIST_JEANNINE;
    // Traveler Compositing — composite is generated once PR has reached at least 'Scheduled'.
    // Most generate cleanly ('generated'); a small fraction fail to exercise the exception path.
    // Composite NOT required when there's no VPN to encode AND it's a yardage product (e.g.
    // bulk yardage without a CUT-station downstream step). For prototype: generate for every
    // non-yardage product OR any product on a CSV-intake customer.
    const compositeApplicable = sku.product_type !== 'yardage' || isAutoRouted;
    const compositeReached = ['Scheduled', 'Printing', 'Printed', 'Complete'].includes(prStatus);
    let compositeStatus: string = 'not_required';
    let compositeFilePath: string | null = null;
    let compositeGeneratedAt: string | null = null;
    let compositeError: string | null = null;
    const prNumberStr = `PR-${prCounter}`;
    let qrPayload: string | null = null;
    if (compositeApplicable) {
      if (compositeReached) {
        // 8% failure rate to seed the Exception path
        if (Math.random() < 0.08) {
          compositeStatus = 'failed';
          compositeError = faker.helpers.arrayElement([
            'Source artwork not found at expected NAS path',
            'QR encode failed — payload exceeded 96 char limit',
            'Color profile mismatch — composite library refused to render',
            'Hot folder unreachable at write time',
          ]);
        } else {
          compositeStatus = 'generated';
          compositeFilePath = `\\\\adt-nas\\composites\\${orderNum}\\${prNumberStr}.tif`;
          compositeGeneratedAt = faker.date.recent({ days: 2 }).toISOString();
        }
        // Traveler QR payload — minimal: PO# / Order ID (extensible later)
        qrPayload = orderNum;
      } else {
        compositeStatus = 'pending';
      }
    }

    const prRes = insPR.run(
      `PR-${prCounter++}`, lineId, printer.id, sku.fabric_id,
      printer.ink_set.toLowerCase().replace(/ /g, '_'),
      prStatus,
      qty, prStatus === 'Printed' || prStatus === 'Complete' ? qty : null,
      classification, classification.includes('Customer') ? userByRole['colorist'] : null,
      isCAP, isAutoRouted, internalProofStatus,
      internalProofStatus !== 'not_required' ? faker.date.recent({ days: 5 }).toISOString() : null,
      internalProofStatus === 'approved' ? faker.date.recent({ days: 4 }).toISOString() : null,
      internalProofStatus === 'approved' ? userByRole['colorist'] : null,
      isAutoRouted ? `\\\\hot-folder-${printer.id}\\${sku.product_type}` : null,
      ['Scheduled', 'Printing', 'Printed', 'Complete'].includes(prStatus)
        ? faker.date.recent({ days: 3 }).toISOString() : null,
      prAssignedTo,
      createdAt,
      qrPayload, compositeStatus, compositeFilePath, compositeGeneratedAt, compositeError,
    );
    const prId = prRes.lastInsertRowid as number;

    // Generate physical rolls at pack-out. PRs at status 'Complete' or later (or whose parent order
    // is already Ready/Shipped/etc.) have been packed. Multi-roll per PR with realistic yardage
    // variance — e.g. a 500-yd PR may yield 99 + 100 + 101 + 102 + 106 yards across 5 rolls.
    const isPacked = ['Complete'].includes(prStatus) || ['Ready to Ship','Shipped','Invoiced','Closed'].includes(ordStatus.status);
    if (isPacked && sku.product_type === 'yardage' && qty >= 30) {
      // Split the printed yardage into rolls of ~100yd each (with variance)
      let remaining = qty;
      const packedAt = faker.date.recent({ days: 2 }).toISOString();
      const packedBy = userByRole['finishing'];
      const orderShipped = ['Shipped','Invoiced','Closed'].includes(ordStatus.status);
      while (remaining > 0) {
        // Target each roll ~95-105 yards, with last roll taking the remainder
        const target = remaining > 110 ? faker.number.int({ min: 92, max: 108 }) : remaining;
        const rollYards = Math.min(target, remaining);
        insPRRoll.run(
          prId,
          String(rollSequence++),
          rollYards,
          packedAt,
          packedBy,
          orderShipped ? 'shipped' : 'packed',
          orderShipped ? faker.date.recent({ days: 1 }).toISOString() : null,
          packedAt,
        );
        remaining -= rollYards;
      }
    } else if (isPacked && sku.product_type === 'yardage') {
      // Smaller order — one roll
      insPRRoll.run(
        prId, String(rollSequence++), qty,
        faker.date.recent({ days: 2 }).toISOString(), userByRole['finishing'],
        ['Shipped','Invoiced','Closed'].includes(ordStatus.status) ? 'shipped' : 'packed',
        ['Shipped','Invoiced','Closed'].includes(ordStatus.status) ? faker.date.recent({ days: 1 }).toISOString() : null,
        faker.date.recent({ days: 2 }).toISOString(),
      );
    }
  }
}

console.log('Seeding strike-offs (~60 across PRs in strike-off-bearing roadmaps)...');
const insStrike = db.prepare(`
  INSERT INTO strike_offs (strike_off_number, print_request_id, artwork_file_id, status,
    customer_decision_at, customer_decision_outcome, customer_change_notes, approval_token, approval_sent_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const STRIKE_STATUSES = [
  'Requested', 'In Queue', 'In Color Matching', 'Printing', 'Quality Check',
  'Awaiting Approval', 'Customer Reviewing', 'Approved', 'Approve with Changes',
  'Rejected', 'Revision Required', 'On Hold', 'Cancelled', 'Closed',
] as const;
// Pull PRs whose parent order is on a roadmap that includes strike-off (R4, R5)
const strikePRs = db.prepare(`
  SELECT pr.id as pr_id, pr.pr_number, pr.artwork_file_id, pr.created_at, o.roadmap
  FROM print_requests pr
  JOIN order_lines ol ON pr.order_line_id = ol.id
  JOIN orders o ON ol.order_id = o.id
  WHERE o.roadmap IN ('R4', 'R5')
  LIMIT 80
`).all() as { pr_id: number; pr_number: string; artwork_file_id: number | null; created_at: string; roadmap: string }[];

let strikeCounter = 7400;
strikePRs.forEach((pr, idx) => {
  // Skip ~20% (not every R4/R5 PR has a strike yet)
  if (idx % 5 === 0) return;
  const status = STRIKE_STATUSES[idx % STRIKE_STATUSES.length];
  const decided = ['Approved','Approve with Changes','Rejected','Revision Required','Closed','Cancelled'].includes(status);
  const sent = ['Awaiting Approval','Customer Reviewing','Approved','Approve with Changes','Rejected','Revision Required','Closed'].includes(status);
  const decisionOutcome = decided
    ? (status === 'Approve with Changes' ? 'Approve with Changes'
       : status === 'Rejected' ? 'Rejected'
       : status === 'Revision Required' ? 'Revision Required'
       : status === 'Approved' ? 'Approved' : null)
    : null;
  const decisionAt = decided ? faker.date.recent({ days: 14 }).toISOString() : null;
  const changeNotes = status === 'Approve with Changes'
    ? faker.helpers.arrayElement([
        'Make the navy 2 shades darker on next print.',
        'Add 0.25" trim allowance on top edge.',
        'Reduce repeat from 18" to 16".',
        'Color OK — please flip orientation 90°.',
      ])
    : null;
  const token = sent ? `tok_${faker.string.alphanumeric(10)}` : null;
  const sentAt = sent ? faker.date.recent({ days: 21 }).toISOString() : null;
  insStrike.run(
    `SO-${strikeCounter++}`,
    pr.pr_id,
    pr.artwork_file_id,
    status,
    decisionAt,
    decisionOutcome,
    changeNotes,
    token,
    sentAt,
  );
});

console.log('Seeding intake configs (5 customers — CSV/XML)...');
const insIntake = db.prepare(`
  INSERT INTO intake_configs (company_id, intake_mode, file_format, auto_route_enabled, source_path, is_active)
  VALUES (?, ?, ?, 1, ?, 1)
`);
[
  ['St Frank', 'sftp', 'csv', '/intake/st-frank/'],
  ['Inside', 'sftp', 'csv', '/intake/inside/'],
  ['Lemieux Et Cie', 'email', 'csv', 'csv-lemieux@adt.com'],
  ['Laura Park Designs', 'sftp', 'csv', '/intake/laura-park/'],
  ['Fabric Megastore', 'watched_folder', 'xml', '\\\\nas\\intake\\fabric-megastore\\'],
].forEach(([name, mode, fmt, src]) => {
  const co = companies.find((c) => c.name === name);
  if (co) insIntake.run(co.id, mode, fmt, src);
});

console.log('Seeding inventory items...');
const insInv = db.prepare(`
  INSERT INTO inventory_items (item_type, fabric_id, name, available_qty, reserved_qty, low_stock_threshold, status)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);
fabrics.forEach((f) => {
  const avail = faker.number.int({ min: 0, max: 500 });
  const reserved = faker.number.int({ min: 0, max: Math.floor(avail / 2) });
  const threshold = 20;
  const status = avail === 0 ? 'OutOfStock' : avail < threshold ? 'LowStock' : 'Available';
  insInv.run('fabric', f.id, f.name, avail, reserved, threshold, status);
});

// ============================================================
// NeoStampa Sync — Phase 1 seed
// ============================================================
// 4 RIP machines (one agent per machine). Multiple printers may share an agent.
// Mapping: Durst Alpha 330 → RIP-Bay-A, MS JP7 → RIP-Bay-B, MS JP4-A/B → RIP-Bay-C,
//          Zimmer Colaris + HP Latex → RIP-Bay-D.
console.log('Seeding NeoStampa sync agents + hot folders...');
const insAgent = db.prepare(`
  INSERT INTO neostampa_agents (name, hostname, version, status, last_heartbeat_at,
    uptime_seconds, jobs_processed_today, jobs_failed_today, neostampa_version, notes)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const agentSpecs = [
  { name: 'RIP-Bay-A', hostname: 'rip-bay-a.adt.local', status: 'online',  ns: 'NeoStampa 11.2', notes: 'Durst Alpha — Pigment' },
  { name: 'RIP-Bay-B', hostname: 'rip-bay-b.adt.local', status: 'online',  ns: 'NeoStampa 11.2', notes: 'MS JP7 — Fiber Reactive' },
  { name: 'RIP-Bay-C', hostname: 'rip-bay-c.adt.local', status: 'degraded', ns: 'NeoStampa 11.1', notes: 'JP4-A/B Dye Sub — needs NeoStampa upgrade' },
  { name: 'RIP-Bay-D', hostname: 'rip-bay-d.adt.local', status: 'online',  ns: 'NeoStampa 11.2', notes: 'Zimmer + HP Latex' },
];
const agentIds: Record<string, number> = {};
agentSpecs.forEach((a) => {
  const r = insAgent.run(
    a.name, a.hostname, '1.0.2', a.status,
    a.status === 'online' ? faker.date.recent({ days: 0.01 }).toISOString() : faker.date.recent({ days: 0.5 }).toISOString(),
    faker.number.int({ min: 100000, max: 5000000 }),
    faker.number.int({ min: 10, max: 80 }),
    a.status === 'degraded' ? faker.number.int({ min: 3, max: 12 }) : faker.number.int({ min: 0, max: 4 }),
    a.ns, a.notes,
  );
  agentIds[a.name] = r.lastInsertRowid as number;
});

console.log('Seeding hot folders (one per printer + 1 rush lane)...');
const printersAll = db.prepare(`SELECT id, name FROM printers`).all() as { id: number; name: string }[];
const insHotFolder = db.prepare(`
  INSERT INTO hot_folders (printer_id, name, unc_path, is_active, neostampa_agent_id, is_rush_lane)
  VALUES (?, ?, ?, ?, ?, ?)
`);
const printerAgentMap: Record<string, string> = {
  'Durst Alpha 330': 'RIP-Bay-A',
  'MS JP7': 'RIP-Bay-B',
  'MS JP4-A': 'RIP-Bay-C',
  'MS JP4-B': 'RIP-Bay-C',
  'Zimmer Colaris': 'RIP-Bay-D',
  'HP Latex 800W': 'RIP-Bay-D',
  'HP Latex 830W': 'RIP-Bay-D',
};
const hotFolderByPrinterId: Record<number, number> = {};
printersAll.forEach((p) => {
  const agentName = printerAgentMap[p.name] ?? 'RIP-Bay-A';
  const slug = p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const r = insHotFolder.run(
    p.id, `${p.name} — STANDARD`,
    `\\\\${agentName.toLowerCase()}\\hotfolder\\${slug}\\standard\\`,
    1, agentIds[agentName], 0,
  );
  hotFolderByPrinterId[p.id] = r.lastInsertRowid as number;
});
// One rush lane on Durst (heaviest used)
const durst = printersAll.find((p) => p.name === 'Durst Alpha 330');
if (durst) {
  insHotFolder.run(
    durst.id, 'Durst Alpha 330 — RUSH',
    `\\\\rip-bay-a\\hotfolder\\durst-alpha-330\\rush\\`,
    1, agentIds['RIP-Bay-A'], 1,
  );
}

// ============================================================
// FabricOutputs + RipJobs + events per PR
// ============================================================
console.log('Seeding fabric outputs + RIP jobs + events for in-flight PRs...');
const insFO = db.prepare(`
  INSERT INTO fabric_outputs (qr_payload, print_request_id, generated_at, yards_produced, status)
  VALUES (?, ?, ?, ?, ?)
`);
const insRipJob = db.prepare(`
  INSERT INTO rip_jobs (print_request_id, fabric_output_id, external_job_name, status,
    hot_folder_id, neostampa_agent_id, package_path, retry_count, is_held, hold_reason, error_message,
    submitted_at, accepted_at, rip_started_at, rip_completed_at,
    print_started_at, print_completed_software_at, print_completed_qr_at, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const insRipEvent = db.prepare(`
  INSERT INTO rip_job_events (rip_job_id, event_type, event_at, source, user_id, details)
  VALUES (?, ?, ?, ?, ?, ?)
`);
const updPRRip = db.prepare(`
  UPDATE print_requests
  SET external_job_name = ?, fabric_output_id = ?, current_rip_job_id = ?, rip_status = ?,
      rip_retry_count = ?, rip_last_event_at = ?
  WHERE id = ?
`);

// Pull every PR with the bits we need for the external job name
const prsForRip = db.prepare(`
  SELECT pr.id as pr_id, pr.pr_number, pr.status as pr_status, pr.printer_id, pr.planned_yardage,
         pr.printed_yardage, pr.created_at,
         d.name as design_name, cw.name as colorway_name,
         c.name as company_name
  FROM print_requests pr
  JOIN order_lines ol ON pr.order_line_id = ol.id
  JOIN orders o ON ol.order_id = o.id
  JOIN companies c ON o.company_id = c.id
  LEFT JOIN designs d ON ol.design_id = d.id
  LEFT JOIN colorways cw ON ol.colorway_id = cw.id
`).all() as any[];

let foCounter = 90000;
let ripJobsCreated = 0;
let ripEventsCreated = 0;
prsForRip.forEach((pr) => {
  // Build external job name: CUSTOMER_PR-#_FO-#_DESIGN_COLORWAY_yyYD
  const customer = (pr.company_name ?? 'UNKNOWN')
    .toUpperCase()
    .replace(/&/g, 'AND').replace(/[^A-Z0-9]+/g, '');
  const design = (pr.design_name ?? 'UNKNOWN')
    .toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '');
  const colorway = (pr.colorway_name ?? 'DEFAULT')
    .toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '');
  const yards = Math.round(pr.planned_yardage ?? 0);
  const foId = foCounter++;
  const externalJobName = `${customer}_PR-${pr.pr_id}_FO-${foId}_${design}_${colorway}_${yards}YD`;

  // FabricOutput status maps from PR status
  const foStatus =
    ['Complete'].includes(pr.pr_status) ? 'bundled'
    : ['Printed'].includes(pr.pr_status) ? 'finishing'
    : ['Printing'].includes(pr.pr_status) ? 'printed'
    : 'pending_print';

  const foResult = insFO.run(
    `FO-${foId}`, pr.pr_id,
    faker.date.recent({ days: 5 }).toISOString(),
    pr.printed_yardage,
    foStatus,
  );
  const foRowId = foResult.lastInsertRowid as number;

  // Decide RIP job status from PR status + a bit of variance
  // PR Draft / Pending Internal Proof / Ready for Scheduling = no RIP job yet
  if (['Draft', 'Pending Internal Proof'].includes(pr.pr_status)) {
    updPRRip.run(externalJobName, foRowId, null, 'not_started', 0, null, pr.pr_id);
    return;
  }
  // PR Ready for Scheduling = ready_for_rip
  // Scheduled = package_created / submitted / accepted / ripping
  // Printing = queued_for_print / printing
  // Printed = print_complete_software (waiting for QR confirm)
  // Complete = print_complete_qr
  const baseStatus =
    pr.pr_status === 'Ready for Scheduling' ? 'ready_for_rip'
    : pr.pr_status === 'Scheduled' ? faker.helpers.arrayElement(['package_created', 'submitted', 'accepted', 'ripping', 'rip_complete', 'queued_for_print'])
    : pr.pr_status === 'Printing' ? 'printing'
    : pr.pr_status === 'Printed' ? 'print_complete_software'
    : pr.pr_status === 'Complete' ? 'print_complete_qr'
    : 'ready_for_rip';

  // Apply ~7% failure / ~3% held overrides
  const roll = faker.number.int({ min: 1, max: 100 });
  const ripStatus = roll <= 7 ? 'error' : roll <= 10 ? 'held' : baseStatus;
  const retryCount = ripStatus === 'error' ? faker.number.int({ min: 0, max: 3 }) : 0;
  const isHeld = ripStatus === 'held' ? 1 : 0;
  const holdReason = isHeld
    ? faker.helpers.arrayElement(['Megan approval pending', 'RIP profile review', 'Awaiting customer color approval', 'Inventory shortage'])
    : null;
  const errorMessage = ripStatus === 'error'
    ? faker.helpers.arrayElement([
        'Hot folder unreachable — \\\\rip-bay-c\\hotfolder unreachable',
        'NeoStampa rejected job: missing ICC profile',
        'Package generation failed — composite TIFF size exceeded 4GB',
        'NeoStampa agent stopped responding mid-RIP',
        'Duplicate external job name detected',
      ])
    : null;

  // Timestamps cascade by status
  const baseDate = new Date(pr.created_at).getTime();
  const day = 24 * 3600 * 1000;
  const stepMs = (h: number) => h * 3600 * 1000;
  const submittedAt   = baseDate + faker.number.int({ min: stepMs(0.5), max: stepMs(3) });
  const acceptedAt    = submittedAt + stepMs(faker.number.int({ min: 1, max: 8 }) / 12);  // few minutes
  const ripStartedAt  = acceptedAt + stepMs(0.05);
  const ripCompletedAt = ripStartedAt + stepMs(faker.number.int({ min: 5, max: 40 }) / 60); // 5-40 min
  const printStartedAt = ripCompletedAt + stepMs(faker.number.int({ min: 1, max: 6 }));
  const printSoftwareAt = printStartedAt + stepMs(faker.number.int({ min: 1, max: 5 }));
  const printQrAt = printSoftwareAt + stepMs(faker.number.int({ min: 0.1, max: 2 }) * 10) / 10;

  const reached = (s: string) => {
    const order = ['ready_for_rip','package_created','submitted','accepted','ripping','rip_complete','queued_for_print','printing','print_complete_software','print_complete_qr'];
    return order.indexOf(ripStatus) >= order.indexOf(s);
  };
  const tsOrNull = (ms: number, gateStatus: string) => reached(gateStatus) ? new Date(ms).toISOString() : null;

  // Pick hot folder + agent
  const hotFolderId = hotFolderByPrinterId[pr.printer_id] ?? null;
  const agentName = printerAgentMap[(printersAll.find((p) => p.id === pr.printer_id)?.name ?? '')] ?? 'RIP-Bay-A';
  const agentId = agentIds[agentName];
  const packagePath = `\\\\nas\\packages\\${externalJobName.toLowerCase()}.prn`;

  const ripJobResult = insRipJob.run(
    pr.pr_id, foRowId, externalJobName, ripStatus,
    hotFolderId, agentId, packagePath, retryCount, isHeld, holdReason, errorMessage,
    tsOrNull(submittedAt, 'submitted'),
    tsOrNull(acceptedAt, 'accepted'),
    tsOrNull(ripStartedAt, 'ripping'),
    tsOrNull(ripCompletedAt, 'rip_complete'),
    tsOrNull(printStartedAt, 'printing'),
    tsOrNull(printSoftwareAt, 'print_complete_software'),
    tsOrNull(printQrAt, 'print_complete_qr'),
    new Date(baseDate).toISOString(),
  );
  const ripJobId = ripJobResult.lastInsertRowid as number;
  ripJobsCreated++;

  // Event log — write a row for each transition the job actually went through
  const evt = (type: string, at: number | null, source = 'agent', details: string | null = null) => {
    if (at === null) return;
    insRipEvent.run(ripJobId, type, new Date(at).toISOString(), source, null, details);
    ripEventsCreated++;
  };
  evt('package_created', baseDate + stepMs(0.3), 'system');
  evt('submitted', reached('submitted') ? submittedAt : null);
  evt('accepted', reached('accepted') ? acceptedAt : null);
  evt('rip_started', reached('ripping') ? ripStartedAt : null);
  evt('rip_completed', reached('rip_complete') ? ripCompletedAt : null);
  evt('print_started', reached('printing') ? printStartedAt : null);
  evt('print_completed_software', reached('print_complete_software') ? printSoftwareAt : null);
  evt('print_completed_qr', reached('print_complete_qr') ? printQrAt : null, 'agent', 'Confirmed via QR scan at printer exit');
  if (ripStatus === 'error') {
    evt('error', baseDate + stepMs(faker.number.int({ min: 2, max: 24 })), 'agent', errorMessage);
    for (let r = 0; r < retryCount; r++) {
      evt('retried', baseDate + stepMs(faker.number.int({ min: 24, max: 48 }) * (r + 1)), 'manual', `Retry ${r + 1}`);
    }
  }
  if (ripStatus === 'held') {
    evt('held', baseDate + stepMs(faker.number.int({ min: 1, max: 6 })), 'manual', holdReason);
  }

  // Update PR with derived RIP state
  updPRRip.run(
    externalJobName, foRowId, ripJobId, ripStatus, retryCount,
    new Date(baseDate + stepMs(faker.number.int({ min: 1, max: 12 }))).toISOString(),
    pr.pr_id,
  );
});
console.log(`  RIP jobs: ${ripJobsCreated}, events: ${ripEventsCreated}`);

// ============================================================
// Unattributed (Canvas-originated) RIP jobs
// ============================================================
// Colorists often start jobs in NeoStampa Canvas directly. The Sync Agent
// observes those jobs via log-tail + hot-folder watch and reports them to
// Helm BEFORE they're bound to a PR. They sit in the Reconciliation Queue
// until an operator binds them (manual_associate) or auto-match succeeds.
console.log('Seeding unattributed Canvas-originated RIP jobs (Reconciliation Queue)...');
const insUnattributedRipJob = db.prepare(`
  INSERT INTO rip_jobs (
    print_request_id, origin, neostampa_job_id, fabric_output_id, external_job_name, status,
    hot_folder_id, neostampa_agent_id, package_path, retry_count, is_held,
    auto_match_score, reconciliation_status,
    submitted_at, accepted_at, rip_started_at, rip_completed_at,
    print_started_at, print_completed_software_at, created_at
  ) VALUES (?, 'neostampa_gui', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
// Sample Canvas-originated jobs — names a colorist might save in NeoStampa.
// Some contain PR-#### (high-confidence auto-match candidates), some PLANT# (medium),
// some are vague (require manual review).
const unattributed = [
  { name: 'st_frank_cypress_indigo_PR-4506_rerun.tif', score: 95, status: 'awaiting_review',
    note: 'Filename contains PR-4506 → high-confidence auto-match suggestion. Operator must confirm before binding.' },
  { name: 'inside_marisol_coral_v2.psd',               score: 0,  status: 'awaiting_review',
    note: 'No PR or PLANT# in filename. CSR / colorist must search and bind manually.' },
  { name: 'P26-1042_jeannine_test_print.tif',          score: 70, status: 'awaiting_review',
    note: 'PLANT# P26-1042 matches an active design — colorist may have been testing color match.' },
  { name: 'laura_park_marigold_yellow_print.tif',       score: 0,  status: 'awaiting_review',
    note: 'Vague filename. Reconciliation needed.' },
  { name: 'PR-4789_lemieux_textured_natural_strike.tif', score: 92, status: 'auto_matched',
    note: 'Auto-matched to PR-4789 via filename (>70 confidence). Awaiting final operator confirmation.' },
  { name: 'havenly_sage_block_olive_canvas_test.tif',   score: 0,  status: 'flagged_no_pr',
    note: 'Marked by operator as "internal test print — no PR association needed".' },
  { name: 'jeannine_color_match_durst_test_03.tif',     score: 0,  status: 'flagged_no_pr',
    note: 'Color-match calibration print. No PR association.' },
  { name: 'kravet_oxford_navy_PR-4612.tif',             score: 95, status: 'awaiting_review',
    note: 'Filename contains PR-4612 → high-confidence auto-match suggestion.' },
  { name: 'st_frank_v3_REPRINT.tif',                    score: 0,  status: 'awaiting_review',
    note: 'Vague filename + reprint indicator. May tie to multiple open St Frank PRs.' },
  { name: 'inside_terra_blush_PR-4651_strike.tif',      score: 95, status: 'manual_associated',
    note: 'Manually associated by Sarah (CSR) to PR-4651 after color review.' },
  { name: 'untitled_durst_2026-06-22.tif',              score: 0,  status: 'awaiting_review',
    note: 'Default NeoStampa filename — colorist forgot to rename. CSR investigation needed.' },
  { name: 'P26-0997_color_proof.tif',                   score: 65, status: 'awaiting_review',
    note: 'PLANT# match but multiple recent PRs exist for this design — needs operator selection.' },
];
let unattributedCounter = 0;
unattributed.forEach((u, idx) => {
  // Pick a printer at random — Canvas jobs route to whichever RIP the colorist sat at
  const printer = faker.helpers.arrayElement(printers);
  const agentName = printerAgentMap[printer.name] ?? 'RIP-Bay-A';
  const agentId = agentIds[agentName];
  const hotFolderId = hotFolderByPrinterId[printer.id] ?? null;
  // Distribute statuses — most are 'printing' or 'print_complete_software' since
  // they've been observed mid-flight
  const status = faker.helpers.arrayElement(['ripping', 'queued_for_print', 'printing', 'print_complete_software']);
  const created = faker.date.recent({ days: 1 }).toISOString();
  const submittedAt = new Date(new Date(created).getTime() + 60000).toISOString();
  insUnattributedRipJob.run(
    null,                                              // no PR yet
    `nS_job_${faker.string.alphanumeric(10)}`,         // NeoStampa internal ID
    null,                                              // no fabric output yet either
    u.name,                                            // external_job_name = the file colorist saved
    status,
    hotFolderId, agentId,
    `\\\\${agentName.toLowerCase()}\\local\\users\\colorist\\Documents\\NeoStampa\\${u.name}`,
    0, 0,
    u.score, u.status,
    submittedAt,
    new Date(new Date(submittedAt).getTime() + 30000).toISOString(),
    new Date(new Date(submittedAt).getTime() + 60000).toISOString(),
    ['rip_complete','queued_for_print','printing','print_complete_software'].indexOf(status) >= 0
      ? new Date(new Date(submittedAt).getTime() + 600000).toISOString() : null,
    ['queued_for_print','printing','print_complete_software'].indexOf(status) >= 0
      ? new Date(new Date(submittedAt).getTime() + 700000).toISOString() : null,
    status === 'print_complete_software'
      ? new Date(new Date(submittedAt).getTime() + 1500000).toISOString() : null,
    created,
  );
  unattributedCounter++;
});
console.log(`  Unattributed Canvas-originated RIP jobs: ${unattributedCounter}`);

console.log('Seeding notifications (recent in-app for active roles)...');
const insNote = db.prepare(`
  INSERT INTO notifications (notification_code, recipient_user_id, recipient_role, channel, subject, body, related_entity_type, related_entity_id, is_read, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const recentOrders = db.prepare(`
  SELECT id, order_number, company_id FROM orders ORDER BY created_at DESC LIMIT 30
`).all() as { id: number; order_number: string; company_id: number }[];
const csrId = userByRole['csr'];
const megId = userByRole['prod_mgr'];
const jeaId = userByRole['colorist'];
recentOrders.slice(0, 10).forEach((o, idx) => {
  insNote.run('N09', csrId, 'csr', 'in_app', `New order intake: ${o.order_number}`,
    `Order ${o.order_number} auto-created.`, 'order', o.id, idx > 5 ? 1 : 0,
    faker.date.recent({ days: 3 }).toISOString());
});
recentOrders.slice(0, 5).forEach((o) => {
  insNote.run('N17', megId, 'prod_mgr', 'in_app', `Approval gate: ${o.order_number}`,
    `Production approval required.`, 'order', o.id, 0, faker.date.recent({ days: 2 }).toISOString());
});
db.prepare(`SELECT id, pr_number FROM print_requests WHERE internal_proof_status='pending' LIMIT 8`).all().forEach((pr: any) => {
  insNote.run('N49', jeaId, 'colorist', 'in_app', `Internal proof requested: ${pr.pr_number}`,
    `Pending Internal Proof — review printed result.`, 'print_request', pr.id, 0, faker.date.recent({ days: 1 }).toISOString());
});

// Final summary
const counts = {
  users: (db.prepare('SELECT COUNT(*) as c FROM users').get() as any).c,
  companies: (db.prepare('SELECT COUNT(*) as c FROM companies').get() as any).c,
  designs: (db.prepare('SELECT COUNT(*) as c FROM designs').get() as any).c,
  skus: (db.prepare('SELECT COUNT(*) as c FROM skus').get() as any).c,
  orders: (db.prepare('SELECT COUNT(*) as c FROM orders').get() as any).c,
  order_lines: (db.prepare('SELECT COUNT(*) as c FROM order_lines').get() as any).c,
  print_requests: (db.prepare('SELECT COUNT(*) as c FROM print_requests').get() as any).c,
  packaging_profiles: (db.prepare('SELECT COUNT(*) as c FROM packaging_profiles').get() as any).c,
  notifications: (db.prepare('SELECT COUNT(*) as c FROM notifications').get() as any).c,
};
console.log('\nSeeding complete:');
Object.entries(counts).forEach(([k, v]) => console.log(`  ${k}: ${v}`));

db.close();
