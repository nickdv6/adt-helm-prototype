import Link from 'next/link';
import { getDb } from '@/lib/db';
import { Card, CardHeader, Tag, Button } from '@/components/ui';
import { relativeTime } from '@/lib/utils';

// S40c — Packaging Profile Management
// Per OD-7 — 22-field baseline profile per Customer × Product Type combo
// Used by Cut/Sew + Pack-and-Ship; FPR can override per S23-S32.34

export default function PackagingProfiles() {
  const db = getDb();
  const rows = db.prepare(`
    SELECT pp.*, c.name as company_name, u.full_name as updater
    FROM packaging_profiles pp
    JOIN companies c ON pp.company_id = c.id
    LEFT JOIN users u ON pp.last_updated_by_user_id = u.id
    ORDER BY c.name, pp.product_type
  `).all() as any[];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Packaging Profiles (S40c)</h1>
          <p className="text-sm text-gray-500 mt-1">OD-7 · 22-field baseline · {rows.length} profiles defined</p>
        </div>
        <Button>+ New Profile</Button>
      </header>

      <Card>
        <table className="w-full text-sm">
          <thead className="text-xs text-gray-500 uppercase tracking-wider border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-2.5">Profile Name</th>
              <th className="text-left px-4 py-2.5">Customer</th>
              <th className="text-left px-4 py-2.5">Product</th>
              <th className="text-left px-4 py-2.5">Pkg Type</th>
              <th className="text-left px-4 py-2.5">Insert</th>
              <th className="text-left px-4 py-2.5">Label</th>
              <th className="text-right px-4 py-2.5 pr-5">Updated</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id} className="border-t border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-2.5 font-semibold">
                  {p.name}
                  {p.is_default_for_combo ? <Tag color="blue">Default</Tag> : null}
                </td>
                <td className="px-4 py-2.5">{p.company_name}</td>
                <td className="px-4 py-2.5 capitalize text-xs">{p.product_type}</td>
                <td className="px-4 py-2.5"><Tag color="purple">{p.packaging_type}</Tag></td>
                <td className="px-4 py-2.5 text-xs text-gray-600 truncate max-w-[180px]">{p.insert_spec || '—'}</td>
                <td className="px-4 py-2.5 text-xs text-gray-600 truncate max-w-[180px]">{p.label_spec || '—'}</td>
                <td className="px-4 py-2.5 text-right text-xs text-gray-500 pr-5">
                  {p.last_updated_at ? relativeTime(p.last_updated_at) : '—'}
                  {p.updater ? <div className="text-[10px] text-gray-400">by {p.updater}</div> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <div className="text-xs text-gray-500">
        Profile attached automatically to FPRs via Customer × Product Type lookup (S23-S32.34). If components missing at pack time, FPR can use override with reason code per S23-S32.33.
      </div>
    </div>
  );
}
