// /glossary — ADT Helm terminology reference.
// Quick lookup for reviewers (Ali / Sight Source) + new ADT staff.
// Acronyms and shop-floor jargon defined in one place so we don't expand them
// on every screen.

import Link from 'next/link';
import { Card, CardHeader } from '@/components/ui';

export const dynamic = 'force-dynamic';

type Term = {
  term: string;
  category: string;
  short: string;
  detail: string;
};

const TERMS: Term[] = [
  // ---------- Identifiers ----------
  {
    term: 'PLANT#',
    category: 'Identifier',
    short: 'Internal design identifier — format PYY-#### (e.g. P26-1042).',
    detail: 'DASH-generated counter that resets each year, starts at 1000. Used in artwork file naming (PLANT#_DESIGN_COLORWAY_VERSION.tiff) and embedded in NeoStampa job names.',
  },
  {
    term: 'PR # / pr_number',
    category: 'Identifier',
    short: 'Print Request number — format PR-#####.',
    detail: 'A PR is the unit of work for one printed run of one design+colorway on one fabric. One Order can contain many PRs. Reprints append _R2 / _R3 suffix or have their own pr_number with reprint_of_pr_id linking back.',
  },
  {
    term: 'FO-#####',
    category: 'Identifier',
    short: 'Fabric Output QR — the parent Traveler QR for one printed run.',
    detail: 'Generated when a PR is dispatched to RIP. Printed below the artwork on every yard. Scanning it at the CUT station looks up the PR and triggers Bundle QR generation.',
  },
  {
    term: 'VPN',
    category: 'Identifier',
    short: 'Vendor Part Number — the customer\'s SKU on their PO line.',
    detail: 'St Frank, Inside Home, and similar customers list a VPN per line (ST-PIL-22-OUT, IH-CYP-PIL-18, etc.). Master SKU mapping translates VPN → Helm product type + insert requirement on CUT labels.',
  },

  // ---------- Workflow concepts ----------
  {
    term: 'Roadmap',
    category: 'Workflow',
    short: 'The route an Order follows from intake to shipment.',
    detail: 'R1–R8 encode different combinations: print only, print+finish, print+cut/sew, customer-supplied material, click-and-print, etc. Set on order entry; drives which production steps are required.',
  },
  {
    term: 'Roadmap Builder',
    category: 'Workflow',
    short: 'Admin tool to define new roadmaps (the routes orders follow) without engineering involvement.',
    detail: 'Direction confirmed per Ali clarification #4 (NICK lean): build the configurable Roadmap Builder rather than hardcoding R1–R8. Lets ADT add/adapt roadmaps as customer relationships evolve without re-engaging Sight Source. Surface at /roadmaps.',
  },
  {
    term: 'Rush',
    category: 'Workflow',
    short: 'Priority escalation flag on an order (orders.is_rush).',
    detail: 'Per Ali clarification #28 (NICK-confirmed): never interrupts a mid-print job. CSR may request, Megan/Nick grant. Steps are NOT skipped on rush — finishing/QC/cut/sew all still happen. There is no override-on-skip pathway; rush only re-orders the queue.',
  },
  {
    term: 'Slip-in',
    category: 'Workflow',
    short: 'Printing a lower-priority PR while its base fabric is already loaded — saves a fabric changeover.',
    detail: 'Per Ali clarification #27 (NICK-confirmed): when a base fabric is already on the printer and that fabric has other queued PRs, Helm suggests printing those PRs in-line. Only wise IF (a) the fabric is not already allocated to another order, AND (b) the printer is fast enough that the slip-in won\'t affect day-capacity for higher-priority time-sensitive orders (Durst yes, Zimmer no). Megan-granted.',
  },
  {
    term: 'Notifications',
    category: 'Workflow',
    short: '11 notification templates per Ali clarification #15 — some auto, some manual, mix of internal + production team.',
    detail: 'Auto-release: new order intake, rush flagged, order matched a rule, internal proof requested, PR/RIP error, ready to ship, order shipped + tracking, promised date will slip, exception assigned to you, bundle issue raised. MANUAL release: credit hold (Helm does not pull live A/R data from QuickBooks — credit hold notifications are manually triggered by Accounting per #15 NICK note).',
  },
  {
    term: 'OD-3 / Approval Gate',
    category: 'Workflow',
    short: '6-trigger gate that requires Megan\'s approval before an order moves to production.',
    detail: 'OR logic across: new customer, new artwork, rush, high value, manual flag, prior issue. Orders sit in "Waiting on Approval" status until Megan reviews on Order Detail.',
  },
  {
    term: 'OD-9 / Strike-Off Classification',
    category: 'Workflow',
    short: 'Per-line classification of whether a strike-off is required.',
    detail: 'Three values per order line: Customer Strike-Off Required, ADT Strike-Off Required, No Strike-Off Required. Set at intake based on Customer Automation Profile + design/colorway novelty.',
  },
  {
    term: 'Click-and-Print',
    category: 'Workflow',
    short: 'Pre-approved customer arrangement that skips strike-off for new colorways on existing designs.',
    detail: 'Set by companies.skip_strike_for_new_colorways = 1. Used today by St Frank + Inside. The Strike-Off Decision Engine consults this flag before applying default rules.',
  },
  {
    term: 'Customer Automation Profile',
    category: 'Workflow',
    short: 'Per-customer flags that drive intake automation + decision engines.',
    detail: 'Currently 3 fields on companies: skip_strike_for_new_colorways, skip_strike_for_reorders, approval_freshness_days. Full profile is Wave 2 and will include intake_config_id, packaging_profile_id, etc.',
  },
  {
    term: 'Customer Fulfillment Profile',
    category: 'Workflow',
    short: 'Per-customer free-text + flag rules that govern how an order is packed and shipped.',
    detail: 'Phase 1.14 minimum surface: substitution_notes + fulfillment_notes (free-text) on companies. Per Ali kickoff: substitution decisions are too varied to encode in a rules engine — capture as text. Full CFP entity (~14 fields per Ali spec) is Wave 2 and will subsume blind_ship, label modes A/B/C, branded supplies, etc.',
  },
  {
    term: 'Additional Services (deprecated)',
    category: 'Workflow',
    short: 'DASH artifact: legacy flag bucket containing RUSH, BLIND SHIP, CAD SERVICES, INSURE PACKAGE.',
    detail: 'Per Ali kickoff (Phase 1.14): the umbrella term is deprecated in Helm. Each former flag has a first-class home — orders.is_rush, orders.is_blind_ship, orders.requires_cad_services, orders.insure_package — all rendered as tags on Order Detail + Shipping surfaces.',
  },
  {
    term: 'CAD Services',
    category: 'Workflow',
    short: 'Design digitization charge applied to an order. First-class boolean flag (orders.requires_cad_services) since Phase 1.14.',
    detail: 'Formerly part of the DASH "Additional Services" bucket. Tagged on Order Detail, Shipping pages, Shipment Detail. When set, billing knows to add the CAD setup line during invoice generation.',
  },
  {
    term: 'Insure Package',
    category: 'Workflow',
    short: 'Carrier package insurance requested on this order. First-class boolean flag (orders.insure_package) since Phase 1.14.',
    detail: 'Formerly part of the DASH "Additional Services" bucket. Tagged on Order Detail, Shipping pages, Shipment Detail. Drives the EasyPost/UPS/FedEx insurance flag at label generation.',
  },

  // ---------- Production ----------
  {
    term: 'Strike-Off',
    category: 'Production',
    short: 'A test print sent to the customer for color/scale approval before production.',
    detail: '14-state lifecycle. Approval is hash-locked: the customer approves specific bytes (SHA256), not "a file." Approved hash becomes the canonical production source via print_requests.production_artwork_file_id.',
  },
  {
    term: 'Multi-Variant Strike-Off',
    category: 'Production',
    short: 'A strike-off run with 2–4 versions laid out side-by-side on one fabric piece.',
    detail: 'Colorist promotes multiple artwork file IDs; the composite engine arranges them. Customer picks the winner; winner becomes canonical, losers archived. Reduces redundant strike cycles when comparing color variants.',
  },
  {
    term: 'FPR',
    category: 'Production',
    short: 'Finished Product Request — a downstream cut/sew job created from a completed PR or stored inventory pickup.',
    detail: 'FPRs come from two sources: production (PR completes → FPR for cut/sew) or Shopify-style stored-inventory orders. Both surface in the Cut/Sew Queue / Fulfillment Requests views.',
  },
  {
    term: 'Composite Engine',
    category: 'Production',
    short: 'The service that combines artwork + Traveler QR + metadata strip into the printable file.',
    detail: 'Triggered by the dispatcher when a PR moves to ready_for_rip. Writes the composite to the printer\'s hot folder + generates the Inèdit neoRipEngine XML job ticket alongside.',
  },
  {
    term: 'Traveler QR',
    category: 'Production',
    short: 'The QR printed below the artwork on every yard of fabric.',
    detail: 'Payload = FO-##### (Fabric Output ID). Survives the entire production journey. Scanning at any station looks up PR + Order. Promotes RIP state from print_complete_software to print_complete_qr (ground truth).',
  },
  {
    term: 'Bundle QR',
    category: 'Production',
    short: 'Per-cut-piece QR generated at the CUT Station.',
    detail: 'Child of the Traveler QR. Encodes the specific cut piece + insert requirement. Used downstream by Cut/Sew + Packing.',
  },

  // ---------- Inventory ----------
  {
    term: 'Open Bank',
    category: 'Inventory',
    short: 'Customer-supplied fabric stored at ADT for use across multiple future orders.',
    detail: 'Tracked in customer_materials with material_type=open_bank. Drawn against incrementally — draw_history_json logs each pull. Distinct from per_pr customer material which is tied to a single PR.',
  },
  {
    term: 'PFP',
    category: 'Inventory',
    short: 'Prepared For Print — fabric that has been pretreated and is ready for digital printing.',
    detail: 'St Frank and Inside Home typically supply PFP linen/cotton. Receiving logs LOT# + white-point L*a*b* + absorbency pass/fail.',
  },

  // ---------- Integration ----------
  {
    term: 'NeoStampa',
    category: 'Integration',
    short: 'The RIP software (by Inèdit) that drives ADT\'s textile printers.',
    detail: 'Helm dispatches XML job tickets via hot folder OR observes Canvas-originated jobs via Sync Agents. Spec version 4.23.0 today; per-PR xml_spec_version pinning preserves in-flight jobs across upgrades.',
  },
  {
    term: 'Sync Agent',
    category: 'Integration',
    short: 'Windows service that bridges NeoStampa events to Helm via webhook.',
    detail: 'One per RIP workstation. Tails NeoStampa logs, watches hot folders, fires POST /api/rip-events on every state change. Handles both Helm-originated and Canvas-originated jobs.',
  },
  {
    term: 'Reconciliation Queue',
    category: 'Integration',
    short: 'Unattributed Canvas-originated RIP jobs awaiting binding to a PR.',
    detail: 'Lives on /printer-queue. Each row was observed by the agent but couldn\'t auto-match to a Helm PR by filename pattern. CSR / Print Op manually binds or flags "no PR" (internal test print).',
  },
  {
    term: 'DASH',
    category: 'Integration',
    short: 'Legacy ADT SQL system. Source of design numbers (PLANT#) and historical orders.',
    detail: 'Helm reads from DASH today (PLANT# generation, intake). Long-term cutover plan: Helm becomes the source of truth, DASH retired.',
  },
  {
    term: 'Suntech (future integration)',
    category: 'Integration',
    short: 'Inspection machine — eventually pulls roll inspection data into Helm automatically.',
    detail: 'Known future integration per Ali kickoff (Phase 1.14). Data points captured per roll: number of rolls, yardage per roll, weight, dimensions. Not Phase 1 build. Suntech docs to be provided to Sight Source separately.',
  },
  {
    term: 'HubSpot (out of scope)',
    category: 'Integration',
    short: 'Marked OUT OF SCOPE per Ali kickoff. Customer profile master record lives in Helm.',
    detail: 'companies.hubspot_owner_email column is retained as a vestigial DASH artifact (no live sync). CSR-driven /customer-configs is the master surface; no second source of truth needed.',
  },
  {
    term: 'QuickBooks Sales Order Sync',
    category: 'Integration',
    short: 'Phase 1 daily push: each day\'s orders export to QuickBooks as Sales Orders.',
    detail: 'Per Ali clarification #37 (NICK-confirmed): Helm exports daily orders to QB as Sales Orders. SKU-to-QB-item-ID translation via master_skus.qb_item_id (covers SKUs that exceed QB\'s 31-char limit). No reverse sync — A/R, invoicing, payment tracking all live in QB.',
  },
  {
    term: 'QB Item ID Alias',
    category: 'Integration',
    short: 'master_skus.qb_item_id — short QB-side identifier that maps to an ADT SKU exceeding 31 characters.',
    detail: 'Per Ali clarification #1 (NICK-confirmed). QuickBooks caps item names at 31 chars; ADT SKUs (especially PILLOW-{design}-{colorway}-{front}-{back}-{producttype}-{fabrictype}-{size}-{insertType}) routinely exceed this. master_skus.qb_alias_required flags SKUs that need an alias; master_skus.qb_item_id stores it. Sales Order export uses qb_item_id when present, otherwise the SKU string.',
  },
  {
    term: 'LTL Pallet Shipment',
    category: 'Integration',
    short: 'Friday consolidated pallet shipments for Kravet, Lemieux, etc. Helm generates BOL PDF + standard packing list.',
    detail: 'Per Ali clarification #44 (NICK-confirmed): Helm generates the BOL PDF and a standard packing list. Operator either uploads to whatever LTL portal the customer uses, or prints for the carrier pickup. No carrier API integration. "Ready to ship" for these customers means HOLD AND CONSOLIDATE, not ship immediately.',
  },
  {
    term: 'Shipping Centralization Intent',
    category: 'Integration',
    short: 'Open decision per Ali #36: centralized shipping dashboard regardless of carrier-tool choice.',
    detail: 'Nick\'s intent (#36): one shipping department dashboard with package details per order/PR, 3rd-party billing context, and rate comparison for ADT-paid shipments. Two paths: (1) keep FedEx Ship Manager + UPS WorldShip + Helm exposes label-data API; or (2) consolidate via EasyPost if the rewrite is more cost-effective. Decision pending.',
  },
];

// Group by category in render
const CATEGORIES = ['Identifier', 'Workflow', 'Production', 'Inventory', 'Integration'];

export default function GlossaryPage() {
  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <header>
        <div className="flex items-center gap-3 mb-1">
          <Link href="/sitemap" className="text-sm text-gray-500 hover:underline">← Sitemap</Link>
        </div>
        <h1 className="text-2xl font-bold text-navy-900">Glossary</h1>
        <p className="text-sm text-gray-600 mt-1">Acronyms + shop-floor jargon defined once. Linked from page headers when the term first appears.</p>
      </header>

      {CATEGORIES.map((cat) => {
        const items = TERMS.filter((t) => t.category === cat);
        return (
          <Card key={cat}>
            <CardHeader title={cat} subtitle={`${items.length} term${items.length === 1 ? '' : 's'}`} />
            <div className="divide-y divide-gray-100">
              {items.map((t) => (
                <div key={t.term} className="px-5 py-4">
                  <div className="flex items-baseline gap-3 mb-1">
                    <span className="font-bold font-mono text-navy-900">{t.term}</span>
                    <span className="text-xs text-gray-500 italic">{t.short}</span>
                  </div>
                  <div className="text-sm text-gray-700">{t.detail}</div>
                </div>
              ))}
            </div>
          </Card>
        );
      })}

      <div className="text-xs text-gray-500 italic px-2">
        Missing a term? File it in the Decision Log or ask Nick.
      </div>
    </div>
  );
}
