// Shared template for role homes (S04, S07, S08, S09, S10, S11, S12, S13).
// Each role home renders the same shape: header w/ user greeting + role tag,
// KPI tile row, "My Queue" primary action table, "Recent Activity" secondary table,
// "Cross-Links" card. Demonstrates the per-role personalization pattern across Helm.
import Link from 'next/link';
import { Card, CardHeader, Tag } from '@/components/ui';

export function RoleHomeShell({
  userName,
  userRole,
  greeting,
  headerAction,
  kpis,
  queueTitle,
  queueSubtitle,
  queue,
  activityTitle,
  activity,
  crossLinks,
}: {
  userName: string;
  userRole: string;
  greeting?: string;
  headerAction?: React.ReactNode;
  kpis: { label: string; value: any; accent?: 'green' | 'yellow' | 'red' | 'blue' }[];
  queueTitle: string;
  queueSubtitle?: string;
  queue: React.ReactNode;
  activityTitle: string;
  activity: React.ReactNode;
  crossLinks: { label: string; href: string; description: string }[];
}) {
  const hour = new Date().getHours();
  const tod = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-navy-900">Good {tod}, {userName.split(' ')[0]}</h1>
            <Tag color="blue">{userRole}</Tag>
          </div>
          {greeting && <p className="text-sm text-gray-600 mt-0.5">{greeting}</p>}
        </div>
        {headerAction}
      </header>

      <div className={`grid grid-cols-${kpis.length} gap-4`} style={{ gridTemplateColumns: `repeat(${kpis.length}, minmax(0, 1fr))` }}>
        {kpis.map((k) => (
          <RoleKPI key={k.label} {...k} />
        ))}
      </div>

      <Card>
        <CardHeader title={queueTitle} subtitle={queueSubtitle} />
        {queue}
      </Card>

      <Card>
        <CardHeader title={activityTitle} />
        {activity}
      </Card>

      <Card>
        <CardHeader title="Where to go" />
        <div className="p-5 grid grid-cols-3 gap-3">
          {crossLinks.map((l) => (
            <Link key={l.href} href={l.href}
              className="border border-gray-200 rounded p-3 hover:bg-gray-50 hover:border-navy-700/30 transition-colors">
              <div className="font-semibold text-navy-700 text-sm">{l.label} →</div>
              <div className="text-xs text-gray-500 mt-0.5">{l.description}</div>
            </Link>
          ))}
        </div>
      </Card>
    </div>
  );
}

function RoleKPI({ label, value, accent }: { label: string; value: any; accent?: 'green' | 'yellow' | 'red' | 'blue' }) {
  const cls = accent === 'green' ? 'text-green-700'
    : accent === 'yellow' ? 'text-yellow-700'
    : accent === 'red' ? 'text-helm-red'
    : accent === 'blue' ? 'text-navy-700'
    : 'text-navy-900';
  return (
    <Card>
      <div className="p-4">
        <div className="text-xs uppercase tracking-wider text-gray-500 mb-1">{label}</div>
        <div className={`text-2xl font-bold ${cls}`}>{value}</div>
      </div>
    </Card>
  );
}
