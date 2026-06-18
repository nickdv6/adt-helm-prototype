import Link from 'next/link';
import { Card, CardHeader, Tag, Button } from '@/components/ui';

// /fulfillment-requests — C22 Fulfillment Request workflow
// Per WHY findings (Order Entry): ADT offers storage + fulfillment for some customers
// (Shopify resellers, customers running e-commerce). Production is made and stored at ADT,
// then PULLED for fulfillment as customer requests. Helm formally models FRs as distinct
// from Production Orders.
//
// Three intake channels:
//   - Customer-forwarded Shopify packing-list email (most common)
//   - Customer's Shopify order details (less structured)
//   - Plain email request
//
// Three label-creation modes (customer profile carries label_mode setting):
//   A — ADT logs into customer's Shopify with stored credentials
//   B — ADT generates label via customer's carrier account
//   C — Customer supplies pre-made label

type FR = {
  id: string;
  customer: string;
  customer_href: string;
  end_recipient: string;
  end_recipient_location: string;
  source: 'Shopify packing list (email)' | 'Shopify order' | 'Plain email request';
  label_mode: 'A' | 'B' | 'C';
  label_mode_note: string;
  items: { sku: string; product: string; qty: number; pulled: number }[];
  status: 'Received' | 'Picking' | 'Picked' | 'Packed' | 'Labeled' | 'Shipped' | 'Hold';
  opened: string;
  ship_target: string;
  tracking?: string;
  flags: string[];
  notes?: string;
};

const FRS: FR[] = [
  {
    id: 'FR-3142',
    customer: 'Inside / Havenly',
    customer_href: '/customers/1',
    end_recipient: 'Emily Park',
    end_recipient_location: 'Columbus, OH',
    source: 'Shopify packing list (email)',
    label_mode: 'A',
    label_mode_note: 'ADT logs into Inside\'s Shopify (stored credentials) to print label',
    items: [
      { sku: 'PLW-CYP-18x18', product: 'Cypress Pillow 18×18', qty: 2, pulled: 0 },
    ],
    status: 'Picking',
    opened: '14m ago',
    ship_target: 'Today',
    flags: ['Blind ship'],
    notes: 'Picker scanning Bundle Child QRs from C23 stored area.',
  },
  {
    id: 'FR-3141',
    customer: 'House of MBR',
    customer_href: '/customers/1',
    end_recipient: 'David Kim',
    end_recipient_location: 'Seattle, WA',
    source: 'Plain email request',
    label_mode: 'C',
    label_mode_note: 'Customer attaches their own pre-paid label; Helm matches it to FR.',
    items: [
      { sku: 'DRP-LIN-84', product: 'Linen Drape 84"', qty: 1, pulled: 1 },
    ],
    status: 'Packed',
    opened: '52m ago',
    ship_target: 'Today',
    flags: ['Customer label on file'],
  },
  {
    id: 'FR-3140',
    customer: 'St. Frank',
    customer_href: '/customers/1',
    end_recipient: 'Jordan Lee',
    end_recipient_location: 'Brooklyn, NY',
    source: 'Shopify order',
    label_mode: 'B',
    label_mode_note: 'ADT prints via customer\'s UPS account (acct #1A8742-XXX)',
    items: [
      { sku: 'PLW-IND-20x20', product: 'Indigo Pillow 20×20', qty: 4, pulled: 4 },
      { sku: 'PLW-SAGE-14x14', product: 'Sage Pillow 14×14', qty: 2, pulled: 2 },
    ],
    status: 'Labeled',
    opened: '1h ago',
    ship_target: 'Today',
    tracking: '1Z8X2HJ7-038',
    flags: ['3rd-party billed', 'Blind ship'],
  },
  {
    id: 'FR-3139',
    customer: 'Lemieux Et Cie',
    customer_href: '/customers/1',
    end_recipient: 'Margaret O\'Brien',
    end_recipient_location: 'Boston, MA',
    source: 'Shopify packing list (email)',
    label_mode: 'A',
    label_mode_note: 'ADT logs into Lemieux\'s Shopify',
    items: [
      { sku: 'TBL-TXT-72', product: 'Textured Tablecloth 72"', qty: 1, pulled: 0 },
    ],
    status: 'Hold',
    opened: '2h ago',
    ship_target: 'Tomorrow',
    flags: ['Inventory short — 0 in stored'],
    notes: 'Stored inventory count = 0; exception EX-2413 raised for customer-stored drift reconciliation.',
  },
  {
    id: 'FR-3138',
    customer: 'Laura Park Designs',
    customer_href: '/customers/1',
    end_recipient: 'Sarah Chen',
    end_recipient_location: 'Austin, TX',
    source: 'Shopify packing list (email)',
    label_mode: 'A',
    label_mode_note: 'ADT logs into Laura Park\'s Shopify',
    items: [
      { sku: 'PLW-MAR-22x22', product: 'Marigold Pillow 22×22', qty: 3, pulled: 3 },
    ],
    status: 'Shipped',
    opened: '4h ago',
    ship_target: 'Today',
    tracking: '9405-XXXX-1245',
    flags: ['Blind ship'],
  },
  {
    id: 'FR-3137',
    customer: 'Inside / Havenly',
    customer_href: '/customers/1',
    end_recipient: 'Aiden Murphy',
    end_recipient_location: 'San Diego, CA',
    source: 'Shopify packing list (email)',
    label_mode: 'A',
    label_mode_note: 'ADT logs into Inside\'s Shopify',
    items: [
      { sku: 'PLW-CYP-18x18', product: 'Cypress Pillow 18×18', qty: 1, pulled: 1 },
    ],
    status: 'Shipped',
    opened: '6h ago',
    ship_target: 'Yesterday',
    tracking: '1Z8X2HJ7-002',
    flags: ['Blind ship'],
  },
];

const STATUS_FILTERS = ['Received', 'Picking', 'Packed', 'Labeled', 'Shipped', 'Hold'] as const;

export default function FulfillmentRequests({ searchParams }: { searchParams: { status?: string } }) {
  const filter = searchParams?.status ?? 'all';
  const filtered = filter === 'all' ? FRS : FRS.filter((f) => f.status === filter);

  const counts = {
    all: FRS.length,
    active: FRS.filter((f) => !['Shipped'].includes(f.status)).length,
    hold: FRS.filter((f) => f.status === 'Hold').length,
    today: FRS.filter((f) => f.ship_target === 'Today' && f.status !== 'Shipped').length,
    shipped: FRS.filter((f) => f.status === 'Shipped').length,
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-navy-900">Fulfillment Requests (C22)</h1>
        <p className="text-sm text-gray-500 mt-1">
          Distinct from Production Orders · pulls from customer-stored inventory · 3 intake channels · 3 label modes (A/B/C)
        </p>
      </header>

      <div className="grid grid-cols-5 gap-4">
        <Stat label="Total" value={counts.all} />
        <Stat label="Active" value={counts.active} accent="blue" />
        <Stat label="Shipping Today" value={counts.today} accent="yellow" />
        <Stat label="On Hold" value={counts.hold} accent="red" />
        <Stat label="Shipped" value={counts.shipped} accent="green" />
      </div>

      <div className="flex flex-wrap gap-2">
        <FilterChip label="All" status="all" current={filter} count={counts.all} />
        {STATUS_FILTERS.map((s) => {
          const c = FRS.filter((f) => f.status === s).length;
          return <FilterChip key={s} label={s} status={s} current={filter} count={c} accent={s === 'Hold' ? 'red' : undefined} />;
        })}
      </div>

      <Card>
        <CardHeader
          title="Fulfillment Request Queue"
          subtitle="Sorted by Hold first, then Active, then most recent · click a row to open detail + picker UI"
        />
        <div className="divide-y divide-gray-100">
          {filtered.length === 0 && <div className="text-center py-12 text-gray-400">No fulfillment requests match this filter.</div>}
          {filtered.map((fr) => (
            <FRRow key={fr.id} fr={fr} />
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader title="Picker UI Preview" subtitle="What the Inventory operator sees at the customer-stored area" />
        <div className="p-5 space-y-4 text-sm">
          <div className="bg-navy-50 border-l-4 border-navy-500 p-4 rounded-r">
            <div className="text-xs uppercase tracking-wider text-navy-700 font-semibold mb-1">Active pull: FR-3142 · Inside / Havenly</div>
            <div className="font-mono text-lg">2 × Cypress Pillow 18×18 → Emily Park (Columbus, OH)</div>
            <div className="text-xs text-gray-600 mt-1">Blind ship · Label mode A</div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="border border-gray-200 rounded p-4">
              <div className="text-xs uppercase tracking-wider text-gray-500 mb-2">Scan Bundle Child QR</div>
              <div className="flex items-center gap-2 mb-3">
                <input type="text" disabled placeholder="Awaiting scan…" className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm font-mono bg-gray-50" />
                <Button variant="secondary" size="sm">Skip</Button>
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-mono">B-12091-A</span>
                  <Tag color="green">Matched · decrement stored</Tag>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-gray-400">B-12091-B</span>
                  <Tag color="gray">Awaiting</Tag>
                </div>
              </div>
            </div>
            <div className="border border-gray-200 rounded p-4">
              <div className="text-xs uppercase tracking-wider text-gray-500 mb-2">If scan does not match…</div>
              <div className="text-xs space-y-1.5 text-gray-700">
                <div className="flex gap-2">
                  <Tag color="red">BLOCK</Tag>
                  <span>Helm blocks the action with a clear error</span>
                </div>
                <div className="flex gap-2">
                  <Tag color="yellow">Reason</Tag>
                  <span>Operator selects: wrong SKU, wrong customer, damaged, missing</span>
                </div>
                <div className="flex gap-2">
                  <Tag color="purple">Override</Tag>
                  <span>Supervisor can force-allow with audit + reason</span>
                </div>
                <div className="flex gap-2">
                  <Tag color="blue">Reroute</Tag>
                  <span>If short, Helm raises a Customer-Stored Inventory Drift exception (C13)</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

function FRRow({ fr }: { fr: FR }) {
  const totalQty = fr.items.reduce((s, i) => s + i.qty, 0);
  const pulled = fr.items.reduce((s, i) => s + i.pulled, 0);
  const pct = totalQty > 0 ? Math.round((pulled / totalQty) * 100) : 0;

  return (
    <div className="px-5 py-4 hover:bg-gray-50 transition-colors">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono font-semibold text-navy-700">{fr.id}</span>
            <StatusTag status={fr.status} />
            {fr.flags.map((f) => <Tag key={f} color={f.includes('short') ? 'red' : f === 'Blind ship' ? 'green' : 'gray'}>{f}</Tag>)}
          </div>
          <div className="text-sm">
            <Link href={fr.customer_href} className="text-navy-700 hover:underline font-semibold">{fr.customer}</Link>
            <span className="text-gray-400 mx-2">→</span>
            <span>{fr.end_recipient}</span>
            <span className="text-gray-500 ml-1.5">({fr.end_recipient_location})</span>
          </div>
          <div className="mt-2 text-xs text-gray-600 space-y-0.5">
            <div><span className="text-gray-500">Source:</span> {fr.source}</div>
            <div className="flex items-center gap-1.5">
              <span className="text-gray-500">Label mode:</span>
              <Tag color={fr.label_mode === 'A' ? 'blue' : fr.label_mode === 'B' ? 'yellow' : 'purple'}>Mode {fr.label_mode}</Tag>
              <span className="text-gray-500">{fr.label_mode_note}</span>
            </div>
            {fr.tracking && (
              <div><span className="text-gray-500">Tracking:</span> <span className="font-mono">{fr.tracking}</span></div>
            )}
            {fr.notes && (
              <div className="italic mt-1 text-gray-500">{fr.notes}</div>
            )}
          </div>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            {fr.items.map((it, i) => (
              <div key={i} className="border border-gray-200 rounded px-2 py-1 bg-white flex items-center gap-2">
                <span className="font-mono text-[10px] text-gray-500">{it.sku}</span>
                <span>{it.qty}× {it.product}</span>
                {it.pulled === it.qty
                  ? <Tag color="green">Pulled</Tag>
                  : it.pulled > 0
                  ? <Tag color="yellow">{it.pulled}/{it.qty}</Tag>
                  : <Tag color="gray">0/{it.qty}</Tag>
                }
              </div>
            ))}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[11px] uppercase tracking-wider text-gray-500">Opened</div>
          <div className="text-xs">{fr.opened}</div>
          <div className="text-[11px] uppercase tracking-wider text-gray-500 mt-2">Ship target</div>
          <div className="text-xs font-semibold">{fr.ship_target}</div>
          <div className="mt-3">
            <div className="text-[11px] text-gray-500 mb-1">{pulled}/{totalQty} pulled</div>
            <div className="w-32 h-1.5 bg-gray-200 rounded">
              <div className="h-1.5 bg-navy-700 rounded" style={{ width: `${pct}%` }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: 'yellow' | 'red' | 'green' | 'blue' }) {
  const bar = {
    yellow: 'bg-helm-yellow', red: 'bg-helm-red', green: 'bg-helm-green', blue: 'bg-helm-blue',
  }[accent || ''] || 'bg-gray-200';
  return (
    <Card>
      <div className="p-4 flex items-center gap-3">
        <div className={`w-1 h-10 rounded ${bar}`} />
        <div>
          <div className="text-2xl font-bold text-navy-900 leading-tight">{value}</div>
          <div className="text-[11px] text-gray-500 uppercase tracking-wider mt-0.5">{label}</div>
        </div>
      </div>
    </Card>
  );
}

function FilterChip({ label, status, current, count, accent }: { label: string; status: string; current: string; count: number; accent?: 'red' }) {
  const isActive = current === status;
  const cls = accent === 'red' && count > 0 && !isActive
    ? 'border-red-300 bg-red-50 text-red-800'
    : isActive
    ? 'bg-navy-700 text-white border-navy-700'
    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50';
  return (
    <Link href={`/fulfillment-requests?status=${status}`} className={`px-3 py-1.5 text-xs font-semibold rounded-full border ${cls}`}>
      {label} <span className="ml-1 opacity-70">({count})</span>
    </Link>
  );
}

function StatusTag({ status }: { status: FR['status'] }) {
  const color = status === 'Hold' ? 'red'
    : status === 'Shipped' ? 'green'
    : status === 'Picking' ? 'blue'
    : status === 'Packed' || status === 'Labeled' ? 'purple'
    : 'yellow';
  return <Tag color={color}>{status}</Tag>;
}
