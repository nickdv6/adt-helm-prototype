// S41 Roles & Permissions Admin
import Link from 'next/link';
import { Card, CardHeader, Tag, Button } from '@/components/ui';

export const dynamic = 'force-dynamic';

const ROLES = [
  { code: 'admin', label: 'Admin', users: ['Nick Del Verme'] },
  { code: 'prod_mgr', label: 'Production Manager', users: ['Megan Burleson'] },
  { code: 'csr', label: 'Customer Service', users: ['Sarah Castillo'] },
  { code: 'sales', label: 'Sales', users: ['Drew Walters'] },
  { code: 'colorist', label: 'Colorist', users: ['Jeannine Romero', 'Maya Chen'] },
  { code: 'print_op', label: 'Print Operator', users: ['Julio Vargas'] },
  { code: 'finishing', label: 'Finishing', users: ['Lucio Hernandez'] },
  { code: 'cut_sew', label: 'Cut/Sew', users: ['Yuliana Cruz'] },
  { code: 'inventory', label: 'Inventory / Purchasing', users: ['Karen Boyd'] },
  { code: 'shipping', label: 'Shipping', users: ['Marcus Hill'] },
  { code: 'receiving', label: 'Receiving', users: ['Tomás Rivera'] },
  { code: 'accounting', label: 'Accounting', users: ['Diana Park'] },
];

// Permissions matrix — read/write/admin per resource per role
// Cell value: '—' / 'R' / 'RW' / 'RWA' (Admin = approval/override)
const PERMS: Record<string, Record<string, string>> = {
  Orders:           { admin:'RWA', prod_mgr:'RWA', csr:'RW',  sales:'RW',  colorist:'R',  print_op:'R',  finishing:'R',  cut_sew:'R',  inventory:'R',  shipping:'RW', receiving:'—',  accounting:'RW' },
  'Print Requests': { admin:'RWA', prod_mgr:'RWA', csr:'R',   sales:'—',   colorist:'RW', print_op:'RW', finishing:'RW', cut_sew:'R',  inventory:'R',  shipping:'R',  receiving:'—',  accounting:'R'  },
  'Strike-Offs':    { admin:'RWA', prod_mgr:'RWA', csr:'RW',  sales:'R',   colorist:'RW', print_op:'R',  finishing:'—',  cut_sew:'—',  inventory:'—',  shipping:'—',  receiving:'—',  accounting:'R'  },
  Customers:        { admin:'RWA', prod_mgr:'RW',  csr:'RW',  sales:'RWA', colorist:'R',  print_op:'—',  finishing:'—',  cut_sew:'—',  inventory:'R',  shipping:'R',  receiving:'R',  accounting:'RW' },
  Artwork:          { admin:'RWA', prod_mgr:'RWA', csr:'R',   sales:'—',   colorist:'RWA',print_op:'R',  finishing:'—',  cut_sew:'—',  inventory:'—',  shipping:'—',  receiving:'—',  accounting:'—'  },
  Inventory:        { admin:'RWA', prod_mgr:'R',   csr:'R',   sales:'—',   colorist:'R',  print_op:'R',  finishing:'RW', cut_sew:'R',  inventory:'RWA',shipping:'R',  receiving:'RW', accounting:'R'  },
  Shipping:         { admin:'RWA', prod_mgr:'R',   csr:'RW',  sales:'—',   colorist:'—',  print_op:'—',  finishing:'RW', cut_sew:'R',  inventory:'—',  shipping:'RWA',receiving:'R',  accounting:'R'  },
  Accounting:       { admin:'RWA', prod_mgr:'R',   csr:'R',   sales:'R',   colorist:'—',  print_op:'—',  finishing:'—',  cut_sew:'—',  inventory:'—',  shipping:'—',  receiving:'—',  accounting:'RWA' },
  Exceptions:       { admin:'RWA', prod_mgr:'RWA', csr:'RW',  sales:'R',   colorist:'RW', print_op:'RW', finishing:'RW', cut_sew:'RW', inventory:'RW', shipping:'RW', receiving:'RW', accounting:'RW' },
  Settings:         { admin:'RWA', prod_mgr:'R',   csr:'—',   sales:'—',   colorist:'—',  print_op:'—',  finishing:'—',  cut_sew:'—',  inventory:'—',  shipping:'—',  receiving:'—',  accounting:'—'  },
};

function permColor(v: string): 'gray' | 'blue' | 'green' | 'purple' {
  if (v === 'RWA') return 'purple';
  if (v === 'RW') return 'green';
  if (v === 'R') return 'blue';
  return 'gray';
}

export default function RolesPermissions() {
  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <header className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Link href="/settings" className="text-sm text-gray-500 hover:underline">← Settings</Link>
          </div>
          <h1 className="text-2xl font-bold text-navy-900">Roles &amp; Permissions</h1>
          <p className="text-sm text-gray-600 mt-0.5">12 active roles · read / write / admin per resource. Edit cells to change access.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary">+ New Role</Button>
          <Button>+ Invite User</Button>
        </div>
      </header>

      <Card>
        <CardHeader title="Users by Role" />
        <div className="p-5 grid grid-cols-3 gap-3">
          {ROLES.map((r) => (
            <div key={r.code} className="border border-gray-200 rounded p-3">
              <div className="text-xs font-bold text-navy-700">{r.label}</div>
              <div className="text-[10px] text-gray-500 font-mono mb-2">{r.code}</div>
              <div className="text-xs text-gray-700 space-y-0.5">
                {r.users.map((u) => <div key={u}>• {u}</div>)}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader title="Permissions Matrix"
          subtitle={`Legend: R = Read, RW = Read+Write, RWA = Read+Write+Admin (approve/override), — = no access`} />
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
              <tr>
                <th className="text-left px-3 py-2.5 sticky left-0 bg-gray-50">Resource</th>
                {ROLES.map((r) => (
                  <th key={r.code} className="text-center px-2 py-2.5 whitespace-nowrap">{r.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.entries(PERMS).map(([resource, byRole]) => (
                <tr key={resource} className="border-t border-gray-100">
                  <td className="px-3 py-2 font-semibold text-navy-700 sticky left-0 bg-white">{resource}</td>
                  {ROLES.map((role) => {
                    const v = byRole[role.code] ?? '—';
                    return (
                      <td key={role.code} className="text-center px-2 py-2">
                        {v === '—' ? (
                          <span className="text-gray-300">—</span>
                        ) : (
                          <Tag color={permColor(v)}>{v}</Tag>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <CardHeader title="Notes" />
        <div className="p-5 text-sm text-gray-600 space-y-1">
          <p>• <strong>Admin (A)</strong> on a resource means the user can approve, override, or perform destructive actions like voiding a shipment or unposting an invoice.</p>
          <p>• Roles are additive — a user can have one primary role plus secondary role grants. The Audit Log records which role was active at action time.</p>
          <p>• Role changes take effect at next login. Active sessions are not invalidated.</p>
        </div>
      </Card>
    </div>
  );
}
