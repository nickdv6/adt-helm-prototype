// S40a Printer Management — Settings sub-view
import Link from 'next/link';
import { getDb } from '@/lib/db';
import { Card, CardHeader, Tag, Button } from '@/components/ui';

export const dynamic = 'force-dynamic';

// Per-printer daily capacity (yards/day) — would live in printers table column in production
const PRINTER_CAPACITY: Record<string, number> = {
  'Durst Alpha 330': 1200, 'MS JP7': 900, 'MS JP4-A': 600, 'MS JP4-B': 600,
  'Zimmer Colaris': 800, 'HP Latex 800W': 480, 'HP Latex 830W': 480,
};
const PRINTER_LOCATION: Record<string, string> = {
  'Durst Alpha 330': 'Bay A · Print Floor',
  'MS JP7': 'Bay B · Print Floor',
  'MS JP4-A': 'Bay C · Dye Sub Cell',
  'MS JP4-B': 'Bay C · Dye Sub Cell',
  'Zimmer Colaris': 'Bay D · Print Floor',
  'HP Latex 800W': 'Bay E · Latex Cell',
  'HP Latex 830W': 'Bay E · Latex Cell',
};

export default function PrinterManagement() {
  const db = getDb();
  const printers = db.prepare(`
    SELECT p.*,
      (SELECT COUNT(*) FROM print_requests pr WHERE pr.printer_id = p.id AND pr.status IN ('Scheduled','Printing')) as queue_depth
    FROM printers p ORDER BY p.name
  `).all() as any[];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <header className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Link href="/settings" className="text-sm text-gray-500 hover:underline">← Settings</Link>
          </div>
          <h1 className="text-2xl font-bold text-navy-900">Printer Management</h1>
          <p className="text-sm text-gray-600 mt-0.5">Fleet registry — capacity, ink set, location, and live queue depth.</p>
        </div>
        <Button>+ Add Printer</Button>
      </header>

      <Card>
        <CardHeader title={`${printers.length} printers`} />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
              <tr>
                <th className="text-left px-4 py-2.5">Printer</th>
                <th className="text-left px-4 py-2.5">Ink Set</th>
                <th className="text-left px-4 py-2.5">Location</th>
                <th className="text-left px-4 py-2.5">Capacity (yds/day)</th>
                <th className="text-left px-4 py-2.5">Queue depth</th>
                <th className="text-left px-4 py-2.5">Status</th>
                <th className="text-left px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {printers.map((p) => {
                const cap = PRINTER_CAPACITY[p.name] ?? 500;
                const loc = PRINTER_LOCATION[p.name] ?? '—';
                return (
                  <tr key={p.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-semibold">{p.name}</td>
                    <td className="px-4 py-2.5"><Tag>{p.ink_set}</Tag></td>
                    <td className="px-4 py-2.5 text-xs text-gray-600">{loc}</td>
                    <td className="px-4 py-2.5 font-mono text-xs">{cap}</td>
                    <td className="px-4 py-2.5 font-mono text-xs">{p.queue_depth ?? 0}</td>
                    <td className="px-4 py-2.5"><Tag color="green">Active</Tag></td>
                    <td className="px-4 py-2.5 text-right">
                      <Button size="sm" variant="ghost">Edit</Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <CardHeader title="Notes" />
        <div className="p-5 text-sm text-gray-600 space-y-1">
          <p>• Capacity drives the <Link href="/production-scheduling" className="text-navy-700 hover:underline">Production Scheduling calendar</Link> color coding.</p>
          <p>• Adding a printer requires a one-time RIP profile association — see <Link href="/settings/print-profiles" className="text-navy-700 hover:underline">Print Profile Management</Link>.</p>
          <p>• Marking a printer Inactive removes it from auto-routing in the Intake Command Center but preserves history.</p>
        </div>
      </Card>
    </div>
  );
}
