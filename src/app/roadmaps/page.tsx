// S22 Order Roadmap Builder
// Read-only proof-of-concept editor. Shows each roadmap's station sequence + the rule
// that picks the roadmap at intake. Editable in production; here this is the visual
// reference so Sight Source / Megan can see the routes are configurable, not hard-coded.
import Link from 'next/link';
import { getDb } from '@/lib/db';
import { Card, CardHeader, Tag, Button } from '@/components/ui';
import { SubwayMap, ROADMAPS, RoadmapCode } from '@/components/subway-map';

export const dynamic = 'force-dynamic';

// Auto-assignment rules. In production these come from the Settings → Roadmap Rules table.
const ASSIGNMENT_RULES: Record<RoadmapCode, string[]> = {
  R1: ['No strike-off classification', 'Not click-and-print', 'No finishing / cut-sew on product type', 'Default catch-all for yardage'],
  R2: ['Product type requires finishing (heat-set, wash, coating)', 'No cut/sew required'],
  R4: ['Strike-off classification = Customer Strike-Off Required', 'No finishing or cut/sew'],
  R5: ['Strike-off classification = Customer Strike-Off Required', 'Product type requires cut/sew (pillows, napkins, runners)'],
  R6: ['Source = Shopify or CSV/XML auto-route', 'Click-and-Print flag = true', 'Customer pre-approved for click-and-print'],
  R7: ['Triggered by reprint workflow only (not selectable at intake)'],
  R8: ['Manual override by Megan or Production Manager', 'Use sparingly — non-standard route, no template'],
};

export default function RoadmapBuilder() {
  const db = getDb();
  // Live count of in-flight orders per roadmap so the page reflects reality
  const counts = db.prepare(`
    SELECT roadmap, COUNT(*) as n
    FROM orders
    WHERE status NOT IN ('Closed','Cancelled','Invoiced')
    GROUP BY roadmap
  `).all() as { roadmap: string; n: number }[];
  const countMap = new Map(counts.map((c) => [c.roadmap, c.n]));

  const codes: RoadmapCode[] = ['R1', 'R2', 'R4', 'R5', 'R6', 'R7', 'R8'];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Roadmap Builder</h1>
          <p className="text-sm text-gray-600 mt-0.5">
            Routes orders follow through Helm. Each roadmap = an ordered station sequence + an assignment rule.
            Sample stations only — production version is editable per-route.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary">Import / Export YAML</Button>
          <Button>+ New Roadmap</Button>
        </div>
      </header>

      {/* Quick reference legend */}
      <Card>
        <CardHeader title="In-flight order distribution" subtitle="Live count of open orders per roadmap (excludes Closed / Cancelled / Invoiced)." />
        <div className="p-5 grid grid-cols-7 gap-3">
          {codes.map((code) => (
            <div key={code} className="border border-gray-200 rounded p-3 text-center">
              <div className="text-xs font-mono font-bold text-navy-700">{code}</div>
              <div className="text-2xl font-bold text-navy-900 mt-1">{countMap.get(code) ?? 0}</div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wider mt-0.5">orders</div>
            </div>
          ))}
        </div>
      </Card>

      {/* Per-roadmap detail card */}
      {codes.map((code) => {
        const r = ROADMAPS[code];
        return (
          <Card key={code}>
            <CardHeader
              title={r.label}
              subtitle={r.description}
              action={
                <div className="flex gap-2">
                  <Tag color="blue">{countMap.get(code) ?? 0} in flight</Tag>
                  <Button size="sm" variant="ghost">Edit</Button>
                </div>
              }
            />
            <div className="p-5 space-y-5">
              {/* Subway map preview — render with a "fresh PR" status so all stations are upcoming */}
              <div className="bg-navy-50/40 border border-navy-700/10 rounded p-4">
                <div className="text-[10px] uppercase tracking-wider text-navy-700 font-bold mb-3">Station Sequence</div>
                <SubwayMap roadmap={code} currentStatus="Scheduled" />
              </div>

              {/* Assignment rules */}
              <div>
                <div className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-2">When this roadmap applies</div>
                <ul className="space-y-1 text-sm">
                  {ASSIGNMENT_RULES[code].map((rule, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-navy-700 mt-0.5">▸</span>
                      <span className="text-gray-700">{rule}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Card>
        );
      })}

      <Card>
        <CardHeader title="Editor model (Phase 2)" />
        <div className="p-5 text-sm text-gray-600 space-y-2">
          <p>In Phase 2 this page becomes editable: drag-reorder stations, toggle optional stations on/off, add custom decision points, and version the route. Routes are versioned so an in-flight order continues on the route it started on while new orders pick up the latest.</p>
          <p>Stations themselves stay the same set — adding a station is a system-level change because new stations need workstations, scan events, and role assignments.</p>
        </div>
      </Card>
    </div>
  );
}
