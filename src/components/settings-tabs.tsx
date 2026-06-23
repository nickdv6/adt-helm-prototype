// Settings sub-navigation strip. Rendered at the top of each /settings/* page
// so users can pivot between Printers / Print Profiles / Roles without
// bouncing back to /settings.

import Link from 'next/link';

const TABS = [
  { href: '/settings', label: 'Overview' },
  { href: '/settings/printers', label: 'Printers' },
  { href: '/settings/print-profiles', label: 'Print Profiles' },
  { href: '/settings/roles', label: 'Roles & Permissions' },
];

export function SettingsTabs({ active }: { active: string }) {
  return (
    <div className="border-b border-gray-200 flex items-center gap-1">
      {TABS.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px ${
            active === t.href
              ? 'border-navy-700 text-navy-900'
              : 'border-transparent text-gray-500 hover:text-navy-700 hover:border-gray-300'
          }`}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}
