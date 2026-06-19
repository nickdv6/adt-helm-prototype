// S40b Print Profile Management — Settings sub-view
import Link from 'next/link';
import { getDb } from '@/lib/db';
import { Card, CardHeader, Tag, Button } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default function PrintProfileManagement() {
  const db = getDb();
  const profiles = db.prepare(`
    SELECT pp.*, p.name as printer_name, p.ink_set, f.name as fabric_name
    FROM print_profiles pp
    LEFT JOIN printers p ON pp.printer_id = p.id
    LEFT JOIN fabrics f ON pp.fabric_id = f.id
    ORDER BY p.name, f.name, pp.name
  `).all() as any[];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <header className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Link href="/settings" className="text-sm text-gray-500 hover:underline">← Settings</Link>
          </div>
          <h1 className="text-2xl font-bold text-navy-900">Print Profile Management</h1>
          <p className="text-sm text-gray-600 mt-0.5">
            Naming pattern: <code className="font-mono bg-gray-100 px-1.5 py-0.5 rounded text-xs">PRINTER_FABRIC_INKSET_PROFILE_REF#_DATE</code> · ICC profiles live on the NAS.
          </p>
        </div>
        <Button>+ Upload Profile</Button>
      </header>

      <Card>
        <CardHeader title={`${profiles.length} active profiles`} />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
              <tr>
                <th className="text-left px-4 py-2.5">Profile Name</th>
                <th className="text-left px-4 py-2.5">Printer</th>
                <th className="text-left px-4 py-2.5">Fabric</th>
                <th className="text-left px-4 py-2.5">Ink Set</th>
                <th className="text-left px-4 py-2.5">ICC Profile</th>
                <th className="text-left px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((p) => (
                <tr key={p.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-2.5 font-mono text-xs font-semibold">{p.name}</td>
                  <td className="px-4 py-2.5">{p.printer_name ?? <span className="text-gray-300">—</span>}</td>
                  <td className="px-4 py-2.5 text-xs">{p.fabric_name ?? <span className="text-gray-300">—</span>}</td>
                  <td className="px-4 py-2.5"><Tag>{p.ink_set ?? '—'}</Tag></td>
                  <td className="px-4 py-2.5 font-mono text-[10px] text-gray-500 break-all">{p.icc_profile_path ?? <span className="text-gray-300">no profile</span>}</td>
                  <td className="px-4 py-2.5 text-right">
                    <Button size="sm" variant="ghost">Edit</Button>
                  </td>
                </tr>
              ))}
              {profiles.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-500 italic">No profiles seeded yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <CardHeader title="How profiles work in Helm" />
        <div className="p-5 text-sm text-gray-600 space-y-2">
          <p>Each PR resolves a profile by (printer × fabric × ink set). The matched profile&apos;s ICC file gets attached to the print job at RIP send.</p>
          <p>Profiles are versioned by the REF# in the filename so a profile update doesn&apos;t break in-flight PRs — they continue using the version they were assigned.</p>
          <p>Per-SKU defaults live in <Link href="/customer-configs" className="text-navy-700 hover:underline">Customer Configs → SKU Mapping</Link> and override the printer×fabric default.</p>
        </div>
      </Card>
    </div>
  );
}
