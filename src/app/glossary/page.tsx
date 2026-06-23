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
