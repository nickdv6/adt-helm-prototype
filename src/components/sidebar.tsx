'use client';
// Role-aware sidebar. Reads the active persona from localStorage (same key
// the topbar persona switcher writes to: 'helm.role'). Items relevant to the
// active role render at full opacity above the fold; everything else collapses
// into a "More — all sections" expandable region.
//
// Admin/Owner sees everything by default — no filtering.
//
// Each NavItem declares the roles it's "primary for." If the active role isn't
// in that set, the item is treated as secondary and slips below the divider.
import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  Home, FileText, Layers, Truck, Package, Palette, Printer, Scissors,
  Settings, Users, Inbox, AlertTriangle, Boxes, Flame, Sliders, FileScan,
  ClipboardList, CircleDot, Undo2, Brush, ScanLine, ServerCog, GitBranch,
  FileImage, Stamp, BarChart3, UserRound, Calendar, RotateCcw, ChevronDown,
} from 'lucide-react';

type Role =
  | 'admin' | 'prod_mgr' | 'csr' | 'sales' | 'colorist' | 'print_op'
  | 'finishing' | 'cut_sew' | 'inventory' | 'shipping' | 'receiving' | 'accounting';

type Item = {
  href: string;
  label: string;
  icon: React.ReactNode;
  section: string;
  badge?: string;
  // Roles this item is PRIMARY for. Admin always sees everything. If undefined,
  // treated as universal (visible to all roles at primary level).
  primaryFor?: Role[];
};

const ITEMS: Item[] = [
  // Daily — universal
  { href: '/',          icon: <Home className="w-4 h-4" />,            label: 'Tour · Landing', section: 'Daily' },
  { href: '/sitemap',   icon: <Layers className="w-4 h-4" />,          label: 'Sitemap',        section: 'Daily' },
  { href: '/changelog', icon: <FileText className="w-4 h-4" />,        label: 'Changelog',      section: 'Daily' },
  { href: '/inbox',     icon: <Inbox className="w-4 h-4" />,           label: 'Inbox', badge: '8', section: 'Daily' },

  // Role Homes — each item is primary only for its own role
  { href: '/megan',           icon: <UserRound className="w-4 h-4" />, label: 'Production Manager', section: 'Role Homes', primaryFor: ['prod_mgr'] },
  { href: '/csr-home',        icon: <UserRound className="w-4 h-4" />, label: 'CSR',                section: 'Role Homes', primaryFor: ['csr'] },
  { href: '/colorist',        icon: <UserRound className="w-4 h-4" />, label: 'Colorist',           section: 'Role Homes', primaryFor: ['colorist'] },
  { href: '/print-op-home',   icon: <UserRound className="w-4 h-4" />, label: 'Print Operator',     section: 'Role Homes', primaryFor: ['print_op'] },
  { href: '/finishing-home',  icon: <UserRound className="w-4 h-4" />, label: 'Finishing',          section: 'Role Homes', primaryFor: ['finishing'] },
  { href: '/cut-sew-home',    icon: <UserRound className="w-4 h-4" />, label: 'Cut/Sew',            section: 'Role Homes', primaryFor: ['cut_sew'] },
  { href: '/inventory-home',  icon: <UserRound className="w-4 h-4" />, label: 'Inventory',          section: 'Role Homes', primaryFor: ['inventory'] },
  { href: '/shipping-home',   icon: <UserRound className="w-4 h-4" />, label: 'Shipping',           section: 'Role Homes', primaryFor: ['shipping'] },
  { href: '/receiving-home',  icon: <UserRound className="w-4 h-4" />, label: 'Receiving',          section: 'Role Homes', primaryFor: ['receiving'] },

  // Orders
  { href: '/orders',     icon: <FileText className="w-4 h-4" />, label: 'Order Dashboard', section: 'Orders', primaryFor: ['prod_mgr', 'csr', 'sales', 'accounting'] },
  { href: '/orders/new', icon: <FileText className="w-4 h-4" />, label: 'New Order',       section: 'Orders', primaryFor: ['csr', 'sales'] },

  // Production
  { href: '/print-requests',        icon: <ClipboardList className="w-4 h-4" />, label: 'PR Dashboard',           section: 'Production', primaryFor: ['prod_mgr', 'colorist', 'print_op'] },
  { href: '/production-scheduling', icon: <Calendar className="w-4 h-4" />,      label: 'Production Scheduling',  section: 'Production', primaryFor: ['prod_mgr'] },
  { href: '/strike-offs',           icon: <Stamp className="w-4 h-4" />,         label: 'Strike-Offs',            section: 'Production', primaryFor: ['prod_mgr', 'colorist', 'csr'] },
  { href: '/artwork',               icon: <FileImage className="w-4 h-4" />,     label: 'Artwork Files',          section: 'Production', primaryFor: ['colorist'] },
  { href: '/fabrics',               icon: <Layers className="w-4 h-4" />,        label: 'Fabrics',                section: 'Production', primaryFor: ['prod_mgr', 'colorist', 'inventory'] },
  { href: '/printer-queue',         icon: <Printer className="w-4 h-4" />,       label: 'Printer Queue',          section: 'Production', primaryFor: ['print_op', 'prod_mgr', 'colorist'] },
  { href: '/batch-ticket',          icon: <Flame className="w-4 h-4" />,         label: 'Batch Ticket · Heat Press', section: 'Production', primaryFor: ['finishing'] },
  { href: '/cut-sew',               icon: <Scissors className="w-4 h-4" />,      label: 'Cut/Sew Queue',          section: 'Production', primaryFor: ['cut_sew', 'prod_mgr'] },
  { href: '/cut-station',           icon: <ScanLine className="w-4 h-4" />,      label: 'CUT Station · Scan & Label', section: 'Production', primaryFor: ['cut_sew', 'finishing'] },

  // Dashboards
  { href: '/dashboards/daily-production', icon: <BarChart3 className="w-4 h-4" />, label: 'Daily Production', section: 'Dashboards', primaryFor: ['prod_mgr', 'print_op'] },
  { href: '/dashboards/strike-off',       icon: <BarChart3 className="w-4 h-4" />, label: 'Strike-Off',       section: 'Dashboards', primaryFor: ['prod_mgr', 'colorist'] },
  { href: '/dashboards/csr',              icon: <BarChart3 className="w-4 h-4" />, label: 'Customer Service', section: 'Dashboards', primaryFor: ['csr', 'prod_mgr'] },
  { href: '/dashboards/quality',          icon: <BarChart3 className="w-4 h-4" />, label: 'Quality',          section: 'Dashboards', primaryFor: ['prod_mgr', 'colorist'] },

  // Fulfillment
  { href: '/shipping',              icon: <Truck className="w-4 h-4" />,      label: 'Shipping',            section: 'Fulfillment', primaryFor: ['shipping', 'prod_mgr', 'csr'] },
  { href: '/fulfillment-requests',  icon: <Boxes className="w-4 h-4" />,      label: 'Fulfillment Requests', section: 'Fulfillment', primaryFor: ['cut_sew', 'shipping'] },
  { href: '/rolls',                 icon: <CircleDot className="w-4 h-4" />,  label: 'Created Rolls',       section: 'Fulfillment', primaryFor: ['finishing', 'shipping'] },
  { href: '/returns',               icon: <RotateCcw className="w-4 h-4" />,  label: 'Returns / RMAs',      section: 'Fulfillment', primaryFor: ['csr', 'shipping', 'prod_mgr'] },
  { href: '/inventory',             icon: <Package className="w-4 h-4" />,    label: 'Inventory',           section: 'Fulfillment', primaryFor: ['inventory', 'receiving'] },

  // Operations
  { href: '/exceptions',          icon: <AlertTriangle className="w-4 h-4" />, label: 'Exception Center', badge: '11', section: 'Operations', primaryFor: ['prod_mgr', 'csr', 'colorist', 'print_op'] },
  { href: '/packing-correction',  icon: <Undo2 className="w-4 h-4" />,         label: 'Packing Correction', section: 'Operations', primaryFor: ['finishing', 'shipping'] },

  // Admin
  { href: '/customers',          icon: <Users className="w-4 h-4" />,      label: 'Customers',           section: 'Admin', primaryFor: ['csr', 'sales', 'prod_mgr', 'accounting'] },
  { href: '/designs',            icon: <Brush className="w-4 h-4" />,      label: 'Design Dashboard',    section: 'Admin', primaryFor: ['colorist', 'prod_mgr'] },
  { href: '/roadmaps',           icon: <GitBranch className="w-4 h-4" />,  label: 'Roadmap Builder',     section: 'Admin', primaryFor: ['prod_mgr'] },
  { href: '/customer-configs',   icon: <Sliders className="w-4 h-4" />,    label: 'Customer Configs',    section: 'Admin', primaryFor: ['csr'] },
  { href: '/packaging-profiles', icon: <Layers className="w-4 h-4" />,     label: 'Packaging Profiles',  section: 'Admin', primaryFor: ['cut_sew', 'shipping'] },
  { href: '/intake',             icon: <FileText className="w-4 h-4" />,   label: 'Intake Command Center', section: 'Admin', primaryFor: ['csr', 'prod_mgr'] },
  { href: '/po-intake',          icon: <FileScan className="w-4 h-4" />,   label: 'PDF PO Intake', badge: '6', section: 'Admin', primaryFor: ['csr'] },
  { href: '/it-admin',           icon: <ServerCog className="w-4 h-4" />,  label: 'IT / System Admin',   section: 'Admin', primaryFor: [] },
  { href: '/settings',           icon: <Settings className="w-4 h-4" />,   label: 'Settings',            section: 'Admin', primaryFor: [] },
];

const ROLE_LABELS: Record<Role, string> = {
  admin: 'Admin / Owner',
  prod_mgr: 'Production Manager',
  csr: 'CSR',
  sales: 'Sales',
  colorist: 'Colorist',
  print_op: 'Print Operator',
  finishing: 'Finishing',
  cut_sew: 'Cut/Sew',
  inventory: 'Inventory',
  shipping: 'Shipping',
  receiving: 'Receiving',
  accounting: 'Accounting',
};

const SECTION_ORDER = ['Daily', 'Role Homes', 'Orders', 'Production', 'Dashboards', 'Fulfillment', 'Operations', 'Admin'];

function isPrimaryForRole(item: Item, role: Role): boolean {
  if (role === 'admin') return true;                    // admin always sees everything as primary
  if (!item.primaryFor) return true;                    // unmarked items are universal
  return item.primaryFor.includes(role);
}

export function Sidebar() {
  const [role, setRole] = useState<Role>('admin');
  const [showMore, setShowMore] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('helm.role') : null;
    if (saved) setRole(saved as Role);
    setHydrated(true);
    // Listen for role changes from the topbar persona switcher.
    // 'storage' fires across tabs; 'helm.role.changed' fires within the same tab.
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'helm.role' && e.newValue) setRole(e.newValue as Role);
    };
    const onCustom = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (typeof detail === 'string') setRole(detail as Role);
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener('helm.role.changed', onCustom);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('helm.role.changed', onCustom);
    };
  }, []);

  // Partition items into primary (relevant to role) and secondary (everything else)
  const primary = ITEMS.filter((i) => isPrimaryForRole(i, role));
  const secondary = ITEMS.filter((i) => !isPrimaryForRole(i, role));

  // Group primary by section preserving order
  const primaryBySection = new Map<string, Item[]>();
  primary.forEach((i) => {
    if (!primaryBySection.has(i.section)) primaryBySection.set(i.section, []);
    primaryBySection.get(i.section)!.push(i);
  });

  return (
    <aside className="w-60 bg-navy-700 text-white flex-shrink-0 flex flex-col overflow-y-auto">
      <div className="p-5 border-b border-white/10">
        <div className="text-lg font-bold tracking-tight">ADT Helm</div>
        <div className="text-xs opacity-70 mt-0.5">Prototype v1.1</div>
      </div>

      {hydrated && role !== 'admin' && (
        <div className="px-5 py-2.5 border-b border-white/10 bg-navy-900/40 text-[11px]">
          <div className="flex items-center justify-between">
            <span className="opacity-70">Viewing as</span>
            <span className="font-semibold">{ROLE_LABELS[role]}</span>
          </div>
          <div className="opacity-60 mt-0.5 leading-tight">
            Sidebar shows items tailored to this role. Change via topbar avatar.
          </div>
        </div>
      )}

      <nav className="flex-1 py-4 space-y-0.5 text-sm">
        {SECTION_ORDER.map((section) => {
          const items = primaryBySection.get(section) ?? [];
          if (items.length === 0) return null;
          return (
            <div key={section}>
              <Section label={section} />
              {items.map((i) => <NavItem key={i.href} {...i} />)}
            </div>
          );
        })}

        {role !== 'admin' && secondary.length > 0 && (
          <div className="mt-3 pt-2 border-t border-white/10">
            <button
              onClick={() => setShowMore((v) => !v)}
              className="w-full flex items-center justify-between px-5 py-2 text-[10px] uppercase tracking-wider opacity-50 hover:opacity-90"
            >
              <span>More — all sections</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showMore ? 'rotate-180' : ''}`} />
            </button>
            {showMore && (
              <div className="opacity-70">
                {SECTION_ORDER.map((section) => {
                  const items = secondary.filter((i) => i.section === section);
                  if (items.length === 0) return null;
                  return (
                    <div key={section}>
                      <Section label={section} />
                      {items.map((i) => <NavItem key={i.href} {...i} />)}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </nav>

      <div className="p-4 border-t border-white/10 text-xs opacity-70 leading-snug">
        Clickable prototype against the locked blueprint. Data is mock/fake. No real customer info or external services.
      </div>
    </aside>
  );
}

function Section({ label }: { label: string }) {
  return (
    <div className="px-5 pt-4 pb-1 text-[10px] font-semibold uppercase tracking-wider opacity-50">
      {label}
    </div>
  );
}

function NavItem({ href, icon, label, badge }: Item) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2.5 px-5 py-2 hover:bg-white/10 transition-colors"
    >
      {icon}
      <span className="flex-1">{label}</span>
      {badge && (
        <span className="text-[10px] font-bold bg-white/20 px-1.5 py-0.5 rounded-full">{badge}</span>
      )}
    </Link>
  );
}
