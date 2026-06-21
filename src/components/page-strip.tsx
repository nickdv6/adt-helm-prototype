'use client';
// Per-page annotation strip rendered at the bottom of every page. Looks up
// metadata from the central registry based on the current path. Shows:
//   - Blueprint S## reference (if any)
//   - Wave tag
//   - Data source: live / mock / mixed
//   - Optional data note explaining what's mock
//   - "View source" link to GitHub
import { usePathname } from 'next/navigation';
import { lookupMeta, sourceUrl, PageMeta } from '@/lib/page-meta';
import { Code2, Database, FileQuestion } from 'lucide-react';

export function PageStrip() {
  const pathname = usePathname();
  // Don't render on the customer-facing approval page (it's standalone)
  if (pathname.startsWith('/approve/')) return null;
  const meta = lookupMeta(pathname);
  return (
    <footer className="mt-12 border-t border-gray-200 bg-gray-50 -mx-6 -mb-6 px-6 py-3">
      {meta ? <Known meta={meta} /> : <Unknown pathname={pathname} />}
    </footer>
  );
}

function Known({ meta }: { meta: PageMeta }) {
  const sourceTag =
    meta.dataSource === 'live'  ? { label: 'Live · DB-backed', color: 'bg-green-100 text-green-800 border-green-200', icon: <Database className="w-3 h-3" /> }
    : meta.dataSource === 'mock' ? { label: 'MOCK',             color: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: <FileQuestion className="w-3 h-3" /> }
    :                              { label: 'Mixed live + mock', color: 'bg-blue-100 text-blue-800 border-blue-200', icon: <Database className="w-3 h-3" /> };
  return (
    <div className="flex items-center gap-3 text-[11px] text-gray-500 flex-wrap">
      <span className="font-semibold text-gray-700">{meta.title}</span>
      {meta.blueprintId && (
        <span className="font-mono bg-navy-50 text-navy-700 border border-navy-700/20 px-1.5 py-0.5 rounded">
          {meta.blueprintId}
        </span>
      )}
      <span className="font-mono bg-gray-100 text-gray-600 border border-gray-200 px-1.5 py-0.5 rounded">
        {meta.wave}
      </span>
      <span className={`inline-flex items-center gap-1 font-mono px-1.5 py-0.5 rounded border ${sourceTag.color}`}>
        {sourceTag.icon}{sourceTag.label}
      </span>
      <span className="font-mono text-gray-400">{meta.category}</span>
      {meta.dataNote && <span className="italic text-gray-500">· {meta.dataNote}</span>}
      <a href={sourceUrl(meta)} target="_blank" rel="noreferrer"
        className="ml-auto inline-flex items-center gap-1 text-gray-500 hover:text-navy-700 hover:underline">
        <Code2 className="w-3 h-3" />view source
      </a>
    </div>
  );
}

function Unknown({ pathname }: { pathname: string }) {
  return (
    <div className="text-[11px] text-gray-400 italic">
      No metadata registered for <code className="font-mono">{pathname}</code> · add to <code className="font-mono">src/lib/page-meta.ts</code>
    </div>
  );
}
