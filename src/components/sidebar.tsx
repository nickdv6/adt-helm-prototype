import Link from 'next/link';
import { Home, FileText, Layers, Truck, Package, Palette, Printer, Scissors, Settings, Users, Inbox, AlertTriangle, Boxes, Flame, Sliders, FileScan, ClipboardList, CircleDot, Undo2, Brush, ScanLine, ServerCog } from 'lucide-react';

export function Sidebar() {
  return (
    <aside className="w-60 bg-navy-700 text-white flex-shrink-0 flex flex-col">
      <div className="p-5 border-b border-white/10">
        <div className="text-lg font-bold tracking-tight">ADT Helm</div>
        <div className="text-xs opacity-70 mt-0.5">Prototype v0.1</div>
      </div>

      <nav className="flex-1 py-4 space-y-0.5 text-sm">
        <Section label="Daily" />
        <NavItem href="/" icon={<Home className="w-4 h-4" />} label="My Home" />
        <NavItem href="/inbox" icon={<Inbox className="w-4 h-4" />} label="Inbox" badge="8" />

        <Section label="Orders" />
        <NavItem href="/orders" icon={<FileText className="w-4 h-4" />} label="Order Dashboard" />
        <NavItem href="/orders/new" icon={<FileText className="w-4 h-4" />} label="New Order" />

        <Section label="Production" />
        <NavItem href="/print-requests" icon={<ClipboardList className="w-4 h-4" />} label="PR Dashboard" />
        <NavItem href="/colorist" icon={<Palette className="w-4 h-4" />} label="Colorist Home" />
        <NavItem href="/printer-queue" icon={<Printer className="w-4 h-4" />} label="Printer Queue" />
        <NavItem href="/batch-ticket" icon={<Flame className="w-4 h-4" />} label="Batch Ticket · Heat Press" />
        <NavItem href="/cut-sew" icon={<Scissors className="w-4 h-4" />} label="Cut/Sew Queue" />
        <NavItem href="/cut-station" icon={<ScanLine className="w-4 h-4" />} label="CUT Station · Scan & Label" />

        <Section label="Fulfillment" />
        <NavItem href="/shipping" icon={<Truck className="w-4 h-4" />} label="Shipping" />
        <NavItem href="/fulfillment-requests" icon={<Boxes className="w-4 h-4" />} label="Fulfillment Requests" />
        <NavItem href="/rolls" icon={<CircleDot className="w-4 h-4" />} label="Created Rolls" />
        <NavItem href="/inventory" icon={<Package className="w-4 h-4" />} label="Inventory" />

        <Section label="Operations" />
        <NavItem href="/exceptions" icon={<AlertTriangle className="w-4 h-4" />} label="Exception Center" badge="6" />
        <NavItem href="/packing-correction" icon={<Undo2 className="w-4 h-4" />} label="Packing Correction" />

        <Section label="Admin" />
        <NavItem href="/customers" icon={<Users className="w-4 h-4" />} label="Customers" />
        <NavItem href="/designs" icon={<Brush className="w-4 h-4" />} label="Design Dashboard" />
        <NavItem href="/customer-configs" icon={<Sliders className="w-4 h-4" />} label="Customer Configs" />
        <NavItem href="/packaging-profiles" icon={<Layers className="w-4 h-4" />} label="Packaging Profiles" />
        <NavItem href="/intake" icon={<FileText className="w-4 h-4" />} label="Intake Command Center" />
        <NavItem href="/po-intake" icon={<FileScan className="w-4 h-4" />} label="PDF PO Intake" badge="6" />
        <NavItem href="/it-admin" icon={<ServerCog className="w-4 h-4" />} label="IT / System Admin (S14)" />
        <NavItem href="/settings" icon={<Settings className="w-4 h-4" />} label="Settings" />
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

function NavItem({ href, icon, label, badge }: { href: string; icon: React.ReactNode; label: string; badge?: string }) {
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
