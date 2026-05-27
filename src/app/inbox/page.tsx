import Link from 'next/link';
import { getDb } from '@/lib/db';
import { Card, CardHeader, Tag } from '@/components/ui';
import { relativeTime } from '@/lib/utils';

// /inbox — Notification Inbox
// Per OD-4 — 49 locked notification triggers; user inbox surfaces in-app notifications
// Recipient filter defaults to "all" so reviewers can see what each role would receive

export default function Inbox({ searchParams }: { searchParams: { role?: string } }) {
  const db = getDb();
  const roleFilter = searchParams?.role ?? 'all';

  let where = '1=1';
  if (roleFilter !== 'all') where = `recipient_role = '${roleFilter.replace(/'/g, '')}'`;

  const notes = db.prepare(`
    SELECT n.*, u.full_name FROM notifications n
    LEFT JOIN users u ON n.recipient_user_id = u.id
    WHERE ${where}
    ORDER BY n.created_at DESC LIMIT 100
  `).all() as any[];

  const counts = {
    all: (db.prepare('SELECT COUNT(*) as c FROM notifications').get() as any).c,
    csr: (db.prepare("SELECT COUNT(*) as c FROM notifications WHERE recipient_role = 'csr'").get() as any).c,
    colorist: (db.prepare("SELECT COUNT(*) as c FROM notifications WHERE recipient_role = 'colorist'").get() as any).c,
    prod_mgr: (db.prepare("SELECT COUNT(*) as c FROM notifications WHERE recipient_role = 'prod_mgr'").get() as any).c,
    unread: (db.prepare('SELECT COUNT(*) as c FROM notifications WHERE is_read = 0').get() as any).c,
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-navy-900">Notification Inbox</h1>
        <p className="text-sm text-gray-500 mt-1">Per OD-4 · 49 locked notification triggers · {counts.unread} unread</p>
      </header>

      <div className="flex flex-wrap gap-2">
        <Chip label="All" value="all" current={roleFilter} count={counts.all} />
        <Chip label="CSR" value="csr" current={roleFilter} count={counts.csr} />
        <Chip label="Colorist" value="colorist" current={roleFilter} count={counts.colorist} />
        <Chip label="Production Mgr" value="prod_mgr" current={roleFilter} count={counts.prod_mgr} />
      </div>

      <Card>
        <div className="divide-y divide-gray-100">
          {notes.length === 0 && <div className="px-5 py-10 text-center text-sm text-gray-400">No notifications.</div>}
          {notes.map((n) => (
            <div key={n.id} className={`px-5 py-3 flex items-start gap-3 ${n.is_read ? 'opacity-70' : ''}`}>
              <div className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${n.is_read ? 'bg-gray-300' : 'bg-navy-700'}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <Tag color="gray">{n.notification_code}</Tag>
                  <span className="font-semibold text-sm">{n.subject}</span>
                </div>
                <div className="text-xs text-gray-600">{n.body}</div>
                <div className="text-[10px] text-gray-400 mt-1">
                  To {n.full_name || n.recipient_role} via {n.channel} · {relativeTime(n.created_at)}
                </div>
              </div>
              {n.related_entity_type === 'order' && (
                <Link href={`/orders/${n.related_entity_id}`} className="text-xs font-semibold text-navy-700 hover:underline whitespace-nowrap">Open →</Link>
              )}
              {n.related_entity_type === 'print_request' && (
                <Link href={`/print-requests/${n.related_entity_id}`} className="text-xs font-semibold text-navy-700 hover:underline whitespace-nowrap">Open →</Link>
              )}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function Chip({ label, value, current, count }: { label: string; value: string; current: string; count: number }) {
  const active = value === current;
  return (
    <Link href={`/inbox?role=${value}`}
      className={`px-3 py-1.5 text-xs font-semibold rounded-full border ${active ? 'bg-navy-700 text-white border-navy-700' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}>
      {label} <span className="ml-1 opacity-70">({count})</span>
    </Link>
  );
}
