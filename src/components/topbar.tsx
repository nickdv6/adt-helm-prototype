'use client';

import { Bell, Search, ChevronDown } from 'lucide-react';
import Link from 'next/link';
import { useState, useRef, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';

// Role identities map to home routes. Selecting a role navigates to that role's home
// and updates the user chip. Persisted to localStorage so the chip survives reloads.
const ROLES = [
  { id: 'admin', name: 'Nick Del Verme', initials: 'ND', label: 'Admin / Owner', home: '/' },
  { id: 'prod_mgr', name: 'Megan Burleson', initials: 'MB', label: 'Production Manager', home: '/megan' },
  { id: 'csr', name: 'Sarah Castillo', initials: 'SC', label: 'CSR', home: '/csr-home' },
  { id: 'colorist', name: 'Jeannine Romero', initials: 'JR', label: 'Colorist', home: '/colorist' },
  { id: 'print_op', name: 'Julio Vargas', initials: 'JV', label: 'Print Operator', home: '/print-op-home' },
  { id: 'finishing', name: 'Lucio Hernandez', initials: 'LH', label: 'Finishing', home: '/finishing-home' },
  { id: 'cut_sew', name: 'Yuliana Cruz', initials: 'YC', label: 'Cut/Sew', home: '/cut-sew-home' },
  { id: 'inventory', name: 'Karen Boyd', initials: 'KB', label: 'Inventory / Purchasing', home: '/inventory-home' },
  { id: 'shipping', name: 'Marcus Hill', initials: 'MH', label: 'Shipping', home: '/shipping-home' },
  { id: 'receiving', name: 'Tomás Rivera', initials: 'TR', label: 'Receiving', home: '/receiving-home' },
  { id: 'accounting', name: 'Diana Park', initials: 'DP', label: 'Accounting', home: '/accounting-home' },
  { id: 'sales', name: 'Drew Walters', initials: 'DW', label: 'Sales', home: '/' },
];

export function Topbar() {
  const [open, setOpen] = useState(false);
  const [activeRoleId, setActiveRoleId] = useState('csr');
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();

  // Hydrate from localStorage on mount
  useEffect(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('helm.role') : null;
    if (saved && ROLES.find((r) => r.id === saved)) setActiveRoleId(saved);
  }, []);

  // Persist + close on outside click
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const active = ROLES.find((r) => r.id === activeRoleId) ?? ROLES[0];

  function switchTo(roleId: string) {
    const role = ROLES.find((r) => r.id === roleId)!;
    setActiveRoleId(roleId);
    if (typeof window !== 'undefined') localStorage.setItem('helm.role', roleId);
    setOpen(false);
    if (pathname !== role.home) router.push(role.home);
  }

  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center px-6 gap-4">
      <div className="flex-1 max-w-xl relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search orders, customers, designs, PR#, plant#..."
          className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-navy-700/20 focus:border-navy-700"
        />
      </div>

      <Link href="/inbox" className="relative p-2 hover:bg-gray-100 rounded text-gray-600" title="Notifications">
        <Bell className="w-5 h-5" />
        <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
      </Link>

      <div className="relative" ref={ref}>
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-2 pl-4 border-l border-gray-200 hover:bg-gray-50 py-1.5 pr-2 rounded"
          title="Switch role (prototype only)"
        >
          <div className="w-8 h-8 rounded-full bg-navy-700 text-white flex items-center justify-center text-xs font-bold">{active.initials}</div>
          <div className="text-sm text-left">
            <div className="font-semibold leading-tight">{active.name}</div>
            <div className="text-[11px] text-gray-500 leading-tight">{active.label} · ADT</div>
          </div>
          <ChevronDown className="w-4 h-4 text-gray-400" />
        </button>
        {open && (
          <div className="absolute right-0 top-full mt-1 w-72 bg-white border border-gray-200 rounded shadow-lg z-50">
            <div className="px-3 py-2 text-[10px] uppercase tracking-wider font-semibold text-gray-500 border-b border-gray-100">
              Switch role (prototype — no real auth)
            </div>
            {ROLES.map((r) => (
              <button
                key={r.id}
                onClick={() => switchTo(r.id)}
                className={`w-full text-left flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 text-sm ${r.id === activeRoleId ? 'bg-navy-50' : ''}`}
              >
                <div className="w-7 h-7 rounded-full bg-gray-200 text-gray-700 flex items-center justify-center text-[10px] font-bold flex-shrink-0">{r.initials}</div>
                <div className="flex-1">
                  <div className="font-medium leading-tight">{r.name}</div>
                  <div className="text-[11px] text-gray-500 leading-tight">{r.label}</div>
                </div>
                {r.id === activeRoleId && <span className="text-[10px] font-semibold text-navy-700">Active</span>}
              </button>
            ))}
          </div>
        )}
      </div>
    </header>
  );
}
