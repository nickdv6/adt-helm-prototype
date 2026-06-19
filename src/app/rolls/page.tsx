import Link from 'next/link';
import { getDb } from '@/lib/db';
import { Card, CardHeader, Tag, Button, StatusPill } from '@/components/ui';

// /rolls — Created Rolls registry + correction interface
// Per Nick: users need direct access to created rolls so they can backtrack roll-creation errors
// (wrong PR associated, wrong order line, etc.) without dev intervention.

export default function CreatedRolls({ searchParams }: { searchParams: { q?: string; status?: string } }) {
  const db = getDb();
  const q = (searchParams?.q ?? '').trim();
  const statusFilter = searchParams?.status ?? 'all';

  // Rolls are surfaced as PR.roll_number — derive 'lifecycle stage' from the parent PR + order
  let where = "pr.roll_number IS NOT NULL";
  const params: any[] = [];
  if (q) {
    where += ` AND (pr.roll_number LIKE ? OR pr.pr_number LIKE ? OR c.name LIKE ?)`;
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  if (statusFilter === 'created') {
    where += ` AND pr.status IN ('Printing','Printed')`;
  } else if (statusFilter === 'packed') {
    where += ` AND pr.status = 'Complete' AND o.status NOT IN ('Shipped','Invoiced','Closed')`;
  } else if (statusFilter === 'shipped') {
    where += ` AND o.status IN ('Shipped','Invoiced','Closed')`;
  }

  const rolls = db.prepare(`
    SELECT pr.id as pr_id, pr.pr_number, pr.roll_number, pr.status as pr_status,
           pr.planned_yardage, pr.printed_yardage,
           ol.order_id, o.order_number, o.status as order_status,
           c.name as company_name,
           d.name as design_name, d.plant_number,
           cw.name as colorway_name,
           f.name as fabric_name,
           p.name as printer_name,
           pr.created_at
    FROM print_requests pr
    JOIN order_lines ol ON pr.order_line_id = ol.id
    JOIN orders o ON ol.order_id = o.id
    JOIN companies c ON o.company_id = c.id
    LEFT JOIN designs d ON ol.design_id = d.id
    LEFT JOIN colorways cw ON ol.colorway_id = cw.id
    LEFT JOIN fabrics f ON pr.fabric_id = f.id
    LEFT JOIN printers p ON pr.printer_id = p.id
    WHERE ${where}
    ORDER BY pr.created_at DESC
    LIMIT 100
  `).all(...params) as any[];

  const totalRolls = (db.prepare("SELECT COUNT(*) as c FROM print_requests WHERE roll_number IS NOT NULL").get() as any).c;
  const counts = {
    all: totalRolls,
    created: (db.prepare("SELECT COUNT(*) as c FROM print_requests WHERE roll_number IS NOT NULL AND status IN ('Printing','Printed')").get() as any).c,
    packed: (db.prepare("SELECT COUNT(*) as c FROM print_requests pr JOIN order_lines ol ON pr.order_line_id = ol.id JOIN orders o ON ol.order_id = o.id WHERE pr.roll_number IS NOT NULL AND pr.status = 'Complete' AND o.status NOT IN ('Shipped','Invoiced','Closed')").get() as any).c,
    shipped: (db.prepare("SELECT COUNT(*) as c FROM print_requests pr JOIN order_lines ol ON pr.order_line_id = ol.id JOIN orders o ON ol.order_id = o.id WHERE pr.roll_number IS NOT NULL AND o.status IN ('Shipped','Invoiced','Closed')").get() as any).c,
  };

  return (
    <div className="max-w-7xl mx-auto space-y-5 pb-12">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Created Rolls</h1>
          <p className="text-sm text-gray-500 mt-1">
            Search and inspect rolls · backtrack roll-creation errors before they propagate through packing or shipping.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/packing-correction">
            <Button variant="secondary">Packing Correction →</Button>
          </Link>
        </div>
      </header>

      {/* Search + status filter */}
      <Card>
        <form className="p-4 flex items-end gap-3" action="/rolls">
          <div className="flex-1">
            <label className="block text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-1">Search</label>
            <input
              type="text"
              name="q"
              defaultValue={q}
              placeholder="Roll #, PR #, or customer company…"
              className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-1">Stage</label>
            <select name="status" defaultValue={statusFilter} className="border border-gray-300 rounded px-2 py-1.5 text-sm bg-white">
              <option value="all">All rolls ({counts.all})</option>
              <option value="created">Created · not yet packed ({counts.created})</option>
              <option value="packed">Packed · not yet shipped ({counts.packed})</option>
              <option value="shipped">Shipped ({counts.shipped})</option>
            </select>
          </div>
          <Button size="sm" type="submit">Search</Button>
          {(q || statusFilter !== 'all') && (
            <Link href="/rolls" className="px-3 py-1.5 text-xs text-gray-500 hover:text-navy-700 border border-gray-300 rounded">Clear</Link>
          )}
        </form>
      </Card>

      <Card>
        <CardHeader
          title="Roll Registry"
          subtitle={`${rolls.length} of ${counts.all} rolls shown · click a roll to see details and correction actions`}
        />
        <table className="w-full text-sm">
          <thead className="text-xs text-gray-500 uppercase tracking-wider border-b border-gray-200">
            <tr>
              <th className="text-left px-3 py-2.5">Roll #</th>
              <th className="text-left px-3 py-2.5">PR / Order</th>
              <th className="text-left px-3 py-2.5">Customer</th>
              <th className="text-left px-3 py-2.5">Design / Colorway / Fabric</th>
              <th className="text-left px-3 py-2.5">Printer</th>
              <th className="text-right px-3 py-2.5">Yards</th>
              <th className="text-left px-3 py-2.5">Stage</th>
              <th className="text-right px-3 py-2.5 pr-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {rolls.length === 0 && (
              <tr><td colSpan={8} className="text-center py-10 text-gray-400">No rolls match these filters.</td></tr>
            )}
            {rolls.map((r) => {
              const stage = stageOf(r);
              return (
                <tr key={r.pr_id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-3 py-2.5">
                    <span className="font-mono font-semibold text-navy-700">{r.roll_number}</span>
                  </td>
                  <td className="px-3 py-2.5">
                    <Link href={`/print-requests/${r.pr_id}`} className="font-mono text-navy-700 hover:underline font-semibold">{r.pr_number}</Link>
                    <div className="text-[11px] text-gray-500 mt-0.5">
                      <Link href={`/orders/${r.order_id}`} className="font-mono hover:underline">{r.order_number}</Link>
                    </div>
                  </td>
                  <td className="px-3 py-2.5">{r.company_name}</td>
                  <td className="px-3 py-2.5">
                    <div className="font-semibold">{r.design_name || '—'}</div>
                    <div className="text-[11px] text-gray-500">
                      {r.colorway_name && <span>{r.colorway_name}</span>}
                      {r.colorway_name && r.fabric_name && <span className="mx-1">·</span>}
                      {r.fabric_name && <span>{r.fabric_name}</span>}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-xs">{r.printer_name || <span className="text-gray-400">—</span>}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-xs">
                    {r.printed_yardage ?? '—'}/{r.planned_yardage ?? '—'}
                  </td>
                  <td className="px-3 py-2.5">
                    <Tag color={stage.color}>{stage.label}</Tag>
                  </td>
                  <td className="px-3 py-2.5 text-right pr-3">
                    <Link href={`/packing-correction?roll=${r.roll_number}`} className="text-xs font-semibold text-navy-700 hover:underline">
                      Correct →
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="px-4 py-2 border-t border-gray-100 text-[11px] text-gray-500 italic">
          <strong>Backtracking from this page:</strong> click <em>Correct</em> to jump to the Packing Correction interface with the roll pre-loaded — there you can reassign the roll to a different PR, undo a packing action, or void a roll that was created in error. All corrections are logged with the operator + timestamp + reason.
        </div>
      </Card>
    </div>
  );
}

function stageOf(r: any): { label: string; color: 'gray' | 'blue' | 'yellow' | 'green' } {
  if (['Shipped', 'Invoiced', 'Closed'].includes(r.order_status)) return { label: 'Shipped', color: 'green' };
  if (r.pr_status === 'Complete') return { label: 'Packed · awaiting ship', color: 'yellow' };
  if (r.pr_status === 'Printed') return { label: 'Printed · awaiting pack', color: 'blue' };
  if (r.pr_status === 'Printing') return { label: 'On printer', color: 'blue' };
  return { label: r.pr_status, color: 'gray' };
}
