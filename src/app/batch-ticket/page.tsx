import Link from 'next/link';
import { Card, CardHeader, Tag, Button } from '@/components/ui';

// /batch-ticket — C24 Digital Batch Ticket + Transfer Press Scan-Confirm
//
// Per WHY (Exception Handling): wrong-base-cloth errors at transfer press "happen way too often."
// Root cause: heat-press operator (Lucio) works off a sticky note made by the JP4 print operator.
// Sticky has fabric + yards but NO PR linkage. Lucio loads fabric matching the label and trusts
// the prints are correctly grouped. No verification against source PR.
//
// Architectural solution: preserve the batching efficiency pattern (smart) but REPLACE the
// sticky-note artifact with a digital batch ticket + scan-confirm at transfer.
//
// Two views on this page:
//   (1) Print Operator (Julio) — building the digital batch ticket
//   (2) Heat Press Operator (Lucio) — scan-confirm UI before transferring

type BatchPR = {
  pr_number: string;
  parent_qr: string;
  customer: string;
  yards: number;
  sequence_on_roll: number;
  white_space_after: boolean;
  status: 'queued' | 'scanned' | 'transferred';
};

// Dye Sublimation flow: MS JP4-A or MS JP4-B prints onto transfer paper, then the design
// is heat-pressed onto polyester-based fabric. So the batch's 'fabric' here is the
// destination fabric loaded at the heat press, not what's on the printer.
const BATCH = {
  batch_id: 'B-2845',
  built_by: 'Julio Vargas',
  built_at: '12 minutes ago',
  fabric: 'Polyester Sateen Performance',
  printer: 'MS JP4-A',
  total_yards: 45,
  destination_press: 'Heat Press #2 (Lucio)',
  prs: [
    { pr_number: 'PR-12001', parent_qr: 'PQ-A4F7-2845', customer: 'St. Frank',         yards: 12, sequence_on_roll: 1, white_space_after: true,  status: 'transferred' as const },
    { pr_number: 'PR-12002', parent_qr: 'PQ-B821-2845', customer: 'Inside / Havenly',  yards: 8,  sequence_on_roll: 2, white_space_after: true,  status: 'scanned' as const },
    { pr_number: 'PR-12003', parent_qr: 'PQ-C9D3-2845', customer: 'Laura Park',        yards: 15, sequence_on_roll: 3, white_space_after: true,  status: 'queued' as const },
    { pr_number: 'PR-12004', parent_qr: 'PQ-D4E5-2845', customer: 'House of MBR',      yards: 10, sequence_on_roll: 4, white_space_after: false, status: 'queued' as const },
  ] as BatchPR[],
};

// Other queued batches awaiting transfer
const OTHER_BATCHES = [
  { id: 'B-2846', fabric: 'Polyester Knit',                total_yards: 32, pr_count: 3, status: 'Awaiting transfer', press: 'Heat Press #1' },
  { id: 'B-2847', fabric: 'Polyester Sateen Performance',  total_yards: 28, pr_count: 5, status: 'Awaiting transfer', press: 'Heat Press #2' },
  { id: 'B-2848', fabric: 'Polyester Velour', total_yards: 20, pr_count: 2, status: 'Building (Julio)', press: '—' },
];

export default function BatchTicket({ searchParams }: { searchParams: { view?: string } }) {
  const view = searchParams?.view ?? 'lucio';
  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-navy-900">Digital Batch Ticket (C24)</h1>
        <p className="text-sm text-gray-500 mt-1">
          Replaces the sticky note · preserves batching efficiency · adds PR linkage + scan-to-confirm at the heat press
        </p>
      </header>

      <div className="border-b border-gray-200 flex gap-1">
        <TabLink href="/batch-ticket?view=lucio" label="Heat Press Operator (Lucio)" active={view === 'lucio'} />
        <TabLink href="/batch-ticket?view=julio" label="Print Operator (Julio · ticket builder)" active={view === 'julio'} />
        <TabLink href="/batch-ticket?view=queue" label="All Batches" active={view === 'queue'} />
      </div>

      {view === 'lucio' && <LucioScanConfirm />}
      {view === 'julio' && <JulioBuilder />}
      {view === 'queue' && <BatchQueue />}
    </div>
  );
}

function LucioScanConfirm() {
  // Scan-to-confirm flow at the heat press. The active PR in this batch is PR-12002 (scanned, waiting confirm)
  // and PR-12003 / PR-12004 are still queued. PR-12001 already transferred.
  const next = BATCH.prs.find((p) => p.status === 'queued');
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <Stat label="Active Batch" value={BATCH.batch_id} accent="blue" />
        <Stat label="Fabric Expected" value={BATCH.fabric} />
        <Stat label="Yards Remaining" value={`${BATCH.prs.filter((p) => p.status !== 'transferred').reduce((s, p) => s + p.yards, 0)} of ${BATCH.total_yards}`} />
      </div>

      {/* Step 1: Fabric roll scan */}
      <Card>
        <CardHeader title="Step 1 · Scan the fabric roll" subtitle="Confirms loaded fabric matches what the batch expects" />
        <div className="p-5 grid grid-cols-2 gap-6">
          <div>
            <div className="text-xs uppercase tracking-wider text-gray-500 mb-2">Expected</div>
            <div className="border border-gray-200 rounded p-3">
              <div className="text-sm"><span className="text-gray-500">Fabric:</span> <strong>{BATCH.fabric}</strong></div>
              <div className="text-xs text-gray-500 mt-1">Defined in batch ticket {BATCH.batch_id}</div>
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-gray-500 mb-2">Scanned</div>
            <div className="border border-green-300 bg-green-50 rounded p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-mono">ROLL-CSC110-0394</span>
                <Tag color="green">MATCH</Tag>
              </div>
              <div className="text-xs text-gray-700">Cotton Sateen 110-thread · 75 yd remaining on roll</div>
            </div>
          </div>
        </div>
      </Card>

      {/* Step 2: Parent QR scan-confirm — the active block */}
      <Card>
        <CardHeader title="Step 2 · Scan each print's Parent QR before transferring" subtitle="Each scan confirms the print belongs to THIS batch on THIS fabric · BLOCKS on mismatch" />
        <div className="p-5">
          <div className="bg-navy-50 border-l-4 border-navy-500 p-4 rounded-r mb-4">
            <div className="text-xs uppercase tracking-wider text-navy-700 font-semibold mb-1">Next to transfer</div>
            <div className="text-base font-mono">
              {next?.pr_number} · {next?.yards} yd · sequence #{next?.sequence_on_roll}
            </div>
            <div className="text-xs text-gray-600 mt-1">Customer: {next?.customer} · Parent QR expected: <span className="font-mono">{next?.parent_qr}</span></div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="border border-gray-200 rounded p-3">
              <div className="text-xs uppercase tracking-wider text-gray-500 mb-2">Scan Parent QR (printed on leader margin)</div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  disabled
                  placeholder="Awaiting scan…"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm font-mono bg-white"
                />
                <Button size="sm">Submit</Button>
              </div>
              <div className="text-[11px] text-gray-500 mt-2 italic">Lucio uses the handheld scanner clipped to the press station.</div>
            </div>
            <div className="border border-gray-200 rounded p-3">
              <div className="text-xs uppercase tracking-wider text-gray-500 mb-2">What happens on mismatch</div>
              <div className="text-xs space-y-1.5 text-gray-700">
                <div className="flex gap-2">
                  <Tag color="red">BLOCK</Tag>
                  <span>Press is blocked from proceeding</span>
                </div>
                <div className="flex gap-2">
                  <Tag color="yellow">Why</Tag>
                  <span>Wrong PR, wrong batch, wrong fabric, or QR damaged</span>
                </div>
                <div className="flex gap-2">
                  <Tag color="purple">Supervisor override</Tag>
                  <span>Megan can force-allow with reason logged</span>
                </div>
                <div className="flex gap-2">
                  <Tag color="blue">Auto-exception</Tag>
                  <span>Raises EX type "Transfer Fabric Mismatch" in Exception Center</span>
                </div>
              </div>
            </div>
          </div>

          <div className="text-xs uppercase tracking-wider text-gray-500 mb-2">Batch progress</div>
          <table className="w-full text-sm">
            <thead className="text-xs text-gray-500 uppercase tracking-wider border-b border-gray-200">
              <tr>
                <th className="text-left px-3 py-2">Seq</th>
                <th className="text-left px-3 py-2">PR #</th>
                <th className="text-left px-3 py-2">Parent QR</th>
                <th className="text-left px-3 py-2">Customer</th>
                <th className="text-right px-3 py-2">Yards</th>
                <th className="text-left px-3 py-2">White space</th>
                <th className="text-left px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {BATCH.prs.map((p) => (
                <tr key={p.pr_number} className="border-t border-gray-100">
                  <td className="px-3 py-2 font-mono text-xs">{p.sequence_on_roll}</td>
                  <td className="px-3 py-2"><Link href="/print-requests/1" className="font-mono text-navy-700 hover:underline">{p.pr_number}</Link></td>
                  <td className="px-3 py-2 font-mono text-xs text-gray-600">{p.parent_qr}</td>
                  <td className="px-3 py-2 text-xs">{p.customer}</td>
                  <td className="px-3 py-2 text-right font-mono">{p.yards}</td>
                  <td className="px-3 py-2 text-xs text-gray-500">{p.white_space_after ? 'after' : '—'}</td>
                  <td className="px-3 py-2">
                    {p.status === 'transferred' ? <Tag color="green">Transferred</Tag>
                      : p.status === 'scanned' ? <Tag color="blue">Scan confirmed · ready</Tag>
                      : <Tag color="gray">Queued</Tag>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function JulioBuilder() {
  // Julio's view: print queue grouped by fabric. Building a batch from PRs on the same fabric.
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Build a Batch Ticket" subtitle="Group PRs on the same fabric · sequence them on the roll · auto-generates Parent QRs · sends to heat press" />
        <div className="p-5">
          <div className="grid grid-cols-3 gap-4 mb-5">
            <Field label="Fabric" value={BATCH.fabric} mono />
            <Field label="Printer (source)" value={BATCH.printer} />
            <Field label="Destination press" value={BATCH.destination_press} />
          </div>

          <div className="text-xs uppercase tracking-wider text-gray-500 mb-2">PRs included in this batch</div>
          <table className="w-full text-sm mb-4">
            <thead className="text-xs text-gray-500 uppercase tracking-wider border-b border-gray-200">
              <tr>
                <th className="text-left px-3 py-2 w-12">Seq</th>
                <th className="text-left px-3 py-2">PR #</th>
                <th className="text-left px-3 py-2">Customer</th>
                <th className="text-right px-3 py-2">Yards</th>
                <th className="text-left px-3 py-2">Parent QR (auto-generated)</th>
                <th className="text-left px-3 py-2">White space after?</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {BATCH.prs.map((p) => (
                <tr key={p.pr_number} className="border-t border-gray-100">
                  <td className="px-3 py-2 font-mono text-xs">{p.sequence_on_roll}</td>
                  <td className="px-3 py-2 font-mono">{p.pr_number}</td>
                  <td className="px-3 py-2 text-xs">{p.customer}</td>
                  <td className="px-3 py-2 text-right font-mono">{p.yards}</td>
                  <td className="px-3 py-2 font-mono text-xs text-gray-600">{p.parent_qr}</td>
                  <td className="px-3 py-2 text-xs">{p.white_space_after ? 'Yes' : 'No'}</td>
                  <td className="px-3 py-2 text-right pr-3">
                    <Button variant="ghost" size="sm">↑</Button>
                    <Button variant="ghost" size="sm">↓</Button>
                    <Button variant="ghost" size="sm">×</Button>
                  </td>
                </tr>
              ))}
              <tr>
                <td colSpan={7} className="px-3 py-2 text-xs text-gray-500 italic">
                  Helm filters the print queue to PRs on the same fabric · drag-drop or use ↑↓ to set sequence · operator can add or remove PRs.
                </td>
              </tr>
            </tbody>
            <tfoot>
              <tr className="border-t border-gray-200 font-semibold">
                <td colSpan={3} className="px-3 py-2 text-xs uppercase tracking-wider text-gray-500">Total</td>
                <td className="px-3 py-2 text-right font-mono">{BATCH.total_yards}</td>
                <td colSpan={3}></td>
              </tr>
            </tfoot>
          </table>

          <div className="flex justify-end gap-2">
            <Button variant="ghost">Cancel</Button>
            <Button variant="secondary">Save Draft</Button>
            <Button>Lock + Send to {BATCH.destination_press}</Button>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="What 'Lock + Send' does" />
        <div className="px-5 py-4 text-sm space-y-2 text-gray-700">
          <p>1. Generates one Parent QR per PR in the batch. QRs are printed onto the fabric leader / margin during the print run so they travel with the physical roll.</p>
          <p>2. Locks the batch ticket — sequence is now authoritative. Further edits require Megan override.</p>
          <p>3. Sends the digital ticket to the destination heat press station (Lucio's screen).</p>
          <p>4. At the heat press, Lucio scans the roll + each Parent QR before transferring. Mismatch BLOCKS, raises an Exception Center entry (Transfer Fabric Mismatch or Pre-Ship Identity Mismatch), and waits for supervisor override.</p>
        </div>
      </Card>
    </div>
  );
}

function BatchQueue() {
  return (
    <Card>
      <CardHeader title="All Batches" subtitle="What's building, what's awaiting transfer, what's done" />
      <table className="w-full text-sm">
        <thead className="text-xs text-gray-500 uppercase tracking-wider border-b border-gray-200">
          <tr>
            <th className="text-left px-4 py-2.5">Batch #</th>
            <th className="text-left px-4 py-2.5">Fabric</th>
            <th className="text-right px-4 py-2.5">Total Yds</th>
            <th className="text-right px-4 py-2.5">PRs</th>
            <th className="text-left px-4 py-2.5">Destination Press</th>
            <th className="text-left px-4 py-2.5">Status</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-t border-gray-100 bg-navy-50">
            <td className="px-4 py-2.5 font-mono font-semibold text-navy-700">{BATCH.batch_id}</td>
            <td className="px-4 py-2.5 text-xs">{BATCH.fabric}</td>
            <td className="px-4 py-2.5 text-right font-mono">{BATCH.total_yards}</td>
            <td className="px-4 py-2.5 text-right font-mono">{BATCH.prs.length}</td>
            <td className="px-4 py-2.5 text-xs">{BATCH.destination_press}</td>
            <td className="px-4 py-2.5"><Tag color="blue">In progress</Tag></td>
          </tr>
          {OTHER_BATCHES.map((b) => (
            <tr key={b.id} className="border-t border-gray-100 hover:bg-gray-50">
              <td className="px-4 py-2.5 font-mono">{b.id}</td>
              <td className="px-4 py-2.5 text-xs">{b.fabric}</td>
              <td className="px-4 py-2.5 text-right font-mono">{b.total_yards}</td>
              <td className="px-4 py-2.5 text-right font-mono">{b.pr_count}</td>
              <td className="px-4 py-2.5 text-xs">{b.press}</td>
              <td className="px-4 py-2.5">
                {b.status === 'Awaiting transfer' ? <Tag color="yellow">{b.status}</Tag> : <Tag color="gray">{b.status}</Tag>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function Stat({ label, value, accent }: { label: string; value: any; accent?: 'yellow' | 'red' | 'green' | 'blue' }) {
  const bar = {
    yellow: 'bg-helm-yellow', red: 'bg-helm-red', green: 'bg-helm-green', blue: 'bg-helm-blue',
  }[accent || ''] || 'bg-gray-200';
  return (
    <Card>
      <div className="p-4 flex items-center gap-3">
        <div className={`w-1 h-10 rounded ${bar}`} />
        <div>
          <div className="text-lg font-bold text-navy-900 leading-tight font-mono">{value}</div>
          <div className="text-[11px] text-gray-500 uppercase tracking-wider mt-0.5">{label}</div>
        </div>
      </div>
    </Card>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-gray-500 mb-1">{label}</div>
      <div className={`text-sm ${mono ? 'font-mono' : ''}`}>{value}</div>
    </div>
  );
}

function TabLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  const cls = active
    ? 'border-navy-700 text-navy-900'
    : 'border-transparent text-gray-500 hover:text-navy-700 hover:border-gray-300';
  return (
    <Link href={href} className={`px-4 py-2.5 border-b-2 text-sm font-semibold ${cls}`}>
      {label}
    </Link>
  );
}
