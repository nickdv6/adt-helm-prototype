import { getDb } from '@/lib/db';
import { Card, CardHeader, Tag } from '@/components/ui';

// /settings — System Admin (prototype shell)

export default function Settings() {
  const db = getDb();
  const users = db.prepare('SELECT * FROM users ORDER BY primary_role, full_name').all() as any[];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-navy-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Prototype shell — full settings (printer mgmt, intake config edit, notification prefs, OD-3 thresholds, etc.) in Wave 1 build</p>
      </header>

      <Card>
        <CardHeader title="Users" subtitle="Per Wave 1 — RBAC matrix mirrors Permissions Matrix deliverable" />
        <table className="w-full text-sm">
          <thead className="text-xs text-gray-500 uppercase tracking-wider border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-2.5">Name</th>
              <th className="text-left px-4 py-2.5">Email</th>
              <th className="text-left px-4 py-2.5">Primary Role</th>
              <th className="text-left px-4 py-2.5">Active</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-gray-100">
                <td className="px-4 py-2.5 font-semibold">{u.full_name}</td>
                <td className="px-4 py-2.5 text-xs text-gray-600">{u.email}</td>
                <td className="px-4 py-2.5"><Tag color="blue">{u.primary_role}</Tag></td>
                <td className="px-4 py-2.5">{u.is_active ? <Tag color="green">Active</Tag> : <Tag color="gray">Inactive</Tag>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card>
        <CardHeader title="Prototype Notes" />
        <div className="px-5 py-4 text-sm space-y-2 text-gray-700">
          <p>This prototype is built against the locked blueprint. Data is mock; no real customer/financial data is present.</p>
          <p>Wave 1 production build (Sight Source) will replace this. Hot folder routing, HubSpot sync, QuickBooks sync, EasyPost integration, and full audit trail will be added there.</p>
          <p>Role switching uses localStorage and has no real auth. Production system will use SSO + the RBAC matrix from the Permissions Matrix deliverable.</p>
        </div>
      </Card>
    </div>
  );
}
