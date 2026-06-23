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
    date: '2026-06-23',
    version: '1.4',
    title: 'Production Manager Home (S03) — visibility-only refresh',
    bullets: [
      'New full-width "Open Print Requests Due Within 7 Business Days" section at the top of /megan. Live operational reference: shows PR#, Order#, Customer, Assigned To, Status, Plant# · Design · Colorway, Fabric, Quantity, Promised Date, Due In (business days), Priority/Risk flags.',
      'Multi-select filters: Assigned To, Customer, Status (chip-count badges, click outside to close, in-dropdown Clear). Quick-filter chips: All, Overdue, Due Today, Due Tomorrow, Due This Week, Unassigned. Top-right Clear Filters action appears when any filter is active.',
      'Sortable columns (click header): Customer, Assigned, Status, Promised, Priority. Sort direction toggles on repeat click. Sticky table header inside a 640px scroll viewport so the header stays visible while scrolling.',
      'KPI strip: Open PRs due within 7 business days · Overdue · Due Today · Unassigned. Row click on a PR routes to /print-requests/[id]; Order# routes to /orders/[id] (existing routes preserved).',
      'Visual flags: overdue rows tinted red, today tinted yellow, Rush / Overdue / Today tag column. Due-In shows "N bd late" (red) or "N bd (Wed Jun 24)" for upcoming.',
      'Orders in Production is now full-width with expand/collapse per row. Each order row shows Order#, Customer, Roadmap, Status, PR count, Earliest Promised, Latest Promised, and Rush/Overdue flags. Expand shows one-line PR detail rows: PR#, Plant# · Design · Colorway, Fabric, Quantity, Status, Promised. Expand all / Collapse all controls in the card header.',
      'Removed from the dashboard view: PR Status Mix display, Approvals (OD-3 Gate) tab, Sales / Pipeline tab, Accounting Hand-Off tab. Underlying functions/workflows/components/routes/mock data/permissions/status logic are unchanged — Order Detail still runs the OD-3 approval flow, /intake still handles sales/CSV intake, /orders status filters still show invoice-ready, QuickBooks still owns A/R. Only the dashboard surface is decluttered.',
      'No schema changes. No new business rules. No new automation. No new operational decision logic. Filters/sorts mutate only the displayed list.',
    ],
  },
  {
    date: '2026-06-23',
    version: '1.3',
    title: 'Receiving Home — remove Expected Inbound mock; promote Receive Fabric to primary CTA',
    bullets: [
      'Removed the inline-mock "Expected Inbound" table (INB-3104 MillCo, INB-3105 St Frank cust-supply, etc.). Nothing real was feeding it — no inbound_shipments / purchase_orders / suppliers tables yet. Risked Ali reading it as a real-data surface.',
      'Promoted "Receive Fabric" to the centerpiece of the page: large icon tile + headline + descriptive sub-text + a big primary "Start a New Receipt" CTA. Header-right button kept for consistency.',
      'KPIs pivoted from inbound-side (Inbound today, This week) to received-side (Received today, Received this week, Failed last 7d).',
      'Recent receipts activity table kept — gives Tomás past-action verification context until a received_lots table lands.',
      'The /receiving-home/receive form, the Receiving role + permissions matrix entry, Tomás persona, sidebar entry, and tour link all stay. The intake flow is the real ADT-relevant capability and is preserved.',
    ],
  },
  {
    date: '2026-06-23',
    version: '1.2',
    title: 'Hash-locked color-match promotion workflow + Strike-Off Decision Engine',
    bullets: [
      'Decouples save from print. Every colorist save is captured by the agent (SHA256 + version row in artwork_files); printing requires explicit promote. A colorist iterating 7 times produces 7 versions in Helm with zero hot folder writes. Prevents accidental fabric/ink waste.',
      'Schema: artwork_files gains file_hash (SHA256), working_path, colorist_user_id, comment, is_strike_off_candidate, promoted_at, approved_at, approved_by_strike_off_id. print_requests.production_artwork_file_id = the canonical bytes the dispatcher uses (NOT "the most recent file"). Indexed by hash.',
      'New endpoint POST /api/artwork-saved — agent file-watcher webhook. On every save event the agent posts hash + working_path + colorist + comment. Creates an artwork_files row; never prints. Duplicate-hash detection: same bytes saved twice = no new row (common NS Canvas auto-save case).',
      'New endpoint POST /api/decide-strike-off — Strike-Off Decision Engine. Given a PR, decides whether a strike is required, with reason. 9 decisions: reuse_approved_skip_strike (reorder path, ~5 min), skip_strike_per_customer_profile (St Frank C&P), strike_required_new_design / _new_colorway / _new_customer, restrike_required_icc_drift / _approval_stale / _printer_mismatch.',
      'New endpoint POST /api/promote-to-strike-off — colorist explicitly promotes 1 or 2-4 versions to a strike-off. Single-variant = standard strike. Multi-variant lays 2-4 versions side-by-side on one print run, customer compares and picks the winner. Eliminates 2-3 redundant strike-off cycles per design.',
      'Color Match · Version History card on PR Detail. Shows full version chain (hash, file, colorist, comment, status), the decision engine output as a banner, the canonical production hash highlighted in green, and the Submit for Strike-Off button (single/multi-variant toggle in modal).',
      'Phase 1.8 dispatcher updated. Now joins to production_artwork_file_id and surfaces canonical_source (id, file_name, nas_path, SHA256, version) in the response. New validation checks: "Canonical artwork file resolved" (Phase 1.11 hash-lock) + "Hash verification at dispatch time" (would re-hash the file on disk and EX-HASH-MISMATCH if not matching the canonical hash; catches NAS sync issues + file corruption + wrong-file operator clicks).',
      'Strike-offs: schema gains change_severity (minor_color_tweak | substantive_change) so "Approve with Changes" doesn\'t force a redundant strike for a 2-shade navy tweak; minor goes direct to production with a new hash. Also is_multi_variant + variant_artwork_file_ids + icc_profile_version_at_approval + printer_id_at_approval for ICC drift + printer mismatch detection.',
      'Customers: skip_strike_for_new_colorways + skip_strike_for_reorders + approval_freshness_days (default 365) on companies — the Customer Automation Profile surface the decision engine consults before applying default rules. St Frank + Inside flagged as Click-and-Print in seed.',
      'Printers: current_icc_profile_version + icc_profile_updated_at — when ICC drifts from the approved snapshot, decision engine forces re-qualification strike.',
      'Seed: every (design, colorway) gets 2-5 version chain rows with realistic hash + colorist + comment. PRs wired to canonical approved artwork (~70% have a production_artwork_file_id). Printers seeded with current_icc_profile_version.',
    ],
  },
  {
    date: '2026-06-23',
    version: '1.1',
    title: 'Role-aware sidebar — prioritize nav items by active persona',
    bullets: [
      'Sidebar converted to a client component. Reads the active role from localStorage (same key the topbar persona switcher writes to). Items relevant to the current role render at full opacity above the fold; everything else collapses into an expandable "More — all sections" region at the bottom.',
      'Each NavItem now declares the roles it is primary for. Admin sees everything (no filtering). Other roles see a focused surface — Julio (Print Op) primary view: Print Op Home, PR Dashboard, Printer Queue, Cut Station, Daily Production Dashboard, Exception Center. Diana (Accounting) primary view: Accounting Home, Order Dashboard, Customers. Etc.',
      'Same-tab role switching: topbar persona picker now dispatches a custom event (helm.role.changed) the sidebar listens for, so role switches feel instant within a single tab. Cross-tab sync still works via the standard storage event.',
      '"Viewing as [Role]" indicator at the top of the sidebar when not viewing as Admin — explicit cue that the surface is filtered.',
      'Audited each role\'s primary surface against their role home + their day-to-day tasks; matches the permissions matrix on /settings/roles.',
    ],
  },
  {
    date: '2026-06-23',
    version: '1.0',
    title: 'NeoStampa integration — vendor risk surface + abstraction layer (caps Phase 1)',
    bullets: [
      'Schema: hot_folders.rip_target (default \'inedit_neostampa\') + rip_jobs.xml_spec_version (default \'4.23.0\'). Forward compat for swapping RIP backends per-printer + tracking which spec each XML was built against so in-flight jobs continue under their original version when Inèdit upgrades roll out.',
      'New "RIP Backend · Vendor Risk & Mitigation" panel on /it-admin laying out: what\'s pinned to Inèdit (XML element shape, notification URL format, RapportInfo, CGI flags) and where each pin lives in code — and what\'s NOT pinned (external_job_name is Helm\'s convention, rip_jobs lives in Helm\'s DB, QR scan = ground truth, three inbound channels, rip_target column allows config-only swap).',
      '7-step runbook for when Inèdit ships a spec change (read release notes → update buildNeoStampaXml → bump default xml_spec_version → in-flight rows continue under original spec → update agent parser → run CI → staged rollout).',
      'Fallback options if Inèdit goes EOL: EFI Fiery / ColorGate Productionserver / Caldera GrandRIP+ all use similar XML job-ticket models. .xjb archives preserve history. PR Detail + Reconciliation Queue + dispatcher API are vendor-independent.',
      'Caps Phase 1: NeoStampa integration is now end-to-end complete — Helm-side dispatcher (1.8) → XML drop to hot folder → Inèdit RIP/print → agent reports events → /api/rip-events updates Helm → physical QR scan promotes to ground truth → all denormalized to print_requests. Two origins handled (Helm + Canvas) + Reconciliation Queue + vendor risk documented.',
    ],
  },
  {
    date: '2026-06-23',
    version: '0.9',
    title: 'Helm-side dispatcher — POST /api/dispatch-to-rip + PR Detail button',
    bullets: [
      'Closes the upstream gap: when a PR is ready_for_rip, the dispatcher endpoint now generates the external_job_name, picks the hot folder (rush lane on Durst for Rush orders), generates the Inèdit XML, and returns the four-write transaction plan (INSERT fabric_outputs + INSERT rip_jobs + UPDATE print_requests + WRITE file to hot folder).',
      '9-step validation trace returned in the response: PR exists / not cancelled / has printer / dispatchable state / rip_status allows it / not held / strike-off approved (if OD-9 required) / no name collision / hot folder available.',
      'Reprint collision handling: if a rip_job with the unsuffixed name already exists, appends _R2 / _R3 etc. until UNIQUE. The retry_count on the new row equals the suffix.',
      'New Dispatch to RIP button on PR Detail Actions card — appears when pr.rip_status = not_started OR error. Opens a modal showing the validation trace, hot folder selection, the four atomic writes, and the generated XML inline (with download).',
      'Watchdog timer: dispatch schedules a check at +4h. If no print_completed_software event by then, raises EX-RIP-NO-CONFIRM.',
    ],
  },
  {
    date: '2026-06-23',
    version: '0.8',
    title: 'Canvas-originated jobs — Reconciliation Queue + two-origin model',
    bullets: [
      'Real-world fix per Nick: many RIP jobs originate in the NeoStampa Canvas GUI (colorist opens a file, makes adjustments, clicks print) — NOT in Helm as an XML hot-folder drop. Helm now handles both origins.',
      'Schema: rip_jobs.print_request_id is now NULLABLE; new columns origin (helm | neostampa_gui | unknown), neostampa_job_id (NS-internal ID), auto_match_score (0-100 confidence), reconciliation_status (attributed / awaiting_review / auto_matched / manual_associated / flagged_no_pr).',
      'Seed: 12 unattributed Canvas-originated jobs added, with realistic NeoStampa filenames — some contain PR-#### (high-confidence auto-match), some PLANT# (medium), some are vague (manual review required), some flagged as internal color-match prints with no PR association.',
      'API: /api/rip-events gains two new event types — agent_observed_job (agent reports a new NS job, Helm parses the filename for PR-#### or PLANT# and either auto-binds or routes to Reconciliation Queue) and manual_associate (operator binds a NS job to a PR from the queue UI).',
      'New section on /printer-queue: "NeoStampa Reconciliation Queue" — Canvas-originated jobs awaiting review, with per-row Bind to PR / Flag · no PR actions. Sorted by reconciliation status priority.',
      'Existing "RIP · NeoStampa Activity" section filtered to origin=helm only — the two queues no longer overlap.',
      'XML Preview footer + IT/Admin webhook contract card updated with the two-origin model. Live test links for auto-match (95% confidence) vs no-match (Reconciliation Queue) responses.',
    ],
  },
  {
    date: '2026-06-23',
    version: '0.7',
    title: 'RIP event identity binding — UNIQUE constraint + live /api/rip-events webhook',
    bullets: [
      'rip_jobs.external_job_name now has a UNIQUE constraint — duplicate NeoStampa job names are blocked at the DB layer, not just by exception EX-2424.',
      'New live endpoint: GET/POST /api/rip-events — the webhook NeoStampa Sync Agents call when print events fire. Supports both shapes: Inèdit-style GET with query params (per spec p.85 Notification URL format) and modern POST with JSON body.',
      'Endpoint validates input, looks up the RipJob by external_job_name, and returns the would-be write (insert into rip_job_events + update rip_jobs.status). On Vercel the SQLite filesystem is read-only at runtime so writes are mocked; production (Postgres) executes the persist.',
      'Orphaned-event handling: if no RipJob exists with the given external_job_name → 400 / EX-RIP-ORPHANED raised. Includes possible-causes hints for the operator.',
      'PR-mismatch detection: if the request carries a pr param that doesn\'t match the external_job_name resolution → 400 with the mismatch detail (catches agent-side bugs).',
      'IT/Admin: new Webhook API contract card under the NeoStampa Sync Agents panel — endpoint URL, sample Inèdit GET + agent POST, success response shape, status codes, live links to the JSON contract docs + a 404 test URL.',
      'GET /api/rip-events with no params returns the full machine-readable contract spec (event mappings, query params, response codes, identity-binding philosophy).',
    ],
  },
  {
    date: '2026-06-23',
    version: '0.6',
    title: 'NeoStampa XML preview — built against the real Inèdit spec',
    bullets: [
      'New NeoStampaXmlPreview component generates a complete job ticket XML per Inèdit neoRipEngine 4.23.0 spec — Job/Sources/Layout/Page/Objects/Transformations/Output/Notifications/RapportInfo all match the actual element shape Inèdit defines.',
      'PR Detail · RIP·NeoStampa card: new "View XML" button opens a modal showing the actual XML that would be generated for that PR, with Copy + Download .xml + Close. Generated client-side from the PR data so each PR shows its own deterministic ticket.',
      'XML uses real ADT NAS paths, real PLANT# / design / colorway / fabric in the Source URLs, the printer-specific ICC profile in <ConvertProfile> + <OutputProfile>, textile RapportInfo for pattern repeat, and Notification URLs that POST back to /api/rip-events for printingStart/End/Abort/Message events.',
      'IT/Admin NeoStampa panel terminology updated to match Inèdit: agents run neoRipEngineCGI as a Windows service, cite the spec section + page numbers for Notifications + CGI flags, mention .xjb job-export format.',
    ],
  },
  {
    date: '2026-06-22',
    version: '0.5',
    title: 'NeoStampa Sync — Phase 1 foundation',
    bullets: [
      'New entities: rip_jobs, rip_job_events, hot_folders, neostampa_agents, fabric_outputs — wraps the existing composite step into a full 12-state RIP lifecycle.',
      'External job name pattern threaded through every PR: CUSTOMER_PR-#_FO-#_DESIGN_COLORWAY_yyYD.',
      'PR Detail: new RIP · NeoStampa Activity card with status pill, agent, hot folder, FabricOutput QR, retry count, and an event timeline. Subsumes the standalone Composite card.',
      'Printer Queue: new "RIP · NeoStampa Activity" section listing all active RipJobs with external job name, agent + heartbeat, retries, QR-confirmed flag, per-row Submit/Retry/Release actions.',
      'Intake Command Center: new Auto-RIP Engine panel with 6 counters (Ready / In flight / Awaiting QR / QR confirmed / Errors / Held) + recent jobs table.',
      'IT / System Admin: new NeoStampa Sync Agents panel — 4 agents (RIP-Bay-A/B/C/D), heartbeats, jobs processed/failed today, NeoStampa version, notes.',
      '5 new exception types: NeoStampa Agent Offline, Hot Folder Unreachable, Duplicate External Job Name, RIP Failure, QR Confirmation Missing.',
      'Seed: 7 hot folders (one per printer + 1 rush lane on Durst), 4 agents, RipJobs distributed across all 12 statuses with realistic ~7% error + ~3% held rate.',
    ],
  },
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
