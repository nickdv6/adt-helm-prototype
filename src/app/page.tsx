// Landing page — first thing every reviewer sees. Frames what this prototype is,
// what's mock vs aspirational, and provides curated entry points so Ali doesn't
// have to navigate the sidebar to find the meaningful screens.
import Link from 'next/link';
import { Card, CardHeader, Tag } from '@/components/ui';
import { ArrowRight, Map, FileText, Stamp, Truck, ScanLine, BarChart3, Sliders, Users, GitBranch, Brush, Inbox as InboxIcon, Calendar, AlertTriangle, Server } from 'lucide-react';

export default function Landing() {
  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Hero */}
      <header className="space-y-3 pt-2">
        <Tag color="blue">Welcome</Tag>
        <h1 className="text-3xl font-bold text-navy-900">ADT Helm — clickable blueprint</h1>
        <p className="text-base text-gray-700 max-w-3xl">
          This prototype is a navigable mockup of the operational system ADT is building to replace
          Airtable + DASH. Every screen below is wired against a real schema and seeded with
          ~250 faker-generated orders so the workflows feel concrete. Nothing here is connected to
          live data, QuickBooks, Shopify, or any real customer record.
        </p>
        <div className="flex gap-2 pt-2">
          <Link href="/sitemap" className="inline-flex items-center px-4 py-2 text-sm font-semibold rounded bg-navy-700 text-white hover:bg-navy-900">
            Full sitemap →
          </Link>
          <Link href="/changelog" className="inline-flex items-center px-4 py-2 text-sm font-semibold rounded bg-white text-navy-700 border border-gray-300 hover:bg-gray-50">
            What&apos;s new
          </Link>
        </div>
      </header>

      {/* Key concepts */}
      <Card>
        <CardHeader title="Key concepts to know before you click around" />
        <div className="p-5 grid grid-cols-2 gap-x-8 gap-y-4 text-sm">
          <Concept term="Roadmap (R1–R8)"
            definition="The route an order takes through Helm. R1 = standard print & ship. R5 = strike-off → print → finish → cut/sew → ship. Pickable per order; drives the subway map." />
          <Concept term="PR · Print Request"
            definition="One scheduled print job. An order line spawns one or more PRs. A PR ends in printed yardage." />
          <Concept term="PLANT# (PYY-####)"
            definition="ADT's design ID, auto-generated on design creation (e.g. P26-1042). Year-resetting counter from 1000. Used in artwork file naming and the Design entity." />
          <Concept term="Strike-Off"
            definition="A test print sent to the customer for approval. 14-status workflow ending in Approved / Approved-with-Changes / Rejected. Required on R4 / R5 routes." />
          <Concept term="Roll"
            definition="A physical roll cut from a PR's printed yardage. Created only at pack-out time. One PR can yield multiple rolls (e.g. a 500-yard PR → 99 + 100 + 101 + 102 + 106 yards across 5 rolls)." />
          <Concept term="Traveler QR + CUT label"
            definition="QR printed below each artwork (encodes the lookup key). Cut/Sew scans the QR at the CUT station to print individual product labels with the right Insert Requirement." />
          <Concept term="PFP fabric"
            definition="Prepared For Print fabric. Dye Sub + Latex print on PFP directly; Fiber Reactive + Pigment need pretreatment chemistry first." />
          <Concept term="Promised vs Estimated date"
            definition="ADT only commits to a customer-facing 'promised' date once an order is internally approved. Before that, only an internal 'estimated' date exists. Late-flagging always uses Promised, never Estimated." />
        </div>
      </Card>

      {/* Guided tour */}
      <div>
        <h2 className="text-xl font-bold text-navy-900 mb-1">Guided tour — start here</h2>
        <p className="text-sm text-gray-600 mb-4">Curated entry points for the screens that best demonstrate what Helm does. Each link is a real page in the prototype.</p>
        <div className="grid grid-cols-3 gap-4">
          <TourCard icon={<Map className="w-5 h-5" />} href="/orders"
            title="Order Subway Map (S21)"
            description="Open any order to see per-PR visual subway maps plotting each PR along its roadmap route. The brand-vision screen." />
          <TourCard icon={<Stamp className="w-5 h-5" />} href="/strike-offs"
            title="Strike-Off Workflow (S25/S26/S26a)"
            description="14-status list → detail page with public approval link → click 'Open' to see the customer-facing approval page." />
          <TourCard icon={<FileText className="w-5 h-5" />} href="/intake"
            title="Intake Command Center (S42b)"
            description="The automated CSV/XML print intake — pipeline state, strike-off engine, composite engine, scan events." />
          <TourCard icon={<ScanLine className="w-5 h-5" />} href="/cut-station"
            title="CUT Station · Scan & Label"
            description="Scan a Traveler QR (try ADT-4506) → look up the order's line items → print individual CUT labels with the resolved Insert Requirement." />
          <TourCard icon={<GitBranch className="w-5 h-5" />} href="/roadmaps"
            title="Roadmap Builder (S22)"
            description="All 7 routes (R1, R2, R4, R5, R6, R7, R8) with live in-flight order counts and the rule that picks each route." />
          <TourCard icon={<Calendar className="w-5 h-5" />} href="/production-scheduling"
            title="Production Scheduling (S28)"
            description="7-day capacity calendar across the print fleet. Color coded by utilization, overbooked machines flagged." />
          <TourCard icon={<Brush className="w-5 h-5" />} href="/designs/import"
            title="Bulk Import Designs"
            description="CSV upload for designs + colorways + artwork file paths. Demonstrates validation + preview-then-commit pattern." />
          <TourCard icon={<BarChart3 className="w-5 h-5" />} href="/dashboards/daily-production"
            title="Daily Production Dashboard"
            description="Today's printer load + PR list with late tracking. Pair with Strike-Off / CSR / Quality dashboards for the manager surface." />
          <TourCard icon={<Server className="w-5 h-5" />} href="/it-admin"
            title="IT / System Admin (S14)"
            description="9 monitored integrations (QuickBooks, Shopify, PandaDoc, EasyPost, UPS/FedEx, NAS, RIP, DASH), sync queue, audit log. Future Integrations panel lists Suntech (planned) and HubSpot (out of scope)." />
        </div>
      </div>

      {/* Persona view */}
      <Card>
        <CardHeader title="Or — view the prototype as a specific person" subtitle="Each role has its own home page tailored to their day." />
        <div className="p-5 grid grid-cols-4 gap-3 text-sm">
          <PersonaLink href="/megan"          name="Megan Burleson"   role="Production Manager" />
          <PersonaLink href="/csr-home"       name="Sarah Castillo"   role="CSR" />
          <PersonaLink href="/colorist"       name="Jeannine Romero"  role="Colorist" />
          <PersonaLink href="/print-op-home"  name="Julio Vargas"     role="Print Operator" />
          <PersonaLink href="/finishing-home" name="Lucio Hernandez"  role="Finishing" />
          <PersonaLink href="/cut-sew-home"   name="Yuliana Cruz"     role="Cut/Sew" />
          <PersonaLink href="/inventory-home" name="Karen Boyd"       role="Inventory" />
          <PersonaLink href="/shipping-home"  name="Marcus Hill"      role="Shipping" />
          <PersonaLink href="/receiving-home" name="Tomás Rivera"     role="Receiving" />
          <PersonaLink href="/accounting-home" name="Diana Park"      role="Accounting" />
        </div>
        <div className="px-5 pb-4 text-xs text-gray-500 italic space-y-1">
          <div>Tip: the persona switcher in the top-right of the topbar deep-links you straight to a chosen role&apos;s home.</div>
          <div>Bonus tip: switching persona also re-prioritizes the left sidebar — the items that role uses every day rise to the top, the rest collapse into &quot;More — all sections&quot;. Try it.</div>
        </div>
      </Card>

      {/* What's mock disclaimer */}
      <Card className="border-yellow-200 bg-yellow-50/30">
        <CardHeader title="What's real vs. mock in this prototype" />
        <div className="p-5 text-sm text-gray-700 space-y-2">
          <p><strong>DB-backed (live from seed):</strong> Orders, Order Lines, Print Requests, PR Rolls, Strike-Offs, FPRs, Customers, Designs, Colorways, Fabrics, Printers, Inventory items, Master SKUs, Artwork Files, Notifications. Every dashboard, role home, and detail page reading these tables shows real, consistent data.</p>
          <p><strong>Inline mock (no schema yet):</strong> Exceptions (Exception Center + CSR home count), Returns / RMAs, Receiving inbound shipments, IT Admin integration health, Intake Command Center pipeline events, PO Intake queue, accounting QB sync queue. These pages exist to demonstrate the UX shape; production needs new tables.</p>
          <p><strong>Mixed:</strong> Some pages compose live data with mock metadata — e.g. Production Scheduling reads scheduled PRs from the DB but the per-printer daily capacity is a constant in the page.</p>
          <p>Every page has a thin annotation strip at the bottom showing its blueprint S## reference, Wave tag, data source, and a link to the source code on GitHub.</p>
        </div>
      </Card>

      {/* Footer / context */}
      <Card>
        <CardHeader title="About this prototype" />
        <div className="p-5 text-sm text-gray-700 space-y-2">
          <p>Built as a Next.js 14 App Router app with SQLite (better-sqlite3) seeded fresh on each deploy. Hosted on Vercel. Repo: <code className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">nickdv6/adt-helm-prototype</code>.</p>
          <p>Purpose: shared reference for ADT leadership, Sight Source (build partner), and department leads. Replaces verbal description with something everyone can click through and react to.</p>
          <p>Status: ~55 pages live, covering Wave 1 and most of Wave 2. The blueprint screen list calls for 77 total; see <Link href="/sitemap" className="text-navy-700 hover:underline font-semibold">/sitemap</Link> for what&apos;s built.</p>
        </div>
      </Card>
    </div>
  );
}

function Concept({ term, definition }: { term: string; definition: string }) {
  return (
    <div>
      <div className="font-semibold text-navy-700">{term}</div>
      <div className="text-gray-600 text-[13px] mt-0.5">{definition}</div>
    </div>
  );
}

function TourCard({ icon, href, title, description }: { icon: React.ReactNode; href: string; title: string; description: string }) {
  return (
    <Link href={href} className="block border border-gray-200 rounded-lg p-4 hover:border-navy-700/40 hover:bg-navy-50/30 transition-colors group">
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-navy-700">{icon}</span>
        <div className="font-semibold text-navy-900 text-sm">{title}</div>
      </div>
      <div className="text-xs text-gray-600 leading-relaxed">{description}</div>
      <div className="text-xs text-navy-700 mt-2 inline-flex items-center gap-1 group-hover:gap-2 transition-all">
        Open <ArrowRight className="w-3 h-3" />
      </div>
    </Link>
  );
}

function PersonaLink({ href, name, role }: { href: string; name: string; role: string }) {
  const initials = name.split(' ').map((p) => p[0]).join('').slice(0, 2);
  return (
    <Link href={href} className="flex items-center gap-2 border border-gray-200 rounded p-2 hover:bg-gray-50 hover:border-navy-700/30">
      <div className="w-8 h-8 rounded-full bg-navy-700 text-white flex items-center justify-center text-[10px] font-bold flex-shrink-0">{initials}</div>
      <div className="min-w-0">
        <div className="font-semibold text-navy-900 text-xs truncate">{name}</div>
        <div className="text-[10px] text-gray-500 truncate">{role}</div>
      </div>
    </Link>
  );
}
