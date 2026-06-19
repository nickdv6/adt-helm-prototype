// S26 Strike-Off Detail
// Full record + artwork preview slot + colorist notes + customer decision + Approved-with-Changes path
// + public-link copy + status history.
import Link from 'next/link';
import { getDb } from '@/lib/db';
import { Card, CardHeader, StatusPill, Tag, Button } from '@/components/ui';
import { formatDate, relativeTime } from '@/lib/utils';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function StrikeOffDetail({ params }: { params: { id: string } }) {
  const db = getDb();
  const id = parseInt(params.id);
  const so = db.prepare(`
    SELECT so.*, pr.pr_number, pr.printed_yardage, pr.planned_yardage, pr.status as pr_status,
           o.order_number, o.id as order_id, o.roadmap, c.name as company_name, c.id as company_id,
           u.full_name as colorist_name,
           af.file_name as artwork_file_name, af.version_number as artwork_version
    FROM strike_offs so
    JOIN print_requests pr ON so.print_request_id = pr.id
    JOIN order_lines ol ON pr.order_line_id = ol.id
    JOIN orders o ON ol.order_id = o.id
    JOIN companies c ON o.company_id = c.id
    LEFT JOIN users u ON pr.colorist_user_id = u.id
    LEFT JOIN artwork_files af ON so.artwork_file_id = af.id
    WHERE so.id = ?
  `).get(id) as any;
  if (!so) notFound();

  const publicLink = so.approval_token ? `/approve/${so.approval_token}` : null;
  const isDecided = !!so.customer_decision_at;
  const isAwaiting = ['Awaiting Approval', 'Customer Reviewing'].includes(so.status);

  // Build a faux status history for the prototype
  const stages = [
    { code: 'Requested', label: 'Requested', complete: true, at: relativeTime(new Date(Date.now() - 20*24*3600*1000).toISOString()) },
    { code: 'In Color Matching', label: 'Colorist matching', complete: ['In Color Matching','Printing','Quality Check','Awaiting Approval','Customer Reviewing','Approved','Approve with Changes','Rejected','Revision Required','Closed'].includes(so.status), at: '14d ago' },
    { code: 'Printing', label: 'Printing strike', complete: ['Printing','Quality Check','Awaiting Approval','Customer Reviewing','Approved','Approve with Changes','Rejected','Revision Required','Closed'].includes(so.status), at: '12d ago' },
    { code: 'Quality Check', label: 'QC inspection', complete: ['Quality Check','Awaiting Approval','Customer Reviewing','Approved','Approve with Changes','Rejected','Revision Required','Closed'].includes(so.status), at: '11d ago' },
    { code: 'Awaiting Approval', label: 'Sent to customer', complete: ['Awaiting Approval','Customer Reviewing','Approved','Approve with Changes','Rejected','Revision Required','Closed'].includes(so.status), at: so.approval_sent_at ? relativeTime(so.approval_sent_at) : '—' },
    { code: 'Customer Decision', label: isDecided ? `Customer ${so.customer_decision_outcome}` : 'Waiting on customer', complete: isDecided, at: so.customer_decision_at ? relativeTime(so.customer_decision_at) : '—' },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <header className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Link href="/strike-offs" className="text-sm text-gray-500 hover:underline">← Strike-Offs</Link>
            <span className="text-gray-300">/</span>
            <h1 className="text-2xl font-bold text-navy-900 font-mono">{so.strike_off_number}</h1>
            <Tag color={isAwaiting ? 'yellow' : isDecided ? (so.customer_decision_outcome === 'Approved' ? 'green' : so.customer_decision_outcome === 'Approve with Changes' ? 'purple' : 'red') : 'gray'}>
              {so.status}
            </Tag>
          </div>
          <div className="text-sm text-gray-600">
            <Link href={`/customers/${so.company_id}`} className="hover:underline">{so.company_name}</Link>
            {' · '}
            <Link href={`/orders/${so.order_id}`} className="hover:underline font-mono">{so.order_number}</Link>
            {' · '}
            <Link href={`/print-requests/${so.print_request_id}`} className="hover:underline font-mono">{so.pr_number}</Link>
            {' · Roadmap '}<span className="font-mono">{so.roadmap}</span>
          </div>
        </div>
        <div className="flex gap-2">
          {isAwaiting && publicLink ? (
            <Button variant="secondary">Resend Approval Email</Button>
          ) : null}
          {!isDecided ? (
            <Button>Mark Approved Internally</Button>
          ) : null}
        </div>
      </header>

      <div className="grid grid-cols-3 gap-6">
        {/* Left: Artwork preview slot */}
        <Card className="col-span-1">
          <CardHeader title="Strike-Off Artwork" />
          <div className="p-5 space-y-3">
            <div className="aspect-square bg-gradient-to-br from-gray-100 to-gray-200 border border-gray-300 rounded flex items-center justify-center text-gray-400 text-xs">
              [Artwork preview — {so.artwork_file_name ?? 'no file linked'}]
            </div>
            <div className="text-xs text-gray-600 space-y-1">
              <div><strong>File:</strong> <span className="font-mono">{so.artwork_file_name ?? '—'}</span></div>
              <div><strong>Version:</strong> v{so.artwork_version ?? 1}</div>
              <div><strong>Yardage:</strong> {so.printed_yardage ?? '—'} / {so.planned_yardage ?? '—'} yds</div>
              <div><strong>PR Status:</strong> {so.pr_status}</div>
              <div><strong>Colorist:</strong> {so.colorist_name ?? '—'}</div>
            </div>
          </div>
        </Card>

        {/* Middle: Customer-facing public link + decision */}
        <Card className="col-span-2">
          <CardHeader title="Customer Approval" subtitle="Public link customer uses to decide. No login required." />
          <div className="p-5 space-y-4">
            {publicLink ? (
              <div className="bg-navy-50 border border-navy-700/30 rounded p-3 flex items-center gap-3">
                <div className="flex-1">
                  <div className="text-[10px] text-navy-700 uppercase tracking-wider font-semibold mb-1">Public approval link</div>
                  <code className="text-xs text-navy-900 break-all">https://helm.adt.com{publicLink}</code>
                </div>
                <Link href={publicLink} target="_blank" className="text-xs font-semibold text-white bg-navy-700 hover:bg-navy-900 px-3 py-1.5 rounded">
                  Open ↗
                </Link>
              </div>
            ) : (
              <div className="text-xs text-gray-500 italic">Public link not yet generated. Sending the strike-off to the customer will create one.</div>
            )}

            {isDecided ? (
              <div className="border border-gray-200 rounded p-4 space-y-2">
                <div className="text-xs uppercase tracking-wider text-gray-500 font-semibold">Customer Decision</div>
                <div className="flex items-center gap-2">
                  <Tag color={so.customer_decision_outcome === 'Approved' ? 'green'
                    : so.customer_decision_outcome === 'Approve with Changes' ? 'purple' : 'red'}>
                    {so.customer_decision_outcome}
                  </Tag>
                  <span className="text-xs text-gray-500">{relativeTime(so.customer_decision_at)}</span>
                </div>
                {so.customer_change_notes && (
                  <div className="mt-2 text-sm bg-helm-purple/30 border-l-4 border-purple-400 px-3 py-2 rounded">
                    <div className="text-[10px] uppercase tracking-wider text-purple-700 font-semibold mb-1">Change Notes (customer)</div>
                    <div className="italic text-purple-900">{so.customer_change_notes}</div>
                  </div>
                )}
                {so.customer_decision_outcome === 'Approve with Changes' && (
                  <div className="mt-3 flex gap-2">
                    <Button size="sm">Acknowledge & route to colorist</Button>
                    <Button size="sm" variant="secondary">Request 2nd strike</Button>
                  </div>
                )}
                {so.customer_decision_outcome === 'Rejected' && (
                  <div className="mt-3 flex gap-2">
                    <Button size="sm" variant="danger">Open exception</Button>
                    <Button size="sm" variant="secondary">Re-strike</Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-xs text-gray-500 italic">No customer decision yet.</div>
            )}
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader title="Status History" />
        <div className="p-5">
          <div className="flex items-center">
            {stages.map((s, i) => (
              <div key={s.code} className="flex items-center flex-1 last:flex-none">
                <div className={`h-0.5 flex-1 ${i === 0 ? 'hidden' : s.complete ? 'bg-green-500' : 'bg-gray-200'}`} />
                <div className="flex flex-col items-center -mx-0.5">
                  <div className={`w-7 h-7 rounded-full border-2 flex items-center justify-center text-[10px] font-bold ${
                    s.complete ? 'bg-helm-green text-green-900 border-green-700' : 'bg-white text-gray-400 border-gray-300'
                  }`}>
                    {s.complete ? '✓' : i + 1}
                  </div>
                  <div className="mt-1 text-[10px] font-semibold text-gray-700 whitespace-nowrap">{s.label}</div>
                  <div className="text-[10px] text-gray-400">{s.at}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="Internal Notes" />
        <div className="p-5 space-y-3 text-sm">
          <div className="text-xs text-gray-500 italic">Prototype mock notes — would be a real comment thread in production.</div>
          <Note who={so.colorist_name ?? 'Colorist'} when="2 days ago"
            text="Color match dialed in on Durst run 2. Customer's prior swatch is 4° warmer than master — adjusted." />
          <Note who="Megan B." when="1 day ago"
            text="Sent to customer for sign-off. ETA 48 hours per their SLA." />
        </div>
      </Card>
    </div>
  );
}

function Note({ who, when, text }: { who: string; when: string; text: string }) {
  return (
    <div className="border border-gray-200 rounded p-3">
      <div className="text-xs text-gray-500 mb-1"><strong className="text-navy-700">{who}</strong> · {when}</div>
      <div>{text}</div>
    </div>
  );
}
