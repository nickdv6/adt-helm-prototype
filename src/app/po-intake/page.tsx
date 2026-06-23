'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Upload, FileText, CheckCircle2, AlertTriangle, XCircle, Loader2, Send, Pencil, Trash2 } from 'lucide-react';
import { Card, CardHeader, Tag, Button } from '@/components/ui';
import { MockSurfaceBanner } from '@/components/mock-surface-banner';

// /po-intake — PDF Purchase Order intake workspace
// Per Nick: '35 different POs yesterday' — needs to be automated. Admin drags a stack of PDF POs,
// Helm parses each per the vendor's PO template (Kravet, Schumacher, Brunschwig, F. Schumacher,
// Lee Jofa, etc.), extracts fields, queues for review, and on confirm pushes through to Order Entry.
// Modeled on the actual Kravet PO #2581754 Nick uploaded (PLANT# + design + treatments + width +
// PC size + greige + fabric + GHL + qty/UoM + ship-to + bill-to + contact + terms).

type POStatus = 'parsing' | 'ready' | 'warnings' | 'failed' | 'confirmed' | 'rejected';

type LineItem = {
  plant_number: string;
  design: string;
  treatments: string;
  width: string;
  pc_size: string;
  greige_code: string;
  fabric: string;
  ghl: string;
  internal_item: string;
  quantity: number;
  unit: string;
  unit_price: number;   // captured at intake; not surfaced on operational pages
  extended: number;     // captured at intake; not surfaced on operational pages
};

type ParsedPO = {
  id: string;
  filename: string;
  size_kb: number;
  vendor_detected: string;
  template_used: string;
  status: POStatus;
  parsed_at: string;
  confidence: 'high' | 'medium' | 'low';
  warnings: string[];
  resulting_order?: string;
  header: {
    po_number: string;
    contact_name: string;
    contact_phone: string;
    contact_email: string;
    ship_to_line1: string;
    ship_to_city: string;
    ship_to_state: string;
    ship_to_zip: string;
    ship_to_country: string;
    bill_to_attn: string;
    bill_to_line1: string;
    bill_to_city: string;
    bill_to_state: string;
    bill_to_zip: string;
    date_of_order: string;
    payment_terms: string;
    freight_terms: string;
    ship_via: string;
    currency: string;
  };
  line_items: LineItem[];
};

// --- Mock today's queue ---
// PO #1 is the actual Kravet 2581754 Nick uploaded, fully parsed.

const QUEUE: ParsedPO[] = [
  {
    id: 'po-2581754',
    filename: 'ADVANCED DIGITAL TEXTILES_PO#_2581754.pdf',
    size_kb: 17.4,
    vendor_detected: 'Kravet',
    template_used: 'Kravet · Standard PO v2',
    status: 'ready',
    parsed_at: '8 min ago',
    confidence: 'high',
    warnings: [],
    header: {
      po_number: '2581754',
      contact_name: 'Donna Tola',
      contact_phone: '516-293-2000 EXT 2260',
      contact_email: 'donna.tola@kravet.com',
      ship_to_line1: '1500 HIGHWAY 29 SOUTH',
      ship_to_city: 'ANDERSON',
      ship_to_state: 'SC',
      ship_to_zip: '29626',
      ship_to_country: 'United States',
      bill_to_attn: 'ACCOUNTS PAYABLE',
      bill_to_line1: '250 CROSSWAYS PARK DRIVE',
      bill_to_city: 'WOODBURY',
      bill_to_state: 'NY',
      bill_to_zip: '11797',
      date_of_order: '2026-06-18',
      payment_terms: 'N30',
      freight_terms: 'Due – EXW',
      ship_via: 'Refer to routing guide',
      currency: 'USD',
    },
    line_items: [
      {
        plant_number: 'P26-1072',
        design: 'SP-BIBURY GREEN',
        treatments: 'INCLUDES SOFTENED',
        width: '54"',
        pc_size: '50YDS',
        greige_code: 'MG-100001',
        fabric: 'NEWPORT COT/LIN',
        ghl: 'MG',
        internal_item: 'SP-BP10999.2.0',
        quantity: 60,
        unit: 'YD',
        unit_price: 9.50,
        extended: 570.00,
      },
    ],
  },
  {
    id: 'po-2581789',
    filename: 'Kravet_PO_2581789.pdf',
    size_kb: 18.1,
    vendor_detected: 'Kravet',
    template_used: 'Kravet · Standard PO v2',
    status: 'warnings',
    parsed_at: '14 min ago',
    confidence: 'medium',
    warnings: [
      'Vendor Item line 1: PLANT# "P26-X-pending" not yet in Design library — Helm will create on confirm',
      'Greige code "MG-100087" matches 2 active greige records — review which is intended',
    ],
    header: {
      po_number: '2581789',
      contact_name: 'Donna Tola',
      contact_phone: '516-293-2000 EXT 2260',
      contact_email: 'donna.tola@kravet.com',
      ship_to_line1: '1500 HIGHWAY 29 SOUTH',
      ship_to_city: 'ANDERSON',
      ship_to_state: 'SC',
      ship_to_zip: '29626',
      ship_to_country: 'United States',
      bill_to_attn: 'ACCOUNTS PAYABLE',
      bill_to_line1: '250 CROSSWAYS PARK DRIVE',
      bill_to_city: 'WOODBURY',
      bill_to_state: 'NY',
      bill_to_zip: '11797',
      date_of_order: '2026-06-18',
      payment_terms: 'N30',
      freight_terms: 'Due – EXW',
      ship_via: 'Refer to routing guide',
      currency: 'USD',
    },
    line_items: [
      {
        plant_number: 'P26-X-pending',
        design: 'SP-WILLOW SAGE',
        treatments: '—',
        width: '54"',
        pc_size: '30YDS',
        greige_code: 'MG-100087',
        fabric: 'NEWPORT COT/LIN',
        ghl: 'MG',
        internal_item: 'SP-BP11042.1.0',
        quantity: 30,
        unit: 'YD',
        unit_price: 9.50,
        extended: 285.00,
      },
    ],
  },
  {
    id: 'po-58221',
    filename: 'Schumacher_PO_58221.pdf',
    size_kb: 22.7,
    vendor_detected: 'Schumacher',
    template_used: 'Schumacher · Standard PO v1',
    status: 'ready',
    parsed_at: '21 min ago',
    confidence: 'high',
    warnings: [],
    header: {
      po_number: '58221',
      contact_name: 'James Patel',
      contact_phone: '212-415-3958',
      contact_email: 'jpatel@fschumacher.com',
      ship_to_line1: '50 WORTH ST',
      ship_to_city: 'NEW YORK',
      ship_to_state: 'NY',
      ship_to_zip: '10013',
      ship_to_country: 'United States',
      bill_to_attn: 'ACCOUNTS PAYABLE',
      bill_to_line1: '50 WORTH ST',
      bill_to_city: 'NEW YORK',
      bill_to_state: 'NY',
      bill_to_zip: '10013',
      date_of_order: '2026-06-18',
      payment_terms: 'N30',
      freight_terms: 'Due – EXW',
      ship_via: 'Customer pickup',
      currency: 'USD',
    },
    line_items: [
      {
        plant_number: 'P26-1071',
        design: 'PALM IVORY',
        treatments: '—',
        width: '54"',
        pc_size: '20YDS',
        greige_code: 'MG-100022',
        fabric: 'BELGIAN LINEN',
        ghl: 'BL',
        internal_item: '177820.2',
        quantity: 20,
        unit: 'YD',
        unit_price: 11.25,
        extended: 225.00,
      },
    ],
  },
  {
    id: 'po-bf-9921',
    filename: 'Brunschwig_PO_9921.pdf',
    size_kb: 14.2,
    vendor_detected: 'Brunschwig & Fils',
    template_used: '(unrecognized — fallback OCR)',
    status: 'failed',
    parsed_at: '34 min ago',
    confidence: 'low',
    warnings: [
      'PO template not recognized — OCR-only fallback used',
      'Line item parse confidence too low — CSR review required',
      'PLANT# and design could not be confidently identified',
    ],
    header: {
      po_number: '9921',
      contact_name: '—',
      contact_phone: '—',
      contact_email: '—',
      ship_to_line1: '979 THIRD AVENUE',
      ship_to_city: 'NEW YORK',
      ship_to_state: 'NY',
      ship_to_zip: '10022',
      ship_to_country: 'United States',
      bill_to_attn: '—',
      bill_to_line1: '979 THIRD AVENUE',
      bill_to_city: 'NEW YORK',
      bill_to_state: 'NY',
      bill_to_zip: '10022',
      date_of_order: '2026-06-18',
      payment_terms: '—',
      freight_terms: '—',
      ship_via: '—',
      currency: 'USD',
    },
    line_items: [],
  },
  {
    id: 'po-2581701',
    filename: 'Kravet_PO_2581701.pdf',
    size_kb: 16.8,
    vendor_detected: 'Kravet',
    template_used: 'Kravet · Standard PO v2',
    status: 'confirmed',
    parsed_at: '2h ago',
    confidence: 'high',
    warnings: [],
    resulting_order: 'O-44315',
    header: {
      po_number: '2581701',
      contact_name: 'Donna Tola',
      contact_phone: '516-293-2000 EXT 2260',
      contact_email: 'donna.tola@kravet.com',
      ship_to_line1: '1500 HIGHWAY 29 SOUTH',
      ship_to_city: 'ANDERSON',
      ship_to_state: 'SC',
      ship_to_zip: '29626',
      ship_to_country: 'United States',
      bill_to_attn: 'ACCOUNTS PAYABLE',
      bill_to_line1: '250 CROSSWAYS PARK DRIVE',
      bill_to_city: 'WOODBURY',
      bill_to_state: 'NY',
      bill_to_zip: '11797',
      date_of_order: '2026-06-17',
      payment_terms: 'N30',
      freight_terms: 'Due – EXW',
      ship_via: 'Refer to routing guide',
      currency: 'USD',
    },
    line_items: [
      {
        plant_number: 'P26-1063',
        design: 'SP-COASTAL BLUE',
        treatments: 'INCLUDES SOFTENED',
        width: '54"',
        pc_size: '50YDS',
        greige_code: 'MG-100015',
        fabric: 'NEWPORT COT/LIN',
        ghl: 'MG',
        internal_item: 'SP-BP10874.3.0',
        quantity: 100,
        unit: 'YD',
        unit_price: 9.50,
        extended: 950.00,
      },
    ],
  },
  {
    id: 'po-2581812',
    filename: 'Kravet_PO_2581812.pdf',
    size_kb: 17.9,
    vendor_detected: 'Kravet',
    template_used: 'Kravet · Standard PO v2',
    status: 'parsing',
    parsed_at: 'just now',
    confidence: 'high',
    warnings: [],
    header: {
      po_number: '—',
      contact_name: '—',
      contact_phone: '—',
      contact_email: '—',
      ship_to_line1: '—',
      ship_to_city: '—',
      ship_to_state: '—',
      ship_to_zip: '—',
      ship_to_country: '—',
      bill_to_attn: '—',
      bill_to_line1: '—',
      bill_to_city: '—',
      bill_to_state: '—',
      bill_to_zip: '—',
      date_of_order: '—',
      payment_terms: '—',
      freight_terms: '—',
      ship_via: '—',
      currency: 'USD',
    },
    line_items: [],
  },
];

export default function POIntake() {
  const [selectedId, setSelectedId] = useState<string>('po-2581754');
  const selected = QUEUE.find((p) => p.id === selectedId) ?? QUEUE[0];

  const counts = {
    parsing: QUEUE.filter((p) => p.status === 'parsing').length,
    ready: QUEUE.filter((p) => p.status === 'ready').length,
    warnings: QUEUE.filter((p) => p.status === 'warnings').length,
    failed: QUEUE.filter((p) => p.status === 'failed').length,
    confirmed: QUEUE.filter((p) => p.status === 'confirmed').length,
  };

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      <MockSurfaceBanner reason="Only the Kravet 2581754 demo PO is real-parsed. Queue rows are mock stubs; OCR pipeline + order-creation handoff are not wired. Production needs PDF OCR + auto-create-order trigger on Confirm." />
      <header>
        <h1 className="text-2xl font-bold text-navy-900">PDF PO Intake</h1>
        <p className="text-sm text-gray-500 mt-1">
          Drop PDF purchase orders to auto-extract and queue for Order Entry · vendor PO templates configured per customer (Kravet, Schumacher, Brunschwig, Lee Jofa, etc.) · failed parses route to CSR review.
        </p>
      </header>

      {/* Drop zone + recent activity */}
      <div className="grid grid-cols-3 gap-5">
        <div className="col-span-2">
          <div className="border-2 border-dashed border-navy-300 bg-navy-50/50 rounded-lg p-8 text-center">
            <Upload className="w-10 h-10 mx-auto text-navy-700 mb-3" />
            <div className="text-base font-semibold text-navy-900 mb-1">Drop one or more vendor PDF POs here</div>
            <div className="text-xs text-gray-600 mb-3">Helm auto-detects the vendor and applies the matching parse template · multi-file upload supported (yesterday: 35 POs processed)</div>
            <div className="flex items-center justify-center gap-2">
              <Button size="sm"><Upload className="w-3.5 h-3.5 mr-1.5" />Browse files</Button>
              <Link href="/customer-configs" className="text-xs text-navy-700 hover:underline">Configure a new vendor template →</Link>
            </div>
          </div>
        </div>
        <Card>
          <CardHeader title="Recent activity" />
          <div className="p-4 space-y-2 text-xs">
            <div className="flex items-center justify-between"><span className="text-gray-600">Yesterday processed</span><strong className="font-mono">35</strong></div>
            <div className="flex items-center justify-between"><span className="text-gray-600">Auto-confirmed</span><strong className="font-mono text-green-700">33</strong></div>
            <div className="flex items-center justify-between"><span className="text-gray-600">Sent to CSR review</span><strong className="font-mono text-yellow-700">2</strong></div>
            <div className="flex items-center justify-between"><span className="text-gray-600">Avg parse time</span><strong className="font-mono">3.2s</strong></div>
            <div className="border-t border-gray-100 pt-2 flex items-center justify-between"><span className="text-gray-600">Last 30 days</span><strong className="font-mono">782 POs</strong></div>
          </div>
        </Card>
      </div>

      {/* Status stats */}
      <div className="grid grid-cols-5 gap-3">
        <Stat label="Parsing" value={counts.parsing} accent="blue" icon={<Loader2 className="w-3.5 h-3.5 animate-spin" />} />
        <Stat label="Ready for Confirm" value={counts.ready} accent="green" icon={<CheckCircle2 className="w-3.5 h-3.5" />} />
        <Stat label="With Warnings" value={counts.warnings} accent="yellow" icon={<AlertTriangle className="w-3.5 h-3.5" />} />
        <Stat label="Failed / CSR Review" value={counts.failed} accent="red" icon={<XCircle className="w-3.5 h-3.5" />} />
        <Stat label="Confirmed Today" value={counts.confirmed} icon={<Send className="w-3.5 h-3.5" />} />
      </div>

      {/* Queue + Detail */}
      <div className="grid grid-cols-3 gap-5">
        {/* Queue list */}
        <div>
          <Card>
            <CardHeader title="Today's Queue" subtitle={`${QUEUE.length} POs`} />
            <div className="divide-y divide-gray-100 max-h-[700px] overflow-y-auto">
              {QUEUE.map((po) => (
                <QueueRow key={po.id} po={po} selected={po.id === selectedId} onClick={() => setSelectedId(po.id)} />
              ))}
            </div>
          </Card>
        </div>

        {/* Detail */}
        <div className="col-span-2 space-y-5">
          <PODetail po={selected} />
        </div>
      </div>
    </div>
  );
}

function QueueRow({ po, selected, onClick }: { po: ParsedPO; selected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${selected ? 'bg-navy-50 border-l-2 border-navy-700' : ''}`}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="min-w-0 flex-1">
          <div className="font-mono text-xs font-semibold text-navy-700 truncate">PO #{po.header.po_number}</div>
          <div className="text-[11px] text-gray-500 truncate">{po.vendor_detected}</div>
        </div>
        <StatusTag status={po.status} />
      </div>
      <div className="text-[11px] text-gray-500 truncate flex items-center gap-1.5">
        <FileText className="w-3 h-3 flex-shrink-0" />
        <span className="truncate">{po.filename}</span>
      </div>
      <div className="text-[11px] text-gray-400 mt-1">{po.parsed_at}{po.resulting_order && <> · → <Link href="/orders/1" onClick={(e) => e.stopPropagation()} className="text-navy-700 hover:underline">{po.resulting_order}</Link></>}</div>
    </button>
  );
}

function StatusTag({ status }: { status: POStatus }) {
  switch (status) {
    case 'parsing':   return <Tag color="blue">Parsing…</Tag>;
    case 'ready':     return <Tag color="green">Ready</Tag>;
    case 'warnings':  return <Tag color="yellow">Warnings</Tag>;
    case 'failed':    return <Tag color="red">CSR review</Tag>;
    case 'confirmed': return <Tag color="gray">Confirmed</Tag>;
    case 'rejected':  return <Tag color="gray">Rejected</Tag>;
  }
}

function PODetail({ po }: { po: ParsedPO }) {
  if (po.status === 'parsing') {
    return (
      <Card>
        <div className="p-12 text-center">
          <Loader2 className="w-10 h-10 mx-auto text-navy-700 animate-spin mb-3" />
          <div className="text-base font-semibold text-navy-900">Parsing {po.filename}…</div>
          <div className="text-xs text-gray-500 mt-1">Vendor detected: {po.vendor_detected} · Template: {po.template_used}</div>
        </div>
      </Card>
    );
  }

  return (
    <>
      {/* Top: header + actions */}
      <Card>
        <div className="px-5 py-4 border-b border-gray-200 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-base font-bold text-navy-900 font-mono">PO #{po.header.po_number}</h2>
              <StatusTag status={po.status} />
              <Tag color={po.confidence === 'high' ? 'green' : po.confidence === 'medium' ? 'yellow' : 'red'}>{po.confidence} confidence</Tag>
            </div>
            <div className="text-xs text-gray-500">{po.vendor_detected} · {po.template_used} · parsed {po.parsed_at}</div>
          </div>
          <ActionBar po={po} />
        </div>

        {po.warnings.length > 0 && (
          <div className="px-5 py-3 bg-yellow-50 border-b border-yellow-200">
            <div className="text-xs font-semibold uppercase tracking-wider text-yellow-900 mb-1.5 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" /> Parse Warnings ({po.warnings.length})
            </div>
            <ul className="text-xs text-yellow-900 space-y-1">
              {po.warnings.map((w, i) => <li key={i}>· {w}</li>)}
            </ul>
          </div>
        )}

        <div className="grid grid-cols-2 gap-0 border-b border-gray-200">
          {/* Left: PDF preview placeholder */}
          <div className="border-r border-gray-200 p-5">
            <div className="text-xs uppercase tracking-wider font-semibold text-gray-700 mb-2">Source PDF</div>
            <div className="border border-gray-300 rounded bg-gray-50 p-4 h-[500px] overflow-hidden relative">
              <div className="text-[10px] text-gray-400 mb-2 truncate">{po.filename} · {po.size_kb} KB</div>
              {/* Faux PDF preview */}
              <div className="bg-white border border-gray-200 rounded shadow-sm p-4 text-[10px] leading-tight font-mono">
                <div className="flex items-start justify-between mb-3">
                  <div className="font-bold">kravet</div>
                  <div className="text-right">
                    <div className="font-bold">PURCHASE ORDER</div>
                    <div>Purchase Order Number</div>
                    <div className="font-bold text-sm">{po.header.po_number}</div>
                  </div>
                </div>
                <div className="mb-2">
                  <div className="text-gray-500">Contact:</div>
                  <div>{po.header.contact_name}</div>
                  <div>P- {po.header.contact_phone}</div>
                  <div>E- {po.header.contact_email}</div>
                </div>
                <div className="mb-2">
                  <div className="text-gray-500">Vendor:</div>
                  <div>ADVANCED DIGITAL TEXTILES, LLC</div>
                  <div>600 BROOME STREET</div>
                  <div>MONROE, NC 28110</div>
                </div>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <div>
                    <div className="text-gray-500">Ship To:</div>
                    <div>{po.header.ship_to_line1}</div>
                    <div>{po.header.ship_to_city}</div>
                    <div>{po.header.ship_to_state} {po.header.ship_to_zip}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">Bill To:</div>
                    <div>ATTN: {po.header.bill_to_attn}</div>
                    <div>{po.header.bill_to_line1}</div>
                    <div>{po.header.bill_to_city}</div>
                    <div>{po.header.bill_to_state} {po.header.bill_to_zip}</div>
                  </div>
                </div>
                <div className="border-t border-gray-300 pt-2 mb-2 grid grid-cols-3 gap-2">
                  <div><div className="text-gray-500">DATE OF ORDER</div><div>{po.header.date_of_order}</div></div>
                  <div><div className="text-gray-500">PAYMENT</div><div>{po.header.payment_terms}</div></div>
                  <div><div className="text-gray-500">FREIGHT</div><div>{po.header.freight_terms}</div></div>
                </div>
                {po.line_items.length > 0 && (
                  <div className="border border-gray-300 rounded p-2">
                    <div className="grid grid-cols-12 text-[9px] gap-1 font-semibold border-b border-gray-200 pb-1 mb-1">
                      <div className="col-span-6">VENDOR ITEM</div>
                      <div className="col-span-2">QTY</div>
                      <div className="col-span-2">UNIT</div>
                      <div className="col-span-2 text-right">EXT</div>
                    </div>
                    {po.line_items.map((li, i) => (
                      <div key={i} className="grid grid-cols-12 text-[9px] gap-1 mb-1">
                        <div className="col-span-6">
                          <div>{li.plant_number} {li.design}</div>
                          {li.treatments !== '—' && <div>{li.treatments}</div>}
                          <div>WIDTH: {li.width} PC SIZE: {li.pc_size}</div>
                          <div>Greige - {li.greige_code} {li.fabric} GHL# {li.ghl}</div>
                        </div>
                        <div className="col-span-2">{li.quantity}</div>
                        <div className="col-span-2">{li.unit}</div>
                        <div className="col-span-2 text-right">{li.extended.toFixed(2)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right: Extracted fields */}
          <div className="p-5">
            <div className="text-xs uppercase tracking-wider font-semibold text-gray-700 mb-2">Extracted Fields → Helm Order</div>
            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
              <FieldGroup title="Order header">
                <KV label="PO #" value={po.header.po_number} mono />
                <KV label="Customer (detected)" value={po.vendor_detected} />
                <KV label="Date of order" value={po.header.date_of_order} />
                <KV label="Payment terms" value={po.header.payment_terms} />
                <KV label="Freight terms" value={po.header.freight_terms} />
                <KV label="Ship via" value={po.header.ship_via} />
              </FieldGroup>

              <FieldGroup title="Contact">
                <KV label="Name" value={po.header.contact_name} />
                <KV label="Phone" value={po.header.contact_phone} mono />
                <KV label="Email" value={po.header.contact_email} mono />
              </FieldGroup>

              <FieldGroup title="Ship To">
                <KV label="Address" value={po.header.ship_to_line1} />
                <KV label="City / State / Zip" value={`${po.header.ship_to_city}, ${po.header.ship_to_state} ${po.header.ship_to_zip}`} />
                <KV label="Country" value={po.header.ship_to_country} />
              </FieldGroup>

              <FieldGroup title="Bill To">
                <KV label="Attn" value={po.header.bill_to_attn} />
                <KV label="Address" value={po.header.bill_to_line1} />
                <KV label="City / State / Zip" value={`${po.header.bill_to_city}, ${po.header.bill_to_state} ${po.header.bill_to_zip}`} />
              </FieldGroup>
            </div>
          </div>
        </div>

        {/* Line items table */}
        <div className="p-5">
          <div className="text-xs uppercase tracking-wider font-semibold text-gray-700 mb-2">Line Items → Helm Print Requests</div>
          {po.line_items.length === 0 ? (
            <div className="border border-gray-200 rounded p-6 text-center text-xs text-gray-400 italic">No line items extracted. CSR review required for manual entry.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-gray-500 uppercase tracking-wider border-b border-gray-200 bg-gray-50">
                  <tr>
                    <th className="text-left px-3 py-2">PLANT#</th>
                    <th className="text-left px-3 py-2">Design</th>
                    <th className="text-left px-3 py-2">Treatments</th>
                    <th className="text-left px-3 py-2">Width</th>
                    <th className="text-left px-3 py-2">PC size</th>
                    <th className="text-left px-3 py-2">Greige</th>
                    <th className="text-left px-3 py-2">Fabric</th>
                    <th className="text-left px-3 py-2">GHL</th>
                    <th className="text-left px-3 py-2">Internal item</th>
                    <th className="text-right px-3 py-2">Qty</th>
                    <th className="text-left px-3 py-2">UoM</th>
                  </tr>
                </thead>
                <tbody>
                  {po.line_items.map((li, i) => (
                    <tr key={i} className="border-t border-gray-100">
                      <td className="px-3 py-1.5 font-mono font-semibold text-navy-700">{li.plant_number}</td>
                      <td className="px-3 py-1.5">{li.design}</td>
                      <td className="px-3 py-1.5 text-gray-600">{li.treatments}</td>
                      <td className="px-3 py-1.5 font-mono">{li.width}</td>
                      <td className="px-3 py-1.5 font-mono">{li.pc_size}</td>
                      <td className="px-3 py-1.5 font-mono">{li.greige_code}</td>
                      <td className="px-3 py-1.5">{li.fabric}</td>
                      <td className="px-3 py-1.5">{li.ghl}</td>
                      <td className="px-3 py-1.5 font-mono">{li.internal_item}</td>
                      <td className="px-3 py-1.5 text-right font-mono">{li.quantity}</td>
                      <td className="px-3 py-1.5">{li.unit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="text-[11px] text-gray-500 italic mt-2">
                Pricing data (Unit Price · Extended · Currency) is captured at intake for the accounting hand-off but is not surfaced on the operational PR or Order Dashboard pages.
              </div>
            </div>
          )}
        </div>

        {po.resulting_order && (
          <div className="px-5 py-3 border-t border-gray-200 bg-green-50 text-xs flex items-center gap-2 text-green-900">
            <CheckCircle2 className="w-4 h-4" />
            Confirmed and converted to <Link href="/orders/1" className="font-mono font-semibold hover:underline">{po.resulting_order}</Link>. Print Requests generated and routed downstream.
          </div>
        )}
      </Card>
    </>
  );
}

function ActionBar({ po }: { po: ParsedPO }) {
  if (po.status === 'confirmed' || po.status === 'rejected') {
    return <Button variant="secondary" size="sm">View Order →</Button>;
  }
  if (po.status === 'failed') {
    return (
      <div className="flex gap-2">
        <Button variant="secondary" size="sm"><Pencil className="w-3.5 h-3.5 mr-1" />Manually Enter</Button>
        <Button variant="ghost" size="sm"><Trash2 className="w-3.5 h-3.5 mr-1 text-red-600" /><span className="text-red-600">Reject</span></Button>
      </div>
    );
  }
  return (
    <div className="flex gap-2">
      <Button variant="ghost" size="sm"><Trash2 className="w-3.5 h-3.5 mr-1 text-red-600" /><span className="text-red-600">Reject</span></Button>
      <Button variant="secondary" size="sm"><Pencil className="w-3.5 h-3.5 mr-1" />Edit Before Confirm</Button>
      <Button size="sm"><Send className="w-3.5 h-3.5 mr-1" />Confirm & Create Order</Button>
    </div>
  );
}

function FieldGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-gray-200 rounded p-3 bg-gray-50">
      <div className="text-[10px] uppercase tracking-wider font-semibold text-navy-700 mb-1.5">{title}</div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function KV({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="grid grid-cols-2 gap-2 text-xs">
      <div className="text-gray-500">{label}</div>
      <div className={mono ? 'font-mono' : ''}>{value || '—'}</div>
    </div>
  );
}

function Stat({ label, value, accent, icon }: { label: string; value: number; accent?: 'yellow' | 'red' | 'green' | 'blue'; icon?: React.ReactNode }) {
  const bar = {
    yellow: 'bg-helm-yellow', red: 'bg-helm-red', green: 'bg-helm-green', blue: 'bg-helm-blue',
  }[accent || ''] || 'bg-gray-200';
  return (
    <Card>
      <div className="p-3 flex items-center gap-3">
        <div className={`w-1 h-10 rounded ${bar}`} />
        <div className="flex-1">
          <div className="text-2xl font-bold text-navy-900 leading-tight">{value}</div>
          <div className="text-[10px] text-gray-500 uppercase tracking-wider flex items-center gap-1">{icon}{label}</div>
        </div>
      </div>
    </Card>
  );
}
