import { Bell, Search, User } from 'lucide-react';

export function Topbar() {
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

      <button className="relative p-2 hover:bg-gray-100 rounded text-gray-600" title="Notifications">
        <Bell className="w-5 h-5" />
        <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
      </button>

      <div className="flex items-center gap-2 pl-4 border-l border-gray-200">
        <div className="w-8 h-8 rounded-full bg-navy-700 text-white flex items-center justify-center text-xs font-bold">SC</div>
        <div className="text-sm">
          <div className="font-semibold leading-tight">Sarah Castillo</div>
          <div className="text-[11px] text-gray-500 leading-tight">CSR · ADT</div>
        </div>
      </div>
    </header>
  );
}
