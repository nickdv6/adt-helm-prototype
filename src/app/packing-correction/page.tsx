'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardHeader, Tag, Button } from '@/components/ui';
import { AlertTriangle, ArrowLeftRight, RotateCcw, X, Search, FileText } from 'lucide-react';

// /packing-correction — Backtracking interface for packing / roll / shipment errors
//
// Per Nick: operators need a simple, operationally safe UI to undo packing mistakes
// without dev intervention. Covers: wrong PR packed, wrong roll associated, wrong order
// line packed, item packed but not shipped, generic undo last action. Confirmations
// required. Audit-trail entries recorded for every correction.

type ActionKind =
  | 'reassign-roll'   // Roll attached to wrong PR; move it to the correct PR
  | 'unpack-pr'       // PR marked packed in error; revert to pre-pack state
  | 'unship-pr'       // PR marked shipped in error; revert to packed state
  | 'void-roll'       // Roll # was created in error; void it (PR returns to pre-print or pre-roll state)
  | 'reassign-line';  // PR packed against wrong order line; move PR to correct line/order

const ACTIONS: { kind: ActionKind; title: string; subtitle: string; icon: any; severity: 'medium' | 'high' }[] = [
  { kind: 'reassign-roll', title: 'Reassign roll to a different PR',
    subtitle: 'Use when a roll was associated with the wrong Print Request at print time. Updates roll → PR mapping.',
    icon: ArrowLeftRight, severity: 'medium' },
  { kind: 'unpack-pr', title: 'Undo packing (mark PR as not packed)',
    subtitle: 'Use when a PR was marked Packed but the operator now realizes it was the wrong item. Reverts PR to Printed / awaiting pack.',
    icon: RotateCcw, severity: 'medium' },
  { kind: 'unship-pr', title: 'Undo shipment (mark PR as not shipped)',
    subtitle: 'Use when a PR was marked Shipped but the package never actually went out. Reverts PR to Ready/Packed.',
    icon: RotateCcw, severity: 'high' },
  { kind: 'void-roll', title: 'Void a roll created in error',
    subtitle: 'Use when a roll # was generated but should not exist (mis-scan, duplicate, etc.). Voids the roll; PR returns to pre-roll state.',
    icon: X, severity: 'high' },
  { kind: 'reassign-line', title: 'Move PR to a different order / order line',
    subtitle: 'Use when a PR was packed against the wrong order line. Detaches PR from current line and re-attaches to the correct one.',
    icon: ArrowLeftRight, severity: 'high' },
];

const SEVERITY_TAG: Record<'medium' | 'high', { color: 'yellow' | 'red'; label: string }> = {
  medium: { color: 'yellow', label: 'Recoverable' },
  high: { color: 'red', label: 'High-impact · audit reviewed' },
};

// Mock recent corrections — to show what the audit log looks like
const RECENT_CORRECTIONS = [
  { id: 1, when: '14 min ago', operator: 'Lucio Hernandez', action: 'Reassigned roll R-A4F721 from PR-8247 to PR-8248',
    reason: 'Wrong PR scanned at pack station', orderImpact: 'O-44512 / O-44513' },
  { id: 2, when: '2 hours ago', operator: 'Yuliana Cruz', action: 'Undid packing on PR-8203',
    reason: 'Packed wrong color way — reverted to Printed', orderImpact: 'O-44486' },
  { id: 3, when: 'Yesterday · 17:42', operator: 'Lucio Hernandez', action: 'Voided roll R-X8221F',
    reason: 'Duplicate roll # from RIP misfire', orderImpact: 'O-44472' },
];

export default function PackingCorrection({ searchParams }: { searchParams: { roll?: string; pr?: string } }) {
  const initialRoll = searchParams?.roll ?? '';
  const initialPR = searchParams?.pr ?? '';

  const [activeAction, setActiveAction] = useState<ActionKind | null>(null);
  const [rollNumber, setRollNumber] = useState(initialRoll);
  const [prNumber, setPRNumber] = useState(initialPR);
  const [targetIdentifier, setTargetIdentifier] = useState('');
  const [reason, setReason] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);

  const activeMeta = ACTIONS.find((a) => a.kind === activeAction);

  const handleSubmit = () => setShowConfirm(true);

  const confirmAction = () => {
    alert(`(prototype) Correction logged: ${activeMeta?.title}\n\nIdentifier: ${rollNumber || prNumber}\nTarget: ${targetIdentifier}\nReason: ${reason}\n\nAudit event recorded.`);
    setShowConfirm(false);
    setActiveAction(null);
    setRollNumber('');
    setPRNumber('');
    setTargetIdentifier('');
    setReason('');
  };

  return (
    <div className="max-w-7xl mx-auto pb-12">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-navy-900">Packing Correction · Backtracking</h1>
        <p className="text-sm text-gray-500 mt-1">
          Operationally-safe undo for packing, roll, and shipment errors · all corrections require a reason and create an audit-trail entry.
        </p>
      </header>

      {/* Safety banner */}
      <div className="bg-yellow-50 border border-yellow-200 rounded p-4 text-sm text-yellow-900 mb-6 flex items-start gap-2">
        <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
        <div>
          <strong className="block">Corrections are logged and visible to Megan.</strong>
          High-impact actions (voiding rolls, undoing shipments, reassigning PRs across orders) trigger an exception entry for review. Choose the smallest correction that fixes the issue.
        </div>
      </div>

      <div className="grid grid-cols-3 gap-5">
        {/* Action picker / form */}
        <div className="col-span-2 space-y-5">
          {!activeAction ? (
            <Card>
              <CardHeader title="Pick a correction" subtitle="Choose the action that matches the error — each opens a guided form" />
              <div className="grid grid-cols-1 divide-y divide-gray-100">
                {ACTIONS.map((a) => {
                  const Icon = a.icon;
                  const sev = SEVERITY_TAG[a.severity];
                  return (
                    <button
                      key={a.kind}
                      onClick={() => setActiveAction(a.kind)}
                      className="text-left px-5 py-3.5 hover:bg-gray-50 flex items-start gap-3 transition-colors"
                    >
                      <Icon className="w-5 h-5 text-navy-700 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <div className="font-semibold text-navy-900">{a.title}</div>
                          <Tag color={sev.color}>{sev.label}</Tag>
                        </div>
                        <div className="text-xs text-gray-600 mt-0.5">{a.subtitle}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </Card>
          ) : (
            <Card>
              <CardHeader
                title={activeMeta?.title || ''}
                subtitle={activeMeta?.subtitle}
                action={
                  <button onClick={() => setActiveAction(null)} className="text-xs text-gray-500 hover:text-navy-700">← Back to actions</button>
                }
              />
              <div className="p-5 space-y-4">
                {/* Different forms per action type — same shape: identify subject + target + reason */}
                {(activeAction === 'reassign-roll' || activeAction === 'void-roll') && (
                  <FormField label="Roll #" required hint="The roll the correction applies to">
                    <SearchInput value={rollNumber} onChange={setRollNumber} placeholder="R-A4F721" />
                  </FormField>
                )}
                {(activeAction === 'unpack-pr' || activeAction === 'unship-pr' || activeAction === 'reassign-line') && (
                  <FormField label="PR #" required hint="The print request the correction applies to">
                    <SearchInput value={prNumber} onChange={setPRNumber} placeholder="PR-8247" />
                  </FormField>
                )}

                {activeAction === 'reassign-roll' && (
                  <FormField label="Correct PR #" required hint="The PR this roll should actually be attached to">
                    <SearchInput value={targetIdentifier} onChange={setTargetIdentifier} placeholder="PR-8248" />
                  </FormField>
                )}
                {activeAction === 'reassign-line' && (
                  <FormField label="Correct Order # / Order Line" required hint="Where this PR should be re-attached">
                    <SearchInput value={targetIdentifier} onChange={setTargetIdentifier} placeholder="O-44513 / line 2" />
                  </FormField>
                )}

                <FormField label="Reason" required hint="Will appear in the audit trail and on any exception reviewed by Megan">
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={3}
                    placeholder="Wrong PR scanned at pack station…"
                    className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
                  />
                </FormField>

                <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                  <Button variant="ghost" onClick={() => setActiveAction(null)}>Cancel</Button>
                  <Button
                    onClick={handleSubmit}
                    disabled={!reason || (!rollNumber && !prNumber) || ((activeAction === 'reassign-roll' || activeAction === 'reassign-line') && !targetIdentifier)}
                  >
                    Review &amp; Confirm
                  </Button>
                </div>
              </div>
            </Card>
          )}
        </div>

        {/* Right side — recent corrections audit trail */}
        <div className="space-y-5">
          <Card>
            <CardHeader title="Recent corrections" subtitle="Audit trail" />
            <div className="divide-y divide-gray-100">
              {RECENT_CORRECTIONS.map((rc) => (
                <div key={rc.id} className="px-4 py-3 text-xs">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-navy-900">{rc.operator}</span>
                    <span className="text-gray-400">{rc.when}</span>
                  </div>
                  <div className="text-gray-700">{rc.action}</div>
                  <div className="text-gray-500 mt-1 italic">"{rc.reason}"</div>
                  <div className="text-[10px] uppercase tracking-wider text-gray-400 mt-1 font-semibold">Impact: {rc.orderImpact}</div>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader title="Related" />
            <div className="px-4 py-3 space-y-2 text-sm">
              <Link href="/rolls" className="flex items-center gap-2 text-navy-700 hover:underline">
                <Search className="w-3.5 h-3.5" /> Search created rolls
              </Link>
              <Link href="/exceptions" className="flex items-center gap-2 text-navy-700 hover:underline">
                <FileText className="w-3.5 h-3.5" /> Open exceptions
              </Link>
            </div>
          </Card>
        </div>
      </div>

      {/* Confirmation modal */}
      {showConfirm && activeMeta && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowConfirm(false)}></div>
          <div className="relative bg-white rounded shadow-2xl w-full max-w-md">
            <div className="px-5 py-4 border-b border-gray-200 flex items-center gap-2 text-yellow-900">
              <AlertTriangle className="w-5 h-5" />
              <div className="text-base font-bold">Confirm correction</div>
            </div>
            <div className="px-5 py-4 space-y-3 text-sm">
              <p>You are about to: <strong>{activeMeta.title}</strong>.</p>
              <div className="bg-gray-50 border border-gray-200 rounded p-3 text-xs space-y-1">
                {rollNumber && <div><span className="text-gray-500">Roll:</span> <span className="font-mono">{rollNumber}</span></div>}
                {prNumber && <div><span className="text-gray-500">PR:</span> <span className="font-mono">{prNumber}</span></div>}
                {targetIdentifier && <div><span className="text-gray-500">Target:</span> <span className="font-mono">{targetIdentifier}</span></div>}
                <div><span className="text-gray-500">Reason:</span> {reason}</div>
              </div>
              <p className="text-xs text-gray-600 italic">
                An audit event will be written with your name, the current timestamp, the affected records, and the reason text above.
                {activeMeta.severity === 'high' && <> An exception will also be created for Megan to review.</>}
              </p>
            </div>
            <div className="px-5 py-3 border-t border-gray-200 flex items-center justify-end gap-2">
              <Button variant="ghost" onClick={() => setShowConfirm(false)}>Cancel</Button>
              <Button onClick={confirmAction}>Confirm correction</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FormField({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-700 mb-1">
        {label}{required && <span className="text-red-600 ml-0.5">*</span>}
      </label>
      {hint && <div className="text-[10px] text-gray-500 mb-1 italic">{hint}</div>}
      {children}
    </div>
  );
}

function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative">
      <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-gray-400" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-8 pr-3 py-1.5 border border-gray-300 rounded text-sm font-mono"
      />
    </div>
  );
}
