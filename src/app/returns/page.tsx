// S35b Returns Dashboard
// Mock data — no returns / RMA table in schema. Demonstrates the surface so Sight
// Source can see the data shape and decision points.
import Link from 'next/link';
import { Card, CardHeader, Tag, Button } from '@/components/ui';

export const dynamic = 'force-dynamic';

const MOCK_RMAS = [
  { code: 'RMA-2104', customer: 'St Frank', order: 'ADT-4506', received: '2 days ago', reason: 'Color mismatch', condition: 'Sellable seconds', disposition: 'Customer credit', status: 'Inspecting', value: 1240 },
  { code: 'RMA-2103', customer: 'Inside', order: 'ADT-4499', received: '3 days ago', reason: 'Print streaks', condition: 'Defective', disposition: 'Reprint at cost', status: 'Approved', value: 480 },
  { code: 'RMA-2102', customer: 'Lemieux Et Cie', order: 'ADT-4487', received: '5 days ago', reason: 'Wrong colorway shipped', condition: 'Resellable', disposition: 'Customer credit + Reship', status: 'Reshipped', value: 920 },
  { code: 'RMA-2101', customer: 'Laura Park Designs', order: 'ADT-4471', received: '1 week ago', reason: 'Damaged in transit', condition: 'Total loss', disposition: 'Carrier claim filed', status: 'Closed', value: 2400 },
  { code: 'RMA-2100', customer: 'Acme Interiors', order: 'ADT-4456', received: '1 week ago', reason: 'Wrong yardage', condition: 'Resellable', disposition: 'Restock + adjust invoice', status: 'Closed', value: 320 },
  { code: 'RMA-2099', customer: 'Inside', order: 'ADT-4445', received: '2 weeks ago', reason: 'Pattern alignment', condition: 'Defective', disposition: 'Reprint at no charge', status: 'Closed', value: 600 },
  { code: 'RMA-2098', customer: 'Fabric Megastore', order: 'ADT-4430', received: '2 weeks ago', reason: 'Color mismatch', condition: 'Sellable seconds', disposition: 'Customer credit', status: 'Closed', value: 540 },
];

const STATUS_COLOR: Record<string, 'gray' | 'blue' | 'green' | 'yellow' | 'red'> = {
  'Inspecting': 'yellow',
  'Approved': 'blue',
  'Reshipped': 'green',
  'Closed': 'gray',
  'Rejected': 'red',
};

export default function ReturnsDashboard() {
  const open = MOCK_RMAS.filter((r) => !['Closed','Rejected'].includes(r.status));
  const closedThisMonth = MOCK_RMAS.filter((r) => r.status === 'Closed').length;
  const openValue = open.reduce((s, r) => s + r.value, 0);
  const carrierClaims = MOCK_RMAS.filter((r) => r.disposition.toLowerCase().includes('carrier')).length;

  // Reason code breakdown
  const reasonCounts: Record<string, number> = {};
  MOCK_RMAS.forEach((r) => { reasonCounts[r.reason] = (reasonCounts[r.reason] ?? 0) + 1; });
  const reasonOrder = Object.entries(reasonCounts).sort((a, b) => b[1] - a[1]);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Returns Dashboard</h1>
          <p className="text-sm text-gray-600 mt-0.5">RMAs in-flight + recent dispositions + reason code patterns.</p>
        </div>
        <Button>+ New RMA</Button>
      </header>

      <div className="grid grid-cols-4 gap-4">
        <Stat label="Open RMAs" value={open.length} accent="yellow" />
        <Stat label="Open value" value={`$${openValue.toFixed(0)}`} />
        <Stat label="Closed this month" value={closedThisMonth} accent="green" />
        <Stat label="Carrier claims" value={carrierClaims} accent={carrierClaims > 0 ? 'red' : 'gray'} />
      </div>

      <div className="grid grid-cols-3 gap-6">
        <Card className="col-span-2">
          <CardHeader title="All RMAs" />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-2.5">RMA #</th>
                  <th className="text-left px-4 py-2.5">Customer</th>
                  <th className="text-left px-4 py-2.5">Order</th>
                  <th className="text-left px-4 py-2.5">Reason</th>
                  <th className="text-left px-4 py-2.5">Condition</th>
                  <th className="text-left px-4 py-2.5">Disposition</th>
                  <th className="text-left px-4 py-2.5">Status</th>
                  <th className="text-left px-4 py-2.5">Value</th>
                </tr>
              </thead>
              <tbody>
                {MOCK_RMAS.map((r) => (
                  <tr key={r.code} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-mono text-xs font-semibold">{r.code}</td>
                    <td className="px-4 py-2.5 text-xs">{r.customer}</td>
                    <td className="px-4 py-2.5 font-mono text-xs">{r.order}</td>
                    <td className="px-4 py-2.5 text-xs">{r.reason}</td>
                    <td className="px-4 py-2.5 text-xs">{r.condition}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-600">{r.disposition}</td>
                    <td className="px-4 py-2.5"><Tag color={STATUS_COLOR[r.status] ?? 'gray'}>{r.status}</Tag></td>
                    <td className="px-4 py-2.5 font-mono text-xs">${r.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <CardHeader title="Reason Code Breakdown" subtitle="Pattern detection for QC + CSR follow-up" />
          <div className="p-5 space-y-2">
            {reasonOrder.map(([reason, count]) => (
              <div key={reason} className="flex items-center justify-between text-sm">
                <span className="text-xs">{reason}</span>
                <div className="flex items-center gap-2">
                  <div className="w-24 h-2 bg-gray-100 rounded">
                    <div className="h-2 bg-navy-700 rounded" style={{ width: `${count * 20}%` }} />
                  </div>
                  <span className="font-mono text-xs w-6 text-right">{count}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader title="RMA workflow" />
        <div className="p-5 text-sm text-gray-600 space-y-2">
          <p>Customer reports issue → CSR creates RMA → Receiving inspects on arrival → Disposition decided (credit, reprint, restock, carrier claim, scrap) → Exception created if reprint is needed at no charge → Accounting credits or invoices accordingly.</p>
          <p>Reason codes feed the <Link href="/dashboards/quality" className="text-navy-700 hover:underline">Quality Dashboard</Link> — high concentrations of one code by customer or by SKU trigger root-cause review.</p>
        </div>
      </Card>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: any; accent?: 'green' | 'yellow' | 'red' | 'gray' }) {
  const cls = accent === 'green' ? 'text-green-700'
    : accent === 'yellow' ? 'text-yellow-700'
    : accent === 'red' ? 'text-helm-red'
    : accent === 'gray' ? 'text-gray-400'
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
