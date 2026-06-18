import { getDb } from '@/lib/db';
import { Card, CardHeader, Button } from '@/components/ui';

// S19 Order Entry — direct entry path per S19-S22.6 revised-again (HubSpot deal path REMOVED per Megan E2)
// SCAFFOLDED — full interactivity (line builder, OD-3 approval gate evaluation, OD-9 classification,
// click-and-print modifier, Colorist assignment) comes in the next session.

export default function NewOrder() {
  const db = getDb();
  const companies = db.prepare(`SELECT id, name FROM companies WHERE is_legacy = 0 ORDER BY name LIMIT 50`).all() as { id: number; name: string }[];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-navy-900">New Order (S19)</h1>
        <p className="text-sm text-gray-500 mt-1">Direct CSR entry · two paths per Decision S19-S22.6 revised-again: (a) direct entry · (b) clone prior</p>
      </header>

      <Card>
        <CardHeader title="Order Header" />
        <form className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Customer">
              <select className="w-full border border-gray-300 rounded px-3 py-2 text-sm">
                <option value="">Select customer...</option>
                {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="PO # (optional)" hint="Per S19-S22.2">
              <input type="text" placeholder="Customer PO reference" className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
            </Field>
            <Field label="Customer Requested Date" hint="Per S19-S22.3">
              <input type="date" className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
            </Field>
            <Field label="ADT Promised Date" hint="Drives scheduling">
              <input type="date" className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
            </Field>
            <Field label="Ship Method">
              <select className="w-full border border-gray-300 rounded px-3 py-2 text-sm">
                <option>UPS Ground</option><option>FedEx Ground</option><option>USPS Priority</option>
              </select>
            </Field>
            <Field label="Roadmap" hint="Auto-suggest per Decision 5.1">
              <select className="w-full border border-gray-300 rounded px-3 py-2 text-sm">
                <option>R1 — Yardage / Direct-to-Production</option>
                <option>R2 — Yardage + Strike-Off</option>
                <option>R4 — Yardage + Cut/Sew</option>
                <option>R5 — Customer-Owned Material</option>
                <option>R7 — Strike-Off Only</option>
              </select>
            </Field>
          </div>
        </form>
      </Card>

      <Card>
        <CardHeader title="Order Lines" subtitle="Each line = one PR; per-PR strike-off classification per OD-9" />
        <div className="p-5 text-sm text-gray-500 italic">
          Line builder UI will be implemented in the next session. It will support:
          <ul className="list-disc pl-5 mt-2 space-y-1 text-xs">
            <li>SKU picker (with multi-customer mapping per S33-S34.14)</li>
            <li>Design + Colorway + Fabric attachment</li>
            <li>Strike-off classification dropdown (6 options per OD-9 + S23-S32.59)</li>
            <li>Click-and-Print modifier checkbox (per S23-S32.62)</li>
            <li>Colorist assignment (default Jeannine per S23-S32.46)</li>
            <li>Per-line price + qty + unit</li>
            <li>Pricing Rule lookup per 7.10 with CSR override per 4.9</li>
          </ul>
        </div>
      </Card>

      <Card>
        <CardHeader title="OD-3 Approval Gate Preview" subtitle="6 triggers evaluated on Submit (S23-S32.55)" />
        <div className="p-5 text-sm text-gray-500 italic">
          On Submit, Helm will evaluate the 6 OD-3 triggers (OR logic):
          <ol className="list-decimal pl-5 mt-2 space-y-1 text-xs">
            <li>New Customer — first 3 production orders</li>
            <li>New Artwork — conditional, per Trigger 2 logic</li>
            <li>Rush — &lt;5 BD fabric-only / &lt;10 BD finished product</li>
            <li>High Value / High Stakes — admin-configured threshold (configurable per customer + per product mix; pricing thresholds live in Settings, not here)</li>
            <li>Manual Flag — CSR / Sales / etc. with reason code</li>
            <li>Prior Issue / Account Watch</li>
          </ol>
          If ANY trigger fires → Order status = Waiting on Approval; routes to Megan's queue on S03 Production tab.
        </div>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="ghost">Cancel</Button>
        <Button variant="secondary">Save Draft</Button>
        <Button>Submit to Production</Button>
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">{label}</span>
      {hint && <span className="block text-[10px] text-gray-400 mb-1">{hint}</span>}
      {children}
    </label>
  );
}
