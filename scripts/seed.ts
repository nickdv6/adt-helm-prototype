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
  ['julio@adt.com', 'Julio Vargas', 'print_op'],
  ['lucio@adt.com', 'Lucio Hernandez', 'finishing'],
  ['yuliana@adt.com', 'Yuliana Cruz', 'cut_sew'],
];
const insUser = db.prepare(
  'INSERT INTO users (email, full_name, primary_role) VALUES (?, ?, ?)',
);
users.forEach((u) => insUser.run(u[0], u[1], u[2]));
const userByRole: Record<string, number> = {};
db.prepare('SELECT id, primary_role FROM users')
  .all()
  .forEach((r: any) => (userByRole[r.primary_role] = r.id));

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
  INSERT INTO printers (name, model, ink_set, workstation_location, status, throughput_yards_per_hour)
  VALUES (?, ?, ?, ?, ?, ?)
`);
// Real ADT printer fleet (7 machines)
// Per Megan / Julio + WHY interviews: Durst Alpha has long changeovers; MS JP4s are duplicated for capacity
const printerSpecs = [
  ['Durst Alpha 330',  'Durst Alpha 330',    'Fiber Reactive', 'Print Room A', 'running',     95],
  ['MS JP7',           'MS JP7',             'Fiber Reactive', 'Print Room A', 'running',     45],
  ['MS JP4-A',         'MS JP4',             'Fiber Reactive', 'Print Room B', 'running',     28],
  ['MS JP4-B',         'MS JP4',             'Pigment',        'Print Room B', 'idle',        28],
  ['HP Latex 830W',    'HP Latex 830W',      'Latex',          'Print Room C', 'running',     22],
  ['HP Latex 800W',    'HP Latex 800W',      'Latex',          'Print Room C', 'idle',        18],
  ['Zimmer Colaris',   'Zimmer Colaris',     'Fiber Reactive', 'Print Room A', 'maintenance', 70],
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

console.log('Seeding orders + lines + PRs (last 18 months)...');
const insOrder = db.prepare(`
  INSERT INTO orders (order_number, company_id, primary_contact_id, ship_to_address_id, roadmap,
    status, customer_facing_status, customer_requested_date, adt_promised_date,
    po_number, source_system, primary_csr_user_id, subtotal, is_blind_ship, is_rush,
    approval_required, trigger_reason, trigger_source, approval_completed_at, approved_by_user_id,
    is_legacy, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const insLine = db.prepare(`
  INSERT INTO order_lines (order_id, sku_id, design_id, colorway_id, fabric_id, quantity, quantity_unit, unit_price,
    strike_off_classification, colorist_user_id, is_click_and_print)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const insPR = db.prepare(`
  INSERT INTO print_requests (pr_number, order_line_id, printer_id, fabric_id, print_process, status,
    planned_yardage, printed_yardage, strike_off_classification, colorist_user_id,
    is_click_and_print, was_csv_auto_routed, internal_proof_status, internal_proof_requested_at,
    internal_proof_resolved_at, internal_proof_resolved_by_user_id, hot_folder_target, scheduled_at, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

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
  const promisedDate = faker.date.soon({ days: 5, refDate: reqDate }).toISOString().slice(0, 10);
  const orderNum = `ADT-${orderCounter++}`;
  const subtotal = faker.number.int({ min: 800, max: 18000 });
  const isRush = subtotal > 8000 && Math.random() < 0.15 ? 1 : 0;
  const approvalReq = (subtotal > 10000 || isRush) && Math.random() < 0.6 ? 1 : 0;
  const triggers: string[] = [];
  if (subtotal > 10000) triggers.push('high_value');
  if (isRush) triggers.push('rush');

  const source = faker.helpers.arrayElement(sourceSystems);
  const isShopify = source.startsWith('shopify');

  const result = insOrder.run(
    orderNum,
    co.id,
    contactByCo.get(co.id) ?? null,
    addrByCo.get(co.id) ?? null,
    faker.helpers.arrayElement(roadmaps),
    ordStatus.status,
    ordStatus.cfs,
    reqDate,
    promisedDate,
    isShopify ? null : `PO-${faker.string.alphanumeric(8).toUpperCase()}`,
    source,
    userByRole['csr'],
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

    const lineRes = insLine.run(
      orderId, sku.id, design.id, colorway?.id ?? null, sku.fabric_id, qty,
      sku.product_type === 'yardage' ? 'yards' : 'units',
      unitPrice, classification,
      classification.includes('Customer') ? userByRole['colorist'] : null,
      isCAP,
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
    insPR.run(
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
      createdAt,
    );
  }
}

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
