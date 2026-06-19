import Link from 'next/link';
import { getDb } from '@/lib/db';
import { Card, CardHeader, Tag, Button } from '@/components/ui';
import { formatDate } from '@/lib/utils';

// /rolls — Created Rolls registry + correction interface
// Rolls live in pr_rolls (one row = one physical roll cut from a PR's printed yardage).
// A single PR may yield multiple rolls. This page surfaces every roll so admins/operators can
// backtrack roll-creation errors (wrong PR associated, wrong yardage, etc.) without dev help.

export default function CreatedRolls({ searchParams }: { searchParams: { q?: string; status?: string } }) {
  const db = getDb();
  const q = (searchParams?.q ?? '').trim();
  const statusFilter = searchParams?.status ?? 'all';

  let where = '1=1';
  const params: any[] = [];
  if (q) {
    where += ` AND (r.roll_number LIKE ? OR pr.pr_number LIKE ? OR c.name LIKE ?)`;
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  if (statusFilter === 'packed') {
    where += ` AND r.ship_status = 'packed'`;
  } else if (statusFilter === 'shipped') {
    where += ` AND r.ship_status = 'shipped'`;
  }

  const rolls = db.prepare(`
    SELECT r.id, r.roll_number, r.yards, r.ship_status, r.packed_at, r.shipped_at,
           pr.id as pr_id, pr.pr_number, pr.status as pr_status,
           pr.planned_yardage, pr.printed_yardage,
           ol.order_id, o.order_number, o.status as order_status,
           c.name as company_name,
           d.name as design_name, d.plant_number,
           cw.name as colorway_name,
           f.name as fabric_name,
           p.name as printer_name,
           u.full_name as packed_by_name
    FROM pr_rolls r
    JOIN print_requests pr ON r.pr_id = pr.id
    JOIN order_lines ol ON pr.order_line_id = ol.id
    JOIN orders o ON ol.order_id = o.id
    JOIN companies c ON o.company_id = c.id
    LEFT JOIN designs d ON ol.design_id = d.id
    LEFT JOIN colorways cw ON ol.colorway_id = cw.id
    LEFT JOIN fabrics f ON pr.fabric_id = f.id
    LEFT JOIN printers p ON pr.printer_id = p.id
    LEFT JOIN users u ON r.packed_by_user_id = u.id
    WHERE ${where}
    ORDER BY r.packed_at DESC, CAST(r.roll_number AS INTEGER) DESC
    LIMIT 150
  `).all(...params) as any[];

  // Group rolls by PR for the display (so user sees "PR-8247 has rolls 99, 100, 101, 102")
  const rollsByPR = new Map<string, any[]>();
  rolls.forEach((r) => {
    const key = r.pr_number;
    if (!rollsByPR.has(key)) rollsByPR.set(key, []);
    rollsByPR.get(key)!.push(r);
  });

  const totalRolls = (db.prepare("SELECT COUNT(*) as c FROM pr_rolls").get() as any).c;
  const counts = {
    all: totalRolls,
    packed: (db.prepare("SELECT COUNT(*) as c FROM pr_rolls WHERE ship_status = 'packed'").get() as any).c,
    shipped: (db.prepare("SELECT COUNT(*) as c FROM pr_rolls WHERE ship_status = 'shipped'").get() as any).c,
  };

  return (
    <div className="max-w-7xl mx-auto space-y-5 pb-12">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Created Rolls</h1>
          <p className="text-sm text-gray-500 mt-1">
            Each row is one physical roll · a single PR may yield multiple rolls (overage/underage normal) · backtrack roll-creation errors before they propagate.
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
            <label className="block text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-1">Status</label>
            <select name="status" defaultValue={statusFilter} className="border border-gray-300 rounded px-2 py-1.5 text-sm bg-white">
              <option value="all">All ({counts.all.toLocaleString()})</option>
              <option value="packed">Packed · awaiting ship ({counts.packed.toLocaleString()})</option>
              <option value="shipped">Shipped ({counts.shipped.toLocaleString()})</option>
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
          subtitle={`${rolls.length} of ${counts.all} rolls shown · grouped by PR (each PR may have multiple rolls)`}
        />
        <table className="w-full text-sm">
          <thead className="text-xs text-gray-500 uppercase tracking-wider border-b border-gray-200">
            <tr>
              <th className="text-left px-3 py-2.5">Roll #</th>
              <th className="text-right px-3 py-2.5">Yards</th>
              <th className="text-left px-3 py-2.5">PR / Order</th>
              <th className="text-left px-3 py-2.5">Customer</th>
              <th className="text-left px-3 py-2.5">Design / Colorway / Fabric</th>
              <th className="text-left px-3 py-2.5">Packed by</th>
              <th className="text-left px-3 py-2.5">Status</th>
              <th className="text-right px-3 py-2.5 pr-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {rolls.length === 0 && (
              <tr><td colSpan={8} className="text-center py-10 text-gray-400">No rolls match these filters.</td></tr>
            )}
            {[...rollsByPR.entries()].map(([prNumber, prRolls]) => (
              <PRGroupRows key={prNumber} prNumber={prNumber} prRolls={prRolls} />
            ))}
          </tbody>
        </table>
        <div className="px-4 py-2 border-t border-gray-100 text-[11px] text-gray-500 italic">
          <strong>Backtracking:</strong> click <em>Correct</em> to jump to Packing Correction with the roll pre-loaded — reassign to a different PR, void a mis-created roll, or undo a packing action. Each correction logs an audit event with operator + reason.
        </div>
      </Card>
    </div>
  );
}

function PRGroupRows({ prNumber, prRolls }: { prNumber: string; prRolls: any[] }) {
  // Group header line + one row per roll
  const first = prRolls[0];
  const totalYards = prRolls.reduce((s, r) => s + r.yards, 0);
  return (
    <>
      <tr className="border-t-2 border-navy-200 bg-navy-50/60">
        <td colSpan={8} className="px-3 py-1.5 text-[11px]">
          <Link href={`/print-requests/${first.pr_id}`} className="font-mono font-semibold text-navy-700 hover:underline">{prNumber}</Link>
          <span className="text-gray-500 ml-2">
            · {prRolls.length} roll{prRolls.length !== 1 ? 's' : ''}
            · <strong className="font-mono">{totalYards}</strong> yd packed
            · printed {first.printed_yardage}/{first.planned_yardage} planned
          </span>
        </td>
      </tr>
      {prRolls.map((r) => (
        <tr key={r.id} className="border-t border-gray-100 hover:bg-gray-50">
          <td className="px-3 py-2 font-mono font-semibold text-navy-700">{r.roll_number}</td>
          <td className="px-3 py-2 text-right font-mono">{r.yards}</td>
          <td className="px-3 py-2">
            <Link href={`/print-requests/${r.pr_id}`} className="font-mono text-navy-700 hover:underline">{r.pr_number}</Link>
            <span className="text-gray-300 mx-1">·</span>
            <Link href={`/orders/${r.order_id}`} className="font-mono text-xs text-navy-700 hover:underline">{r.order_number}</Link>
          </td>
          <td className="px-3 py-2 text-xs">{r.company_name}</td>
          <td className="px-3 py-2 text-xs">
            <span className="font-semibold">{r.design_name || '—'}</span>
            {r.colorway_name && <span className="text-gray-500 ml-1">· {r.colorway_name}</span>}
            {r.fabric_name && <span className="text-gray-500 ml-1">· {r.fabric_name}</span>}
          </td>
          <td className="px-3 py-2 text-xs">
            {r.packed_by_name || <span className="text-gray-400">—</span>}
            {r.packed_at && <div className="text-[10px] text-gray-400 mt-0.5">{formatDate(r.packed_at)}</div>}
          </td>
          <td className="px-3 py-2">
            {r.ship_status === 'shipped'
              ? <Tag color="green">Shipped</Tag>
              : <Tag color="blue">Packed</Tag>}
          </td>
          <td className="px-3 py-2 text-right pr-3">
            <Link href={`/packing-correction?roll=${r.roll_number}`} className="text-xs font-semibold text-navy-700 hover:underline">
              Correct →
            </Link>
          </td>
        </tr>
      ))}
    </>
  );
}
