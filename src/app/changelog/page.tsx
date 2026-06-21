// Changelog — manually curated highlights. Easier to read than raw git log.
// Update by hand whenever a meaningful batch ships.
import Link from 'next/link';
import { Card, CardHeader, Tag } from '@/components/ui';

type Entry = {
  date: string;     // YYYY-MM-DD
  version: string;
  title: string;
  bullets: string[];
};

const ENTRIES: Entry[] = [
  {
    date: '2026-06-21',
    version: '0.4',
    title: 'Prototype navigation upgrades + Receive Fabric form',
    bullets: [
      'New landing page with guided tour entry points and key-concept glossary.',
      'Persistent top banner identifying the prototype + version + that all data is mock.',
      'Per-page annotation strip at the bottom of every page showing blueprint S##, Wave, data source, and a link to source on GitHub.',
      'Sitemap page at /sitemap — every page in the prototype, grouped by category.',
      'Persona switcher in topbar expanded to all 11 roles (Karen, Marcus, Tomás, Diana added; deep-links now point to the new role homes).',
      'New /receiving-home/receive form: owner, mill, GHL LOT#, yardage, rolls, condition, sample-cut confirmation, white-point L*a*b*, absorbency pass/fail.',
      'PR Detail re-laid-out: Artwork Preview now top-right, all context cards stacked at half width on the left.',
    ],
  },
  {
    date: '2026-06-20',
    version: '0.3',
    title: 'Audit fixes + sidebar cleanup',
    bullets: [
      'Fixed two crashing bugs in role home pages (CSR exceptions query, accounting-home column name).',
      'Removed /accounting workflow page; kept /accounting-home and /invoices/[id].',
      'Removed Accounting from sidebar Role Homes (page still reachable via direct URL).',
    ],
  },
  {
    date: '2026-06-19',
    version: '0.2',
    title: 'Tier 2 build — 16 new pages',
    bullets: [
      '8 department role homes: CSR, Print Operator, Finishing, Cut/Sew, Inventory, Shipping, Receiving, Accounting — each with KPIs + My Queue + Recent Activity + Cross-links.',
      '/production-scheduling — 7-day capacity calendar across the print fleet.',
      '/shipments/[id] — single shipment with rolls, label preview, 3rd-party billing.',
      '/returns — RMA dashboard (mock data; no schema yet).',
      '/invoices/[id] — printable invoice with QB sync status.',
      'Settings sub-pages: /settings/printers, /settings/print-profiles, /settings/roles (12×10 permissions matrix).',
      'Added 4 missing department users to seed (Karen Boyd, Marcus Hill, Tomás Rivera, Diana Park).',
    ],
  },
  {
    date: '2026-06-19',
    version: '0.1.5',
    title: 'Tier 1 build — 10 blueprint screens + bulk import',
    bullets: [
      'S21 Order Detail: per-PR visual subway map plotting each PR along its roadmap.',
      'S22 Roadmap Builder: 7 routes with live in-flight counts and assignment rules.',
      'S25 Strike-Off List + S26 Detail + S26a Public Approval Page (customer-facing, no-login).',
      'S27 Artwork Management with PLANT#_DESIGN_COLORWAY_VERSION naming validator.',
      'S44 Daily Production, S46 Strike-Off, S51 CSR, S53 Quality dashboards.',
      'New /designs/import bulk CSV upload with validation + preview-then-commit.',
    ],
  },
  {
    date: '2026-06-19',
    version: '0.1',
    title: 'Initial prototype scaffold',
    bullets: [
      'Next.js 14 App Router + SQLite via better-sqlite3 + Tailwind.',
      'Seeded ~250 orders with realistic statuses across all roadmaps.',
      'Core pages: PR Dashboard, Order Dashboard, Customer Detail (DASH-style), Shipping, Inventory, Exception Center.',
      'S14 IT / System Admin, Intake Command Center (S42b), CUT Station Scan & Label (S56), Traveler Compositing Engine.',
    ],
  },
];

export default function Changelog() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-navy-900">Changelog</h1>
        <p className="text-sm text-gray-600 mt-1">What changed in the prototype, most recent first. See <Link href="/sitemap" className="text-navy-700 hover:underline">/sitemap</Link> for a complete current-state inventory.</p>
      </header>

      <div className="space-y-4">
        {ENTRIES.map((e) => (
          <Card key={e.version}>
            <CardHeader
              title={e.title}
              subtitle={`v${e.version} · ${new Date(e.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`}
              action={<Tag color="blue">v{e.version}</Tag>}
            />
            <div className="p-5">
              <ul className="space-y-1.5 text-sm">
                {e.bullets.map((b, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-navy-700 mt-0.5">▸</span>
                    <span className="text-gray-700">{b}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader title="Underlying git history" />
        <div className="p-5 text-sm text-gray-600">
          Full commit log at <a href="https://github.com/nickdv6/adt-helm-prototype/commits/main" target="_blank" rel="noreferrer" className="font-mono text-xs text-navy-700 hover:underline">github.com/nickdv6/adt-helm-prototype/commits/main</a>.
        </div>
      </Card>
    </div>
  );
}
