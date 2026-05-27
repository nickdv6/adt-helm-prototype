# ADT Helm — Clickable Prototype

Interactive walkthrough prototype for the ADT Helm operations system.
Built to validate the blueprint UX/UI and let dept leads click through real screens before Sight Source begins development.

**Status:** Path A + B scaffolded. 3 priority screens fully wired in Session 1 (S04 CSR Home, S20 Order Dashboard, S21 Order Detail). 9+ more screens coming in follow-up sessions.

---

## What this prototype is (and is not)

**Is:**
- A working Next.js 14 web app with a real SQLite database
- Seeded with a large, realistic fake dataset (~15 companies, 250 orders, ~400 print requests, ~120 designs with PLANT#s)
- Designed to match the blueprint's locked decisions (OD-3 approval gate, OD-7 packaging profile, OD-9 strike-off classification, S23-S32 Megan revisions, etc.)
- Deployable to Vercel in ~5 minutes so dept leads can click around from anywhere

**Is not:**
- Production code. No auth, no real integrations, no real validation, no real audit log writes.
- A drop-in starting point for Sight Source. They will build on their own stack. This is a **UX validation tool**, not a code seed.
- A complete prototype yet. About 25% of priority screens are interactive; the rest are stubbed or not built.

---

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 14 (App Router) | Server components keep this simple; no separate API layer needed |
| Language | TypeScript (strict) | Catches schema/UI drift early |
| Styling | Tailwind CSS + custom helm palette | Matches navy/green/yellow/red status tokens in blueprint |
| Components | Hand-rolled primitives in `src/components/ui.tsx` | Avoids shadcn install overhead for a throwaway prototype |
| Database | SQLite via `better-sqlite3` | In-process, file-based, no server. Schema mirrors blueprint data model |
| Seed data | `@faker-js/faker` with fixed seed | Deterministic — same data every time you reseed |
| Deploy | Vercel | Free, supports SQLite for prototypes (or swap to libSQL if needed) |

---

## Running locally

**Prerequisites:**
- Node.js 18+ (check: `node -v`)
- npm 9+ (ships with Node)

**First-time setup:**

```bash
cd helm-prototype
npm install
npm run seed       # builds data/helm.db with ~250 orders, ~400 PRs, etc.
npm run dev
```

Then open <http://localhost:3000>.

**Reseeding:** Run `npm run seed` again anytime. It wipes `data/helm.db` and rebuilds from scratch (deterministic — same data every time).

---

## What's built in Session 1

| Screen | Route | Status | Notes |
|---|---|---|---|
| **S04 CSR Home** | `/` | Working | Sarah Castillo's landing page. Stats row + Pending Orders + Recent Orders + CSV/XML Import Failures sidebar + Approval >7d stall surfacing + Credit Hold sidebar |
| **S20 Order Dashboard** | `/orders` | Working | Filter chips (All / Today / This Week / Late / On Hold / Awaiting Approval / Rush) with real SQL counts. Expandable rows show child PR#s per S23-S32.47 |
| **S21 Order Detail** | `/orders/[id]` | Working | Simplified top summary per S23-S32.48 (Megan A3). Per-line subway maps + nested PRs. OD-3 approval gate detail card if triggered. 3rd-party billing card if applicable |
| **S19 Order Entry** | `/orders/new` | Stub | Header form is interactive; line builder + OD-3 gate evaluation come next session |
| Sidebar nav | (global) | Working | Daily / Orders / Production / Fulfillment / Admin sections |
| Topbar | (global) | Working | Global search field + notification bell + user chip (Sarah Castillo, CSR) |

---

## What's coming in follow-up sessions

Roughly in priority order:

1. **S19 Order Entry — interactive line builder** (SKU picker, design+colorway+fabric attachment, strike-off classification dropdown per OD-9, click-and-print modifier, colorist assignment, OD-3 evaluation on Submit)
2. **S03 Megan Tabbed Home** (Sales / Production / Finance / Approvals tabs per S23-S32.50)
3. **S06 Colorist Home** with **internal pre-production proof review queue** per S23-S32.60
4. **S26a Public Customer Approval Page** (anon link, no login, mobile-friendly)
5. **S29 Printer Queue** (Julio's screen — printer cards, ink set, hot folder routing)
6. **S31 Cut/Sew Workboard** (Yuliana — bundle progress, marker layouts)
7. **S35 Pack-and-Ship + S35b Returns Dashboard**
8. **S40c Packaging Profile Management** (Megan's OD-7 22-field profile manager)
9. **S42b CSV/XML Intake + Auto-Route** (St Frank / Inside / Laura Park / Lemieux / Megastore — auto-routes to hot folders per S23-S32.61)
10. **Notifications Inbox** (49 notifications from Module Y)
11. **S24 Print Request Detail** (with internal proof approval flow)
12. **Role Switcher** (top-right dropdown so reviewers can hop between Sarah / Megan / Jeannine / Yuliana / Lucio / Julio without separate logins)

---

## Deploying to Vercel

The prototype is Vercel-ready out of the box. Recommended flow:

**1. Push to a fresh GitHub repo:**
```bash
cd helm-prototype
git init
git add -A
git commit -m "Initial scaffold"
gh repo create adt-helm-prototype --private --source=. --push
# or use GitHub UI to create the repo, then:
# git remote add origin git@github.com:YOUR_ORG/adt-helm-prototype.git
# git push -u origin main
```

**2. Connect to Vercel:**
- Go to <https://vercel.com/new>
- Import the `adt-helm-prototype` repo
- Framework preset: **Next.js** (auto-detected)
- Build command: `npm run build`
- **Important:** Add a build step to run the seed. In Vercel project settings → Build & Development Settings, override the install command to: `npm install && npm run seed`
- Deploy

**3. Lock it down:**
- Vercel project → Settings → Deployment Protection → enable **Vercel Authentication** (free) or **Password Protection** (Pro)
- This prevents random people from finding your prototype URL

**Note on SQLite + Vercel:** Vercel's serverless functions have an ephemeral filesystem. For a prototype where data resets on each cold start, this is fine — the seed runs at build time and the DB file ships with the deploy. If we want persistent writes (e.g., reviewers actually creating orders), we'd swap better-sqlite3 for [libSQL/Turso](https://turso.tech) (free tier, ~30 min migration). Not needed for read-mostly UX walkthroughs.

---

## Directory layout

```
helm-prototype/
├── data/                       # SQLite db lives here (gitignored)
├── public/
├── scripts/
│   └── seed.ts                 # Deterministic fake data generator
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── layout.tsx          # Sidebar + topbar shell
│   │   ├── page.tsx            # S04 CSR Home
│   │   ├── globals.css
│   │   └── orders/
│   │       ├── page.tsx        # S20 Order Dashboard
│   │       ├── new/page.tsx    # S19 Order Entry (stub)
│   │       └── [id]/page.tsx   # S21 Order Detail
│   ├── components/
│   │   ├── sidebar.tsx
│   │   ├── topbar.tsx
│   │   ├── ui.tsx              # Card, Button, StatusPill, Tag primitives
│   │   └── order-row.tsx       # Expand-rows client component for S20
│   ├── db/
│   │   └── schema.sql          # 45+ entities matching blueprint data model
│   └── lib/
│       ├── db.ts               # better-sqlite3 singleton
│       ├── types.ts            # TS interfaces matching schema
│       └── utils.ts            # formatDate, formatCurrency, relativeTime, cn
├── next.config.mjs
├── package.json
├── tailwind.config.ts
└── tsconfig.json
```

---

## Schema highlights (matches blueprint)

The SQLite schema in `src/db/schema.sql` mirrors the blueprint's data model and includes all the late-stage extensions:

- `companies.is_third_party_billed`, `carrier_account_number`, `carrier_account_carrier` (per S35-S36.35)
- `designs.plant_number` (PYY-#### format), `plant_year`, `plant_sequence` (DASH-generated)
- `orders.approval_required`, `trigger_reason`, `trigger_source`, `approved_by_user_id`, `approval_completed_at` (OD-3 6-trigger gate)
- `order_lines.strike_off_classification` (OD-9 6-option enum), `is_click_and_print` (per S23-S32.62)
- `print_requests.internal_proof_status`, `was_csv_auto_routed`, `hot_folder_target` (per S23-S32.60/.61)
- `packaging_profiles` (all 22 OD-7 baseline fields)
- `fprs.packaging_profile_override_id`, `missing_component_override_json` (per OD-7)
- `customer_materials.material_type` (per_pr | open_bank), `draw_history_json` (per Megan C1)
- `intake_configs.auto_route_enabled` (per S23-S32.61)
- 19-status PR lifecycle including "Pending Internal Proof"

---

## Known limitations / caveats

- **No auth.** Every page renders as Sarah Castillo, CSR. Role switching is a follow-up task.
- **No write paths.** Every screen is read-only. "+ New Order", "Edit", "Put on Hold" buttons don't persist yet.
- **No real integrations.** HubSpot, QuickBooks, EasyPost, DASH — all mocked via seed data.
- **Some pages 404.** Sidebar links to `/inbox`, `/printer-queue`, `/cut-sew`, etc. — these come in follow-up sessions.
- **No mobile-first work yet.** Customer approval page (S26a) is the only one that needs mobile; it's coming.

---

## For the team reviewing this

When you click through:
- **Sarah Castillo (CSR)** is who you are. Imagine your morning starts at `/` (CSR Home).
- The expand-rows pattern on `/orders` is the one Megan asked for in S23-S32.47 — click the `▶` chevron to see child PRs inline.
- Click any order # to open `/orders/[id]` and see the simplified top summary Megan requested in S23-S32.48.
- If you see an order with a yellow "Megan Approval" tag, that's the OD-3 6-trigger gate firing.

Leave thumbs-up / thumbs-down feedback in the Slack channel or directly to Nick. The goal of this prototype is to surface UX issues **before** Sight Source writes the production version — corrections now are free; corrections after Sprint 4 are not.
