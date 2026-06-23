'use client';

import { useState } from 'react';
import { Button, Tag } from '@/components/ui';
import { Send, Layers, X, Check } from 'lucide-react';

interface VersionRow {
  id: number;
  version_number: number;
  file_name: string;
  file_hash: string | null;
  status: string;
}

// Submit for Strike-Off — single OR multi-variant (2-4 picks).
// Triggers POST /api/promote-to-strike-off. In the prototype, the endpoint returns
// the would-be writes; in production it composites the XML and drops to hot folder.
export function PromoteToStrikeOffButton({ prId, versions }: { prId: number; versions: VersionRow[] }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'single' | 'multi'>('single');
  const [selected, setSelected] = useState<number[]>([]);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // Default selection: latest non-archived version
  function openModal() {
    const candidates = versions.filter((v) => v.status !== 'Archived');
    const latest = candidates[0];
    setSelected(latest ? [latest.id] : []);
    setMode('single');
    setResult(null);
    setOpen(true);
  }

  function toggle(id: number) {
    if (mode === 'single') {
      setSelected([id]);
      return;
    }
    if (selected.includes(id)) {
      setSelected(selected.filter((s) => s !== id));
    } else if (selected.length < 4) {
      setSelected([...selected, id]);
    }
  }

  async function submit() {
    setLoading(true);
    try {
      const r = await fetch('/api/promote-to-strike-off', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pr_id: prId, artwork_file_ids: selected }),
      });
      const data = await r.json();
      setResult(data);
    } catch (e: any) {
      setResult({ error: String(e) });
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button size="sm" variant="primary" onClick={openModal}>
        <Send className="w-3.5 h-3.5 mr-1" />
        Submit for Strike-Off
      </Button>

      {open && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-3 border-b border-gray-200 flex items-center justify-between">
              <div>
                <div className="font-bold">Submit for Strike-Off</div>
                <div className="text-xs text-gray-500">PR {prId} · Hash-locked promotion — selected version(s) become the strike candidate</div>
              </div>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-700"><X className="w-5 h-5" /></button>
            </div>

            {/* Mode toggle */}
            <div className="px-5 py-3 border-b border-gray-200 flex items-center gap-2">
              <button
                onClick={() => { setMode('single'); setSelected(selected.slice(0, 1)); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium ${mode === 'single' ? 'bg-navy-700 text-white' : 'bg-gray-100 text-gray-700'}`}
              >
                <Send className="w-3.5 h-3.5" />
                Single-variant
              </button>
              <button
                onClick={() => setMode('multi')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium ${mode === 'multi' ? 'bg-navy-700 text-white' : 'bg-gray-100 text-gray-700'}`}
              >
                <Layers className="w-3.5 h-3.5" />
                Multi-variant (2–4)
              </button>
              <div className="ml-auto text-xs text-gray-500">
                {mode === 'single' ? '1 version → 1 strike' : `${selected.length} variant${selected.length === 1 ? '' : 's'} → 1 print run, customer picks`}
              </div>
            </div>

            {/* Version picker */}
            <div className="px-5 py-3">
              <div className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-2">
                Select version{mode === 'multi' ? 's' : ''} to promote
              </div>
              <div className="divide-y divide-gray-100 border border-gray-200 rounded">
                {versions.map((v) => {
                  const isSel = selected.includes(v.id);
                  const disabled = mode === 'multi' && !isSel && selected.length >= 4;
                  return (
                    <button
                      key={v.id}
                      onClick={() => !disabled && toggle(v.id)}
                      disabled={disabled || !v.file_hash}
                      className={`w-full text-left px-3 py-2.5 grid grid-cols-12 gap-2 items-center hover:bg-gray-50 ${isSel ? 'bg-purple-50' : ''} ${disabled || !v.file_hash ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <div className="col-span-1 text-center">
                        <div className={`w-5 h-5 rounded border-2 mx-auto flex items-center justify-center ${isSel ? 'bg-purple-600 border-purple-600' : 'border-gray-300'}`}>
                          {isSel && <Check className="w-3.5 h-3.5 text-white" />}
                        </div>
                      </div>
                      <div className="col-span-1 font-mono font-bold text-sm">v{v.version_number}</div>
                      <div className="col-span-6 min-w-0">
                        <div className="font-mono text-xs truncate">{v.file_name}</div>
                        <div className="font-mono text-[10px] text-gray-500 truncate">{v.file_hash?.slice(0, 24) ?? 'no hash'}…</div>
                      </div>
                      <div className="col-span-4 text-xs">
                        <Tag color={v.status === 'Approved' ? 'green' : v.status === 'Pending Approval' ? 'yellow' : v.status === 'Draft' ? 'blue' : 'gray'}>{v.status}</Tag>
                      </div>
                    </button>
                  );
                })}
              </div>
              {mode === 'multi' && selected.length < 2 && (
                <div className="text-xs text-amber-700 mt-2">Multi-variant needs at least 2 selections.</div>
              )}
            </div>

            {/* Actions */}
            <div className="px-5 py-3 border-t border-gray-200 flex items-center gap-2">
              <Button
                variant="primary"
                size="sm"
                onClick={submit}
                disabled={loading || selected.length === 0 || (mode === 'multi' && selected.length < 2)}
              >
                {loading ? 'Submitting…' : `Promote ${selected.length} version${selected.length === 1 ? '' : 's'} to strike-off`}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
            </div>

            {/* Result */}
            {result && (
              <div className="px-5 py-4 border-t border-gray-200 bg-gray-50">
                <div className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-2">API response (read-only on Vercel — would write in production)</div>
                <pre className="text-[10px] bg-white p-3 rounded border border-gray-200 overflow-x-auto max-h-72">
{JSON.stringify(result, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
