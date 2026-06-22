// /fabrics/[id] — Fabric Detail page. Shows the full spec set + usage stats
// (which PRs use this fabric, which SKUs are linked) + a Tech Sheet button
// that opens the same branded PDF preview used on /fabrics/new.
//
// The current DB schema only persists a minimal record (name, fiber_content,
// weight, width_inches). Extended fields (HTS codes, NFPA, Wyzenbeek, etc.)
// are derived for display purposes — a deterministic mock based on the fabric
// id and fiber type so the same fabric always shows the same numbers. In
// production these come from an extended fabric_specs sub-table.
import Link from 'next/link';
import { getDb } from '@/lib/db';
import { Card, CardHeader, Tag, StatusPill, Button } from '@/components/ui';
import { notFound } from 'next/navigation';
import { FabricDetailClient } from './detail-client';
import type { FabricSnapshot } from '@/components/fabric-tech-sheet';

export const dynamic = 'force-dynamic';

// Deterministic mock generator — same fabric id → same extended spec values
function mockSpecs(id: number, name: string, fiber: string | null, width: number | null): Partial<FabricSnapshot> {
  const f = (fiber ?? '').toLowerCase();
  const w = width ?? 56;
  const seed = (id * 2654435761) >>> 0;  // Knuth hash for deterministic variance
  const pick = <T,>(arr: T[]) => arr[seed % arr.length];

  // Composition derived from fiber_content text
  let content1 = 'Polyester', pct1 = '100', content2 = '', pct2 = '', content3 = '', pct3 = '';
  if (f.includes('cotton') && f.includes('linen')) { content1 = 'Cotton'; pct1 = '60'; content2 = 'Linen'; pct2 = '40'; }
  else if (f.includes('cotton') && f.includes('poly')) { content1 = 'Cotton'; pct1 = '65'; content2 = 'Polyester'; pct2 = '35'; }
  else if (f.includes('cotton')) { content1 = 'Cotton'; pct1 = '100'; }
  else if (f.includes('linen')) { content1 = 'Linen'; pct1 = '100'; }
  else if (f.includes('poly')) { content1 = 'Polyester'; pct1 = '100'; }
  else if (f.includes('silk')) { content1 = 'Silk'; pct1 = '100'; }
  else if (f.includes('velvet')) { content1 = 'Polyester'; pct1 = '85'; content2 = 'Nylon'; pct2 = '15'; }
  else if (f.includes('wool')) { content1 = 'Wool'; pct1 = '70'; content2 = 'Polyester'; pct2 = '30'; }

  // Performance band — derive from name + seed
  const isVelvet = name.toLowerCase().includes('velvet');
  const isLight = name.toLowerCase().includes('light') || w < 50;
  const wyzenbeek = isVelvet ? 50000 + (seed % 20000) : isLight ? 12000 + (seed % 5000) : 25000 + (seed % 15000);
  const performance =
    wyzenbeek < 9000  ? 'Decorative / Light Duty'
    : wyzenbeek < 15000 ? 'Medium Duty / Residential'
    : wyzenbeek < 30000 ? 'Heavy Duty / Residential'
    : wyzenbeek < 50000 ? 'Heavy Duty Plus'
    : 'Commercial / Contract';

  const weightOz = isVelvet ? (12 + (seed % 6) / 10) : isLight ? (5 + (seed % 30) / 10) : (8 + (seed % 40) / 10);

  // HTS codes — picked from realistic textile HTS ranges
  const cottonRaw =     ['5208.52.30', '5208.31.40', '5210.51.40'];
  const cottonPrinted = ['5208.59.20', '5208.32.60', '5210.59.20'];
  const synthRaw =      ['5407.61.99', '5407.41.00', '5407.69.40'];
  const synthPrinted =  ['5407.74.00', '5407.44.00', '5407.94.20'];
  const linenRaw =      ['5309.11.00', '5309.21.40'];
  const linenPrinted =  ['5309.19.00', '5309.29.30'];
  const [rawSet, printedSet] = content1 === 'Cotton' ? [cottonRaw, cottonPrinted]
    : content1 === 'Linen' ? [linenRaw, linenPrinted]
    : [synthRaw, synthPrinted];

  return {
    abbreviation: name.split(' ').map((p) => p[0]).join('').toUpperCase().slice(0, 5),
    ownerType: 'adt',
    ownerName: '',
    supplier: pick(['Patzeria Mill — Italy', 'MillCo Textiles — USA', 'PerformaWeave — USA', 'Akhil Mills — India']),
    width: String(w),
    printWidth: String(Math.max(0, w - 2)),
    country: pick(['USA', 'Italy', 'India', 'China', 'Turkey', 'Portugal']),
    perThouWeight: String(Math.round((weightOz * w * 1000 / 12) / 16)),
    htsRaw: pick(rawSet),
    htsPrinted: pick(printedSet),
    content1, pct1, content2, pct2, content3, pct3,
    wyzenbeek: String(wyzenbeek),
    martindale: String(Math.round(wyzenbeek * 1.4)),
    performanceRating: performance,
    weightOz: weightOz.toFixed(1),
    weightGsm: Math.round(weightOz * 33.906).toString(),
    nfpa701: (seed % 3) === 0,
    nfpa260: (seed % 4) === 0,
    ca117:   (seed % 2) === 0,
    salePrice: ((seed % 50) + 8 + (isVelvet ? 12 : 0)).toFixed(2),
  };
}

export default function FabricDetailPage({ params }: { params: { id: string } }) {
  const db = getDb();
  const id = parseInt(params.id);
  if (!Number.isFinite(id)) notFound();

  const fabric = db.prepare(`SELECT * FROM fabrics WHERE id = ?`).get(id) as any;
  if (!fabric) notFound();

  // Usage
  const prCount = (db.prepare(`SELECT COUNT(*) as n FROM print_requests WHERE fabric_id = ?`).get(id) as any).n;
  const skuCount = (db.prepare(`SELECT COUNT(*) as n FROM skus WHERE fabric_id = ?`).get(id) as any).n;
  const activePrCount = (db.prepare(`
    SELECT COUNT(*) as n FROM print_requests
    WHERE fabric_id = ? AND status NOT IN ('Complete','Cancelled','Closed')
  `).get(id) as any).n;
  const recentPRs = db.prepare(`
    SELECT pr.id, pr.pr_number, pr.status, pr.planned_yardage, o.order_number, c.name as company_name
    FROM print_requests pr
    JOIN order_lines ol ON pr.order_line_id = ol.id
    JOIN orders o ON ol.order_id = o.id
    JOIN companies c ON o.company_id = c.id
    WHERE pr.fabric_id = ?
    ORDER BY pr.created_at DESC LIMIT 10
  `).all(id) as any[];

  // Assemble the full snapshot from real + mocked specs
  const mock = mockSpecs(id, fabric.name, fabric.fiber_content, fabric.width_inches);
  const snapshot: FabricSnapshot = {
    name: fabric.name,
    abbreviation: mock.abbreviation ?? '',
    ownerType: mock.ownerType ?? 'adt',
    ownerName: mock.ownerName ?? '',
    supplier: mock.supplier ?? '',
    width: mock.width ?? '',
    printWidth: mock.printWidth ?? '',
    country: mock.country ?? '',
    perThouWeight: mock.perThouWeight ?? '',
    htsRaw: mock.htsRaw ?? '',
    htsPrinted: mock.htsPrinted ?? '',
    content1: mock.content1 ?? '', pct1: mock.pct1 ?? '',
    content2: mock.content2 ?? '', pct2: mock.pct2 ?? '',
    content3: mock.content3 ?? '', pct3: mock.pct3 ?? '',
    wyzenbeek: mock.wyzenbeek ?? '',
    martindale: mock.martindale ?? '',
    performanceRating: mock.performanceRating ?? '',
    weightOz: mock.weightOz ?? '',
    weightGsm: mock.weightGsm ?? '',
    nfpa701: mock.nfpa701 ?? false,
    nfpa260: mock.nfpa260 ?? false,
    ca117: mock.ca117 ?? false,
    salePrice: mock.salePrice ?? '',
  };

  return (
    <FabricDetailClient
      fabricId={id}
      fabricName={fabric.name}
      snapshot={snapshot}
      prCount={prCount}
      activePrCount={activePrCount}
      skuCount={skuCount}
      recentPRs={recentPRs}
    />
  );
}
