// MockSurfaceBanner — drop in at the top of a page whose data/persistence is mock-only.
// The prototype banner already says "all data is mock", but reviewers often assume per-page
// that what they're looking at is live unless explicitly flagged.
//
// Usage:
//   <MockSurfaceBanner reason="No exceptions table in schema yet — 20 sample rows are inline mock. Forms don't persist." />

import { AlertOctagon } from 'lucide-react';

export function MockSurfaceBanner({ reason }: { reason: string }) {
  return (
    <div className="bg-amber-50 border border-amber-300 text-amber-900 rounded px-3 py-2 flex items-start gap-2 text-xs mb-4">
      <AlertOctagon className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-700" />
      <div>
        <span className="font-semibold uppercase tracking-wider text-[10px] mr-2">Mock Surface</span>
        <span className="text-amber-900">{reason}</span>
      </div>
    </div>
  );
}
