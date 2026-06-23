// Persistent top banner that runs across every page. Cannot be dismissed —
// reminds reviewers that the prototype contains only mock data and is for
// blueprint review, not production use.
import Link from 'next/link';
import { Info } from 'lucide-react';

const VERSION = '1.2';
// Bump on each major review milestone. Used to communicate to Ali that
// the prototype moved between sessions.

export function PrototypeBanner() {
  return (
    <div className="bg-yellow-100 border-b border-yellow-300 text-yellow-900 text-xs px-4 py-1.5 flex items-center justify-center gap-3">
      <Info className="w-3.5 h-3.5 flex-shrink-0" />
      <span>
        <strong>ADT Helm prototype v{VERSION}</strong> · All data is mock / faker-seeded.
        For blueprint review only — no real customer info, no external services.
      </span>
      <span className="opacity-60">·</span>
      <Link href="/" className="underline hover:no-underline">Tour</Link>
      <Link href="/sitemap" className="underline hover:no-underline">Sitemap</Link>
      <Link href="/changelog" className="underline hover:no-underline">Changelog</Link>
    </div>
  );
}
