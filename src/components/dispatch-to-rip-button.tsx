'use client';
// "Dispatch to RIP" button + step-by-step trace modal for PR Detail.
// Calls /api/dispatch-to-rip when the operator decides a PR is ready to enter
// the NeoStampa lifecycle. Shows the validation checks, hot-folder selection,
// generated XML, and the four writes that would execute in production.
import { useState } from 'react';
import { Button, Card, CardHeader, Tag } from '@/components/ui';
import { Send, Check, X, ChevronRight, FileCode2, Download } from 'lucide-react';

type DispatchResponse =
  | {
      ok: true;
      pr_id: number;
      pr_number: string;
      validation: { passed: true; checks: { name: string; passed: boolean; detail?: string }[] };
      external_job_name: string;
      is_reprint: boolean;
      retry_count: number;
      hot_folder: { id: number; name: string; unc_path: string; agent: string; is_rush_lane: boolean };
      xml: string;
      would_persist: any;
      note: string;
    }
  | {
      ok: false;
      pr_id: number;
      pr_number: string;
      validation: { passed: boolean; checks: { name: string; passed: boolean; detail?: string }[] };
      dispatch_blocked: boolean;
      reason: string;
    };

export function DispatchToRipButton({ prId, prNumber }: { prId: number; prNumber: string }) {
  const [showModal, setShowModal] = useState(false);
  const [result, setResult] = useState<DispatchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [showXml, setShowXml] = useState(false);

  async function dispatch() {
    setLoading(true);
    setResult(null);
    try {
      const r = await fetch('/api/dispatch-to-rip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pr_id: prId }),
      });
      const json = await r.json();
      setResult(json);
    } catch (e: any) {
      setResult({
        ok: false, pr_id: prId, pr_number: prNumber,
        validation: { passed: false, checks: [{ name: 'network', passed: false, detail: String(e) }] },
        dispatch_blocked: true,
        reason: 'Network error',
      });
    } finally {
      setLoading(false);
    }
  }

  function open() {
    setShowModal(true);
    if (!result && !loading) dispatch();
  }

  function downloadXml() {
    if (!result || !result.ok) return;
    const blob = new Blob([result.xml], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${result.external_job_name}.xml`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <Button onClick={open}>
        <Send className="w-3.5 h-3.5 mr-1" />Dispatch to RIP
      </Button>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-lg shadow-2xl max-w-4xl w-full my-8" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-200 bg-gray-50 rounded-t-lg">
              <div>
                <div className="text-sm font-semibold text-navy-900">Dispatch {prNumber} to NeoStampa RIP</div>
                <div className="text-[10px] text-gray-500">Calls POST /api/dispatch-to-rip · shows the would-be writes</div>
              </div>
              <button onClick={() => setShowModal(false)}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded">
                <X className="w-3.5 h-3.5" />Close
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
              {loading && (
                <div className="text-center py-8 text-sm text-gray-500 italic">Dispatching…</div>
              )}

              {result && (
                <>
                  {/* Outcome banner */}
                  <div className={`p-3 rounded border-l-4 ${result.ok ? 'bg-green-50 border-green-500' : 'bg-red-50 border-red-500'}`}>
                    <div className={`font-semibold ${result.ok ? 'text-green-900' : 'text-red-900'}`}>
                      {result.ok ? '✓ Dispatch ready — all writes would commit' : `✕ Dispatch blocked: ${result.reason}`}
                    </div>
                    {result.ok && (
                      <div className="text-xs text-green-800 mt-1">
                        external_job_name: <code className="font-mono">{result.external_job_name}</code>
                        {result.is_reprint && <Tag color="yellow">_R{result.retry_count + 1} suffix · reprint</Tag>}
                      </div>
                    )}
                  </div>

                  {/* Validation trace */}
                  <Card>
                    <CardHeader title="Validation Trace" />
                    <div className="p-4 space-y-1.5">
                      {result.validation.checks.map((c, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs">
                          {c.passed
                            ? <Check className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                            : <X className="w-4 h-4 text-helm-red mt-0.5 flex-shrink-0" />}
                          <div className="flex-1">
                            <span className={c.passed ? 'text-gray-700' : 'text-helm-red font-semibold'}>{c.name}</span>
                            {c.detail && <span className="text-gray-500 ml-2 italic">— {c.detail}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>

                  {result.ok && (
                    <>
                      {/* Hot folder + agent */}
                      <Card>
                        <CardHeader title="Hot Folder Selection" />
                        <div className="p-4 grid grid-cols-2 gap-4 text-xs">
                          <Field label="Hot folder name" value={result.hot_folder.name} />
                          <Field label="Agent" value={result.hot_folder.agent} />
                          <div className="col-span-2">
                            <div className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-0.5">UNC Path</div>
                            <code className="font-mono text-[10px] break-all">{result.hot_folder.unc_path}</code>
                          </div>
                          {result.hot_folder.is_rush_lane && (
                            <div className="col-span-2"><Tag color="red">Rush lane · parent order is Rush</Tag></div>
                          )}
                        </div>
                      </Card>

                      {/* Four writes that would execute */}
                      <Card>
                        <CardHeader title="Writes that would execute" subtitle="Atomic transaction · all four succeed or all roll back" />
                        <div className="p-4 space-y-3 text-xs">
                          <WriteStep
                            n={1}
                            title="INSERT fabric_outputs"
                            description={`Mints the parent QR FabricOutput record (${result.would_persist.insert_fabric_outputs.row.qr_payload}). status=pending_print.`}
                          />
                          <WriteStep
                            n={2}
                            title="INSERT rip_jobs"
                            description={`origin=helm · external_job_name=${result.external_job_name} · status=package_created · auto_match_score=100 · reconciliation_status=attributed.`}
                          />
                          <WriteStep
                            n={3}
                            title="UPDATE print_requests"
                            description={`Sets current_rip_job_id, external_job_name, fabric_output_id, rip_status=package_created, rip_last_event_at on PR ${result.pr_number} so the PR Dashboard reflects the dispatch immediately.`}
                          />
                          <WriteStep
                            n={4}
                            title="WRITE XML to hot folder"
                            description={`${result.would_persist.write_file.path} · ${result.would_persist.write_file.content_bytes.toLocaleString()} bytes. Agent watcher picks it up within ~30s and submits to neoRipEngineCGI.`}
                          />
                          <WriteStep
                            n={5}
                            title="SCHEDULE watchdog"
                            description={`Check at ${new Date(result.would_persist.schedule_watchdog.check_at).toLocaleString()}. If no print_completed_software event by then → raises EX-RIP-NO-CONFIRM.`}
                            soft
                          />
                        </div>
                      </Card>

                      {/* XML preview toggle */}
                      <div className="flex gap-2">
                        <Button variant="secondary" onClick={() => setShowXml((v) => !v)}>
                          <FileCode2 className="w-3.5 h-3.5 mr-1" />{showXml ? 'Hide' : 'Show'} generated XML
                        </Button>
                        <Button variant="ghost" onClick={downloadXml}>
                          <Download className="w-3.5 h-3.5 mr-1" />Download .xml
                        </Button>
                      </div>

                      {showXml && (
                        <Card>
                          <CardHeader title={`${result.external_job_name}.xml`} subtitle="Inèdit neoRipEngine 4.23.0 job ticket" />
                          <pre className="p-4 text-[10px] leading-5 font-mono text-gray-800 bg-gray-50 overflow-x-auto whitespace-pre max-h-96">
                            {result.xml}
                          </pre>
                        </Card>
                      )}

                      <div className="text-[10px] text-gray-500 italic">
                        Prototype mock — the endpoint returns the writes + the XML. Production runs all four writes in one transaction, drops the .xml in the hot folder, schedules the watchdog timer, and the agent picks up the job within 30s.
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-0.5">{label}</div>
      <div className="text-navy-900">{value}</div>
    </div>
  );
}

function WriteStep({ n, title, description, soft }: { n: number; title: string; description: string; soft?: boolean }) {
  return (
    <div className="flex items-start gap-3">
      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${soft ? 'bg-yellow-100 text-yellow-800 border border-yellow-300' : 'bg-navy-700 text-white'}`}>
        {n}
      </div>
      <div className="flex-1">
        <div className="font-semibold text-navy-900 text-xs">{title}</div>
        <div className="text-gray-600 text-[11px] leading-relaxed">{description}</div>
      </div>
      <ChevronRight className="w-4 h-4 text-gray-300 mt-1" />
    </div>
  );
}
