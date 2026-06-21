// Central registry of every page in the prototype.
// Drives: /sitemap, the per-page annotation strip, "view source" links, MOCK badges.
//
// Match logic: exact path match first; if none, longest matching prefix wins.
// Dynamic routes like /orders/[id] are keyed by /orders/[id] and matched on /orders/<number>.

export type Wave = 'Wave 1' | 'Wave 2' | 'Wave 3' | 'Wave 5' | 'Post-MVP';
export type DataSource = 'live' | 'mock' | 'mixed';
export type Category =
  | 'Daily'
  | 'Role Home'
  | 'Orders'
  | 'Production'
  | 'Dashboards'
  | 'Fulfillment'
  | 'Operations'
  | 'Admin'
  | 'Settings'
  | 'Customer-Facing'
  | 'Meta';

export type PageMeta = {
  path: string;
  title: string;
  summary: string;
  category: Category;
  blueprintId?: string;       // e.g. "S21", "S25". Omit for non-blueprint screens.
  wave: Wave;
  dataSource: DataSource;     // live = DB-backed, mock = inline data, mixed = both
  dataNote?: string;          // Optional extra context, e.g. "rolls table seeded; routing rules mocked"
  sourcePath: string;         // Path relative to src/ for GitHub link
};

const REPO = 'nickdv6/adt-helm-prototype';
const BRANCH = 'main';

export function sourceUrl(meta: PageMeta): string {
  return `https://github.com/${REPO}/blob/${BRANCH}/src/${meta.sourcePath}`;
}

export const PAGES: PageMeta[] = [
  // Meta / landing
  { path: '/',              title: 'Landing · Tour',              summary: 'Prototype overview + guided tour entry points + key concepts.',
    category: 'Meta', wave: 'Wave 1', dataSource: 'mock', sourcePath: 'app/page.tsx' },
  { path: '/sitemap',       title: 'Sitemap',                     summary: 'Every page in the prototype, grouped by category. The "what exists" reference.',
    category: 'Meta', wave: 'Wave 1', dataSource: 'live', sourcePath: 'app/sitemap/page.tsx' },
  { path: '/changelog',     title: 'Changelog',                   summary: 'What changed in the prototype, most recent first.',
    category: 'Meta', wave: 'Wave 1', dataSource: 'mock', sourcePath: 'app/changelog/page.tsx' },
  { path: '/inbox',         title: 'Inbox',                       summary: 'Notification center — N## codes from seed.',
    category: 'Daily', wave: 'Wave 1', dataSource: 'live', sourcePath: 'app/inbox/page.tsx' },

  // Role Homes
  { path: '/megan',         title: 'Production Manager Home',     summary: "Megan's tabbed multi-role landing — sales / production / finance lenses.",
    category: 'Role Home', blueprintId: 'S03', wave: 'Wave 1', dataSource: 'live', sourcePath: 'app/megan/page.tsx' },
  { path: '/csr-home',      title: 'CSR Home',                    summary: "Sarah's CSR desk — assigned orders, late vs promised, awaiting-customer.",
    category: 'Role Home', blueprintId: 'S04', wave: 'Wave 1', dataSource: 'live', sourcePath: 'app/csr-home/page.tsx' },
  { path: '/colorist',      title: 'Colorist Home',               summary: "Jeannine's queue — internal proofs, strike-offs, machine load.",
    category: 'Role Home', blueprintId: 'S06', wave: 'Wave 1', dataSource: 'live', sourcePath: 'app/colorist/page.tsx' },
  { path: '/print-op-home', title: 'Print Operator Home',         summary: "Julio's floor screen — running now + up next, big touch targets.",
    category: 'Role Home', blueprintId: 'S07', wave: 'Wave 1', dataSource: 'live', sourcePath: 'app/print-op-home/page.tsx' },
  { path: '/finishing-home',title: 'Finishing Home',              summary: "Lucio's queue — printed awaiting finish, today's pack-out throughput.",
    category: 'Role Home', blueprintId: 'S08', wave: 'Wave 1', dataSource: 'live', sourcePath: 'app/finishing-home/page.tsx' },
  { path: '/cut-sew-home',  title: 'Cut/Sew Home',                summary: "Yuliana's queue — open FPRs, CUT labels printed today.",
    category: 'Role Home', blueprintId: 'S09', wave: 'Wave 1', dataSource: 'live', sourcePath: 'app/cut-sew-home/page.tsx' },
  { path: '/inventory-home',title: 'Inventory Home',              summary: "Karen's view — low + out-of-stock priority, recent activity.",
    category: 'Role Home', blueprintId: 'S10', wave: 'Wave 1', dataSource: 'mixed', dataNote: 'Stock data live from seed; recent activity is mock.', sourcePath: 'app/inventory-home/page.tsx' },
  { path: '/shipping-home', title: 'Shipping Home',               summary: "Marcus's view — packed rolls grouped by order, rush/blind flags.",
    category: 'Role Home', blueprintId: 'S11', wave: 'Wave 1', dataSource: 'live', sourcePath: 'app/shipping-home/page.tsx' },
  { path: '/receiving-home',title: 'Receiving Home',              summary: "Tomás's view — inbound today/this week, route from receiving form.",
    category: 'Role Home', blueprintId: 'S12', wave: 'Wave 1', dataSource: 'mock', dataNote: 'No inbound shipments table yet; data is inline mock.', sourcePath: 'app/receiving-home/page.tsx' },
  { path: '/receiving-home/receive', title: 'Receive Fabric (form)', summary: 'Owner / mill / GHL LOT# / yardage / rolls / condition / sample-cut / LAB white-point / absorbency.',
    category: 'Role Home', blueprintId: 'S62', wave: 'Wave 2', dataSource: 'mock', dataNote: 'Form submits in-memory; production needs material_receipts table.', sourcePath: 'app/receiving-home/receive/page.tsx' },
  { path: '/accounting-home',title: 'Accounting Home',            summary: "Diana's view — ready to invoice, on-hold orders, weekly revenue.",
    category: 'Role Home', blueprintId: 'S13', wave: 'Wave 1', dataSource: 'live', sourcePath: 'app/accounting-home/page.tsx' },

  // Orders
  { path: '/orders',        title: 'Order Dashboard',             summary: 'Flat list of all orders with status, customer, promised date, rush + blind flags.',
    category: 'Orders', blueprintId: 'S20', wave: 'Wave 1', dataSource: 'live', sourcePath: 'app/orders/page.tsx' },
  { path: '/orders/[id]',   title: 'Order Detail · Subway Map',   summary: 'Per-PR visual subway map plotting each PR along its roadmap route. The brand-vision screen.',
    category: 'Orders', blueprintId: 'S21', wave: 'Wave 1', dataSource: 'live', sourcePath: 'app/orders/[id]/page.tsx' },
  { path: '/orders/new',    title: 'New Order',                   summary: 'Manual order entry shell.',
    category: 'Orders', blueprintId: 'S19', wave: 'Wave 1', dataSource: 'mock', sourcePath: 'app/orders/new/page.tsx' },

  // Production
  { path: '/print-requests',title: 'PR Dashboard',                summary: 'All print requests with status, fabric, printer, colorist, scheduled date.',
    category: 'Production', blueprintId: 'S23', wave: 'Wave 1', dataSource: 'live', sourcePath: 'app/print-requests/page.tsx' },
  { path: '/print-requests/[id]', title: 'PR Detail',             summary: 'Single PR — proof flow, Traveler QR, CUT context, artwork preview.',
    category: 'Production', blueprintId: 'S24', wave: 'Wave 1', dataSource: 'live', sourcePath: 'app/print-requests/[id]/page.tsx' },
  { path: '/strike-offs',   title: 'Strike-Off List',             summary: '14-status workflow with filter chips, search, awaiting-customer count.',
    category: 'Production', blueprintId: 'S25', wave: 'Wave 1', dataSource: 'live', sourcePath: 'app/strike-offs/page.tsx' },
  { path: '/strike-offs/[id]', title: 'Strike-Off Detail',        summary: 'Artwork preview, public-link copy, customer decision panel, status history.',
    category: 'Production', blueprintId: 'S26', wave: 'Wave 1', dataSource: 'live', sourcePath: 'app/strike-offs/[id]/page.tsx' },
  { path: '/artwork',       title: 'Artwork Files',               summary: 'File browser with PLANT#_DESIGN_COLORWAY_VERSION naming validator.',
    category: 'Production', blueprintId: 'S27', wave: 'Wave 1', dataSource: 'live', sourcePath: 'app/artwork/page.tsx' },
  { path: '/production-scheduling', title: 'Production Scheduling', summary: '7-day capacity calendar per printer with overbooked detection.',
    category: 'Production', blueprintId: 'S28', wave: 'Wave 2', dataSource: 'mixed', dataNote: 'Schedule live from seed; per-printer capacity is mock constants.', sourcePath: 'app/production-scheduling/page.tsx' },
  { path: '/printer-queue', title: 'Printer Queue',               summary: 'Per-machine queue ordered by scheduled_at.',
    category: 'Production', blueprintId: 'S29', wave: 'Wave 1', dataSource: 'live', sourcePath: 'app/printer-queue/page.tsx' },
  { path: '/batch-ticket',  title: 'Batch Ticket · Heat Press',   summary: 'Group printed PRs into a single heat-press run.',
    category: 'Production', blueprintId: 'S30', wave: 'Wave 1', dataSource: 'live', sourcePath: 'app/batch-ticket/page.tsx' },
  { path: '/cut-sew',       title: 'Cut/Sew Queue',               summary: 'FPR list with product type, qty, customer.',
    category: 'Production', blueprintId: 'S31', wave: 'Wave 1', dataSource: 'live', sourcePath: 'app/cut-sew/page.tsx' },
  { path: '/cut-station',   title: 'CUT Station · Scan & Label',  summary: 'Scan Traveler QR → look up line items → print CUT labels with Insert Requirement.',
    category: 'Production', blueprintId: 'S56', wave: 'Wave 2', dataSource: 'mock', dataNote: 'Scan-and-label flow with hardcoded sample payloads; production needs label printer integration.', sourcePath: 'app/cut-station/page.tsx' },
  { path: '/fprs/[id]',     title: 'FPR Detail',                  summary: 'Single FPR with Tech Sheet PDF pop-up for cut/sew operators.',
    category: 'Production', blueprintId: 'S32', wave: 'Wave 1', dataSource: 'live', sourcePath: 'app/fprs/[id]/page.tsx' },

  // Dashboards
  { path: '/dashboards/daily-production', title: 'Daily Production Dashboard', summary: "Today's printer load + PR list with late tracking.",
    category: 'Dashboards', blueprintId: 'S44', wave: 'Wave 1', dataSource: 'live', sourcePath: 'app/dashboards/daily-production/page.tsx' },
  { path: '/dashboards/strike-off', title: 'Strike-Off Dashboard', summary: 'Aging buckets, colorist load, customer wait leaderboard, most overdue.',
    category: 'Dashboards', blueprintId: 'S46', wave: 'Wave 1', dataSource: 'live', sourcePath: 'app/dashboards/strike-off/page.tsx' },
  { path: '/dashboards/csr', title: 'Customer Service Dashboard',  summary: 'Late vs promised, approaching deadlines, awaiting-customer.',
    category: 'Dashboards', blueprintId: 'S51', wave: 'Wave 1', dataSource: 'mixed', dataNote: 'Order data live; exception count is mock (no exceptions table yet).', sourcePath: 'app/dashboards/csr/page.tsx' },
  { path: '/dashboards/quality', title: 'Quality Dashboard',       summary: 'Reprint rate, proof fail rate, RIP recalls, strike-off rejection by customer.',
    category: 'Dashboards', blueprintId: 'S53', wave: 'Wave 1', dataSource: 'live', sourcePath: 'app/dashboards/quality/page.tsx' },

  // Fulfillment
  { path: '/shipping',      title: 'Shipping Dashboard',          summary: 'Per-order shipping flow with expandable per-roll detail.',
    category: 'Fulfillment', blueprintId: 'S35', wave: 'Wave 1', dataSource: 'live', sourcePath: 'app/shipping/page.tsx' },
  { path: '/shipments/[id]',title: 'Shipment Detail',             summary: 'Single shipment with rolls table, label preview, 3rd-party billing block.',
    category: 'Fulfillment', blueprintId: 'S35a', wave: 'Wave 2', dataSource: 'mixed', dataNote: 'Rolls live; shipment number + tracking are synthesized.', sourcePath: 'app/shipments/[id]/page.tsx' },
  { path: '/fulfillment-requests', title: 'Fulfillment Requests', summary: 'All FPRs with filter + status.',
    category: 'Fulfillment', wave: 'Wave 1', dataSource: 'live', sourcePath: 'app/fulfillment-requests/page.tsx' },
  { path: '/rolls',         title: 'Created Rolls',               summary: 'All physical rolls grouped by PR, packed-at and shipped-at timestamps.',
    category: 'Fulfillment', wave: 'Wave 1', dataSource: 'live', sourcePath: 'app/rolls/page.tsx' },
  { path: '/returns',       title: 'Returns / RMAs',              summary: 'RMA dashboard with reason codes, condition, disposition.',
    category: 'Fulfillment', blueprintId: 'S35b', wave: 'Wave 2', dataSource: 'mock', dataNote: 'No returns table yet; inline mock RMAs.', sourcePath: 'app/returns/page.tsx' },
  { path: '/inventory',     title: 'Inventory',                   summary: 'Per-item stock levels + status.',
    category: 'Fulfillment', blueprintId: 'S33', wave: 'Wave 1', dataSource: 'live', sourcePath: 'app/inventory/page.tsx' },

  // Operations
  { path: '/exceptions',    title: 'Exception Center',            summary: 'Failed imports, missing artwork, RIP recalls, composite fails, etc.',
    category: 'Operations', blueprintId: 'S37', wave: 'Wave 1', dataSource: 'mock', dataNote: 'No exceptions table yet; inline mock EX-24xx entries.', sourcePath: 'app/exceptions/page.tsx' },
  { path: '/packing-correction', title: 'Packing Correction',     summary: 'Reassign / unpack / void / move corrections with severity tags.',
    category: 'Operations', wave: 'Wave 2', dataSource: 'mock', sourcePath: 'app/packing-correction/page.tsx' },

  // Admin
  { path: '/customers',     title: 'Customers',                   summary: 'Company list with terms, contacts, billing.',
    category: 'Admin', blueprintId: 'S16', wave: 'Wave 1', dataSource: 'live', sourcePath: 'app/customers/page.tsx' },
  { path: '/customers/[id]',title: 'Company Detail',              summary: 'DASH-style focused tabs: Company Info, Contacts, Orders, Open PRs, Designs, Completed PRs.',
    category: 'Admin', blueprintId: 'S17', wave: 'Wave 1', dataSource: 'live', sourcePath: 'app/customers/[id]/page.tsx' },
  { path: '/designs',       title: 'Design Dashboard',            summary: 'Searchable design list with PLANT#, customer, colorways.',
    category: 'Admin', wave: 'Wave 1', dataSource: 'live', sourcePath: 'app/designs/page.tsx' },
  { path: '/designs/import',title: 'Bulk Import Designs',         summary: 'CSV upload: design + colorway + UNC file path with validation + dup-detection + PLANT# auto-assign.',
    category: 'Admin', wave: 'Wave 1', dataSource: 'mock', dataNote: 'Client-side parse + mock commit; production needs server action + transaction.', sourcePath: 'app/designs/import/page.tsx' },
  { path: '/roadmaps',      title: 'Roadmap Builder',             summary: '7 routes (R1-R8) with live in-flight counts, station preview, assignment rules.',
    category: 'Admin', blueprintId: 'S22', wave: 'Wave 1', dataSource: 'mixed', sourcePath: 'app/roadmaps/page.tsx' },
  { path: '/customer-configs', title: 'Customer Configs',         summary: 'Customer onboarding + SKU mapping + intake config.',
    category: 'Admin', blueprintId: 'S18', wave: 'Wave 1', dataSource: 'mock', sourcePath: 'app/customer-configs/page.tsx' },
  { path: '/packaging-profiles', title: 'Packaging Profiles',     summary: 'Per-customer + product-type packaging specs.',
    category: 'Admin', blueprintId: 'S40c', wave: 'Wave 1', dataSource: 'live', sourcePath: 'app/packaging-profiles/page.tsx' },
  { path: '/intake',        title: 'Intake Command Center',       summary: 'Automated CSV/XML print intake — pipeline, strike-off engine, composite engine, scan events.',
    category: 'Admin', blueprintId: 'S42b', wave: 'Wave 1', dataSource: 'mock', dataNote: 'Inline orchestration mock — real version is a background worker.', sourcePath: 'app/intake/page.tsx' },
  { path: '/po-intake',     title: 'PDF PO Intake',               summary: 'OCR-parsed PO queue awaiting CSR review.',
    category: 'Admin', wave: 'Wave 2', dataSource: 'mock', sourcePath: 'app/po-intake/page.tsx' },
  { path: '/it-admin',      title: 'IT / System Admin',           summary: '9 integrations monitored, sync queue, failed events, user provisioning, audit log.',
    category: 'Admin', blueprintId: 'S14', wave: 'Wave 1', dataSource: 'mock', dataNote: 'Integration health is inline mock; production reads from real connectors.', sourcePath: 'app/it-admin/page.tsx' },
  { path: '/invoices/[id]', title: 'Invoice Detail',              summary: 'Printable invoice with line items + QB sync status.',
    category: 'Admin', blueprintId: 'S36a', wave: 'Wave 2', dataSource: 'mixed', sourcePath: 'app/invoices/[id]/page.tsx' },

  // Settings
  { path: '/settings',      title: 'Settings',                    summary: 'Settings landing — links to all sub-pages.',
    category: 'Settings', blueprintId: 'S40', wave: 'Wave 1', dataSource: 'live', sourcePath: 'app/settings/page.tsx' },
  { path: '/settings/printers', title: 'Printer Management',      summary: 'Fleet registry with capacity, ink set, location, queue depth.',
    category: 'Settings', blueprintId: 'S40a', wave: 'Wave 1', dataSource: 'mixed', sourcePath: 'app/settings/printers/page.tsx' },
  { path: '/settings/print-profiles', title: 'Print Profile Management', summary: 'ICC profile registry with PRINTER_FABRIC_INKSET_PROFILE naming.',
    category: 'Settings', blueprintId: 'S40b', wave: 'Wave 1', dataSource: 'live', sourcePath: 'app/settings/print-profiles/page.tsx' },
  { path: '/settings/roles',title: 'Roles & Permissions',         summary: '12 roles × 10 resources permissions matrix with R / RW / RWA cells.',
    category: 'Settings', blueprintId: 'S41', wave: 'Wave 1', dataSource: 'mock', sourcePath: 'app/settings/roles/page.tsx' },

  // Customer-facing
  { path: '/approve/[token]', title: 'Public Strike-Off Approval', summary: 'Customer-facing, no-login: Approve / Approve-with-Changes / Reject.',
    category: 'Customer-Facing', blueprintId: 'S26a', wave: 'Wave 1', dataSource: 'live', sourcePath: 'app/approve/[token]/page.tsx' },
];

// Match a runtime path to a registered page meta entry.
export function lookupMeta(pathname: string): PageMeta | undefined {
  const exact = PAGES.find((p) => p.path === pathname);
  if (exact) return exact;
  // Match dynamic routes — replace [param] with the runtime segment
  return PAGES.find((p) => {
    if (!p.path.includes('[')) return false;
    const regex = new RegExp('^' + p.path.replace(/\[[^\]]+\]/g, '[^/]+') + '$');
    return regex.test(pathname);
  });
}
