// S03 Production Manager Home — visibility-only refresh (Phase 1.13).
//
// This page is a live operational reference screen for Megan. It is NOT the work
// surface for the OD-3 Approval Gate, Sales intake pipeline, or Accounting Hand-Off
// — those continue to live where they always have (Order Detail, /intake, /orders
// status pivots, QuickBooks). Removing those tabs from this dashboard is a
// visibility change only; the underlying workflows / data / routes are unchanged.
//
// Display rules consumed (not redefined) here:
//   - "Open PR" = pr.status NOT IN ('Complete','Cancelled') (existing convention)
//   - "Promised date" inherits from the parent order's adt_promised_date (existing
//     convention — PR rows don't carry their own promised_date column)
//   - "7 business days" filter is computed in the client (Mon–Fri count).
//     SQL pre-narrows with +10 calendar days so the JS filter has a tight set.

import { getDb } from '@/lib/db';
import {
  ProductionManagerDashboard,
  type DueSoonPR,
  type OrderRow,
  type OrderPR,
} from '@/components/megan-dashboard';

export const dynamic = 'force-dynamic';

export default function MeganHome() {
  const db = getDb();

  // ----- Open PRs whose parent order is promised within ~7 business days
  // (or overdue). +10 calendar days covers any 7-business-day window. The
  // precise business-day filter happens in the client.
  const dueSoonPRs = db.prepare(`
    SELECT pr.id, pr.pr_number, pr.status, pr.planned_yardage, pr.assigned_to_user_id,
           o.id as order_id, o.order_number, o.adt_promised_date, o.is_rush,
           c.name as company_name,
           d.plant_number, d.name as design_name,
           cw.name as colorway_name,
           f.name as fabric_name,
           u.full_name as assigned_name
    FROM print_requests pr
    JOIN order_lines ol ON pr.order_line_id = ol.id
    JOIN orders o ON ol.order_id = o.id
    JOIN companies c ON o.company_id = c.id
    LEFT JOIN designs d ON ol.design_id = d.id
    LEFT JOIN colorways cw ON ol.colorway_id = cw.id
    LEFT JOIN fabrics f ON pr.fabric_id = f.id
    LEFT JOIN users u ON pr.assigned_to_user_id = u.id
    WHERE pr.status NOT IN ('Complete', 'Cancelled')
      AND o.adt_promised_date IS NOT NULL
      AND date(o.adt_promised_date) <= date('now', '+10 days')
    ORDER BY date(o.adt_promised_date) ASC
  `).all() as DueSoonPR[];

  // ----- Orders currently in production with summary metrics + their PRs
  const inProd = db.prepare(`
    SELECT o.id, o.order_number, o.po_number, o.adt_promised_date, o.is_rush, o.roadmap, o.status,
           c.name as company_name,
           (SELECT COUNT(*) FROM print_requests pr
              JOIN order_lines ol2 ON pr.order_line_id = ol2.id
              WHERE ol2.order_id = o.id) as pr_count,
           (SELECT MIN(o2.adt_promised_date) FROM orders o2 WHERE o2.id = o.id) as earliest_promised,
           (SELECT MAX(o2.adt_promised_date) FROM orders o2 WHERE o2.id = o.id) as latest_promised
    FROM orders o JOIN companies c ON o.company_id = c.id
    WHERE o.status IN ('In Production', 'Partially Complete')
    ORDER BY date(o.adt_promised_date) ASC LIMIT 60
  `).all() as OrderRow[];

  // ----- PRs grouped by order_id (for the expand-on-click rows)
  const prsByOrder: Record<number, OrderPR[]> = {};
  if (inProd.length > 0) {
    const orderIds = inProd.map((o) => o.id);
    const placeholders = orderIds.map(() => '?').join(',');
    const prs = db.prepare(`
      SELECT pr.id, pr.pr_number, pr.status, pr.planned_yardage,
             ol.order_id,
             d.plant_number, d.name as design_name,
             cw.name as colorway_name,
             f.name as fabric_name,
             o.adt_promised_date
      FROM print_requests pr
      JOIN order_lines ol ON pr.order_line_id = ol.id
      JOIN orders o ON ol.order_id = o.id
      LEFT JOIN designs d ON ol.design_id = d.id
      LEFT JOIN colorways cw ON ol.colorway_id = cw.id
      LEFT JOIN fabrics f ON pr.fabric_id = f.id
      WHERE ol.order_id IN (${placeholders})
      ORDER BY pr.pr_number
    `).all(...orderIds) as (OrderPR & { order_id: number })[];
    prs.forEach((p) => {
      if (!prsByOrder[p.order_id]) prsByOrder[p.order_id] = [];
      prsByOrder[p.order_id].push(p);
    });
  }

  return (
    <ProductionManagerDashboard
      dueSoonPRs={dueSoonPRs}
      inProd={inProd}
      prsByOrder={prsByOrder}
    />
  );
}
