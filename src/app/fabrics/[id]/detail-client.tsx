'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Card, CardHeader, Tag, StatusPill, Button } from '@/components/ui';
import { FabricTechSheet, type FabricSnapshot } from '@/components/fabric-tech-sheet';
import { FileText, Edit3, Download, Mail } from 'lucide-react';

export function FabricDetailClient({
  fabricId,
  fabricName,
  snapshot,
  prCount,
  activePrCount,
  skuCount,
  recentPRs,
}: {
  fabricId: number;
  fabricName: string;
  snapshot: FabricSnapshot;
  prCount: number;
  activePrCount: number;
  skuCount: number;
  recentPRs: any[];
}) {
  const [showSheet, setShowSheet] = useState(false);

  const composition = [
    snapshot.content1 && snapshot.pct1 ? `${snapshot.pct1}% ${snapshot.content1}` : '',
    snapshot.content2 && snapshot.pct2 ? `${snapshot.pct2}% ${snapshot.content2}` : '',
    snapshot.content3 && snapshot.pct3 ? `${snapshot.pct3}% ${snapshot.content3}` : '',
  ].filter(Boolean).join(' · ');

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <Link href="/fabrics" className="text-sm text-gray-500 hover:underline">← Fabrics</Link>
          <div className="flex items-center gap-3 mt-1">
            <h1 className="text-2xl font-bold text-navy-900">{fabricName}</h1>
            {snapshot.abbreviation && <Tag>{snapshot.abbreviation}</Tag>}
            <Tag color="green">Active</Tag>
            {snapshot.ownerType === 'adt' && <Tag color="blue">ADT-common</Tag>}
          </div>
          <div className="text-sm text-gray-600 mt-1">{composition}</div>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <Button variant="secondary" onClick={() => setShowSheet(true)}>
            <FileText className="w-3.5 h-3.5 mr-1" />View Tech Sheet
          </Button>
          <Button variant="ghost">
            <Edit3 className="w-3.5 h-3.5 mr-1" />Edit
          </Button>
        </div>
      </header>

      {/* Quick stats */}
      <div className="grid grid-cols-4 gap-4">
        <Stat label="Active PRs" value={activePrCount} accent={activePrCount > 0 ? 'blue' : undefined} />
        <Stat label="Lifetime PRs" value={prCount} />
        <Stat label="Linked SKUs" value={skuCount} />
        <Stat label="Sale Price" value={snapshot.salePrice ? `$${snapshot.salePrice} / yd` : '—'} />
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          {/* Identification */}
          <Card>
            <CardHeader title="Identification" />
            <div className="px-5 py-4 grid grid-cols-2 gap-y-3 gap-x-6 text-sm">
              <Field label="Owner Type">{snapshot.ownerType === 'adt' ? 'ADT-common (shared)' : 'Company-specific'}</Field>
              <Field label="Owner">{snapshot.ownerName || (snapshot.ownerType === 'adt' ? '— (shared)' : '—')}</Field>
              <Field label="Supplier">{snapshot.supplier || '—'}</Field>
              <Field label="Country of Origin">{snapshot.country || '—'}</Field>
            </div>
          </Card>

          {/* Construction */}
          <Card>
            <CardHeader title="Construction" />
            <div className="px-5 py-4 grid grid-cols-3 gap-y-3 gap-x-6 text-sm">
              <Field label="Width">{snapshot.width ? `${snapshot.width}"` : '—'}</Field>
              <Field label="Print Width">{snapshot.printWidth ? `${snapshot.printWidth}"` : '—'}</Field>
              <Field label="Per Thousand Weight">{snapshot.perThouWeight ? `${snapshot.perThouWeight} lbs` : '—'}</Field>
              <Field label="HTS — Raw (imported)">
                <span className="font-mono">{snapshot.htsRaw || '—'}</span>
              </Field>
              <Field label="HTS — Printed (outbound)">
                <span className="font-mono">{snapshot.htsPrinted || '—'}</span>
              </Field>
              <div />
            </div>
          </Card>

          {/* Composition */}
          <Card>
            <CardHeader title="Composition" />
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
                <tr>
                  <th className="text-left px-5 py-2">#</th>
                  <th className="text-left px-5 py-2">Material</th>
                  <th className="text-left px-5 py-2">%</th>
                </tr>
              </thead>
              <tbody>
                {[
                  [1, snapshot.content1, snapshot.pct1],
                  [2, snapshot.content2, snapshot.pct2],
                  [3, snapshot.content3, snapshot.pct3],
                ].map(([n, mat, pct]) => (mat ? (
                  <tr key={String(n)} className="border-t border-gray-100">
                    <td className="px-5 py-2 font-mono text-xs text-gray-500">{n}</td>
                    <td className="px-5 py-2">{mat}</td>
                    <td className="px-5 py-2 font-mono">{pct}%</td>
                  </tr>
                ) : null))}
              </tbody>
            </table>
          </Card>

          {/* Performance */}
          <Card>
            <CardHeader title="Performance" />
            <div className="px-5 py-4 grid grid-cols-3 gap-y-3 gap-x-6 text-sm">
              <Field label="Wyzenbeek">{snapshot.wyzenbeek ? `${Number(snapshot.wyzenbeek).toLocaleString()} double rubs` : '—'}</Field>
              <Field label="Martindale">{snapshot.martindale ? `${Number(snapshot.martindale).toLocaleString()} cycles` : '—'}</Field>
              <Field label="Performance Rating">
                {snapshot.performanceRating
                  ? <Tag color={
                      snapshot.performanceRating.includes('Commercial') ? 'green'
                      : snapshot.performanceRating.includes('Plus') ? 'green'
                      : snapshot.performanceRating.includes('Heavy') ? 'blue'
                      : snapshot.performanceRating.includes('Medium') ? 'yellow'
                      : 'gray'}>
                      {snapshot.performanceRating}
                    </Tag>
                  : '—'}
              </Field>
              <Field label="Weight">
                {[snapshot.weightOz ? `${snapshot.weightOz} oz/yd²` : null, snapshot.weightGsm ? `${snapshot.weightGsm} g/m²` : null].filter(Boolean).join(' · ') || '—'}
              </Field>
            </div>
          </Card>

          {/* Compliance + Pricing */}
          <div className="grid grid-cols-2 gap-6">
            <Card>
              <CardHeader title="Flammability Compliance" />
              <div className="px-5 py-4 space-y-2 text-sm">
                <ComplianceLine label="NFPA 701 (interior fabrics)" value={snapshot.nfpa701} />
                <ComplianceLine label="NFPA 260 (upholstery cig. ignition)" value={snapshot.nfpa260} />
                <ComplianceLine label="CA 117 (Calif. furniture)" value={snapshot.ca117} />
              </div>
            </Card>
            <Card>
              <CardHeader title="Pricing" />
              <div className="px-5 py-4 grid grid-cols-2 gap-y-3 gap-x-6 text-sm">
                <Field label="Sale Price">{snapshot.salePrice ? `$${snapshot.salePrice} / yd` : '—'}</Field>
              </div>
            </Card>
          </div>

          {/* Recent PRs */}
          <Card>
            <CardHeader title="Recent Print Requests using this fabric" subtitle={`${prCount} lifetime · ${activePrCount} active`} />
            {recentPRs.length === 0 ? (
              <div className="px-5 py-6 text-sm text-gray-500 italic">No PRs have used this fabric yet.</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
                  <tr>
                    <th className="text-left px-5 py-2">PR #</th>
                    <th className="text-left px-5 py-2">Order</th>
                    <th className="text-left px-5 py-2">Customer</th>
                    <th className="text-left px-5 py-2">Status</th>
                    <th className="text-left px-5 py-2">Yards</th>
                  </tr>
                </thead>
                <tbody>
                  {recentPRs.map((p) => (
                    <tr key={p.id} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="px-5 py-2 font-mono text-xs">
                        <Link href={`/print-requests/${p.id}`} className="text-navy-700 font-semibold hover:underline">{p.pr_number}</Link>
                      </td>
                      <td className="px-5 py-2 font-mono text-xs">{p.order_number}</td>
                      <td className="px-5 py-2 text-xs">{p.company_name}</td>
                      <td className="px-5 py-2"><StatusPill status={p.status} /></td>
                      <td className="px-5 py-2 font-mono text-xs">{p.planned_yardage}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </div>

        {/* Right column — Tech Sheet card */}
        <div className="space-y-6">
          <Card className="border-navy-700/30">
            <CardHeader title="Branded Tech Sheet" subtitle="Auto-generated from this fabric's spec set" />
            <div className="p-5 space-y-3">
              <div className="aspect-[8.5/11] bg-gradient-to-br from-navy-50 to-gray-50 border border-gray-200 rounded flex items-center justify-center">
                <div className="text-center px-4">
                  <FileText className="w-10 h-10 mx-auto text-navy-700 mb-2" />
                  <div className="text-xs font-semibold text-navy-700">{fabricName}</div>
                  <div className="text-[10px] text-gray-500 mt-0.5">Tech Sheet preview</div>
                </div>
              </div>
              <Button variant="secondary" className="w-full" onClick={() => setShowSheet(true)}>
                <FileText className="w-3.5 h-3.5 mr-1" />View Tech Sheet
              </Button>
              <Button variant="ghost" className="w-full">
                <Download className="w-3.5 h-3.5 mr-1" />Download PDF
              </Button>
              <Button variant="ghost" className="w-full">
                <Mail className="w-3.5 h-3.5 mr-1" />Email to customer
              </Button>
              <div className="text-[10px] text-gray-500 italic pt-2 border-t border-gray-100">
                Updates automatically when any spec on this fabric changes. Production version generates a real PDF.
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title="Quick Links" />
            <div className="p-5 space-y-2 text-sm">
              <Link href={`/inventory?fabric=${fabricId}`} className="block text-navy-700 hover:underline">View inventory →</Link>
              <Link href={`/print-requests?fabric=${fabricId}`} className="block text-navy-700 hover:underline">Filter PR Dashboard →</Link>
              <Link href="/fabrics" className="block text-navy-700 hover:underline">Back to Fabrics →</Link>
            </div>
          </Card>
        </div>
      </div>

      {showSheet && <FabricTechSheet fabric={snapshot} onClose={() => setShowSheet(false)} />}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-0.5">{label}</div>
      <div>{children}</div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: any; accent?: 'blue' }) {
  const cls = accent === 'blue' ? 'text-navy-700' : 'text-navy-900';
  return (
    <Card>
      <div className="p-4">
        <div className="text-xs uppercase tracking-wider text-gray-500 mb-1">{label}</div>
        <div className={`text-2xl font-bold ${cls}`}>{value}</div>
      </div>
    </Card>
  );
}

function ComplianceLine({ label, value }: { label: string; value: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-gray-700 text-xs">{label}</span>
      {value ? <Tag color="green">PASS</Tag> : <Tag color="gray">—</Tag>}
    </div>
  );
}
