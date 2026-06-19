// SubwayMap — visual route a single PR is following through Helm.
// Stations are universal; the active set + sequence is filtered by roadmap.
// Per S21 / S22 brief: "every order follows a defined route based on product type,
// fabric, artwork status, strike-off requirement, finishing, cut/sew, shipping."

export type RoadmapCode = 'R1' | 'R2' | 'R4' | 'R5' | 'R6' | 'R7' | 'R8';

const STATIONS = {
  intake:     { label: 'Intake',     short: 'IN' },
  artwork:    { label: 'Artwork',    short: 'AR' },
  strike:     { label: 'Strike-Off', short: 'SO' },
  proof:      { label: 'Int. Proof', short: 'PF' },
  schedule:   { label: 'Scheduled',  short: 'SC' },
  print:      { label: 'Printing',   short: 'PR' },
  printed:    { label: 'Printed',    short: 'PD' },
  finish:     { label: 'Finishing',  short: 'FN' },
  cutsew:     { label: 'Cut/Sew',    short: 'CS' },
  pack:       { label: 'Packed',     short: 'PK' },
  ship:       { label: 'Shipped',    short: 'SH' },
} as const;

type StationKey = keyof typeof STATIONS;

export const ROADMAPS: Record<RoadmapCode, {
  label: string;
  description: string;
  stations: StationKey[];
}> = {
  R1: { label: 'R1 — Standard Print → Ship',
        description: 'No strike-off, no finishing, no cut/sew. Straight to print and ship.',
        stations: ['intake','artwork','proof','schedule','print','printed','pack','ship'] },
  R2: { label: 'R2 — Print → Finish → Ship',
        description: 'Print then finishing (heat press, coating, wash). Common for performance fabrics.',
        stations: ['intake','artwork','proof','schedule','print','printed','finish','pack','ship'] },
  R4: { label: 'R4 — Strike-Off → Print → Ship',
        description: 'Customer strike-off required before scheduling. Gate on customer approval.',
        stations: ['intake','artwork','strike','proof','schedule','print','printed','pack','ship'] },
  R5: { label: 'R5 — Strike-Off → Print → Finish → Cut/Sew → Ship',
        description: 'Full path: strike-off, print, finishing, cut/sew (pillows, runners, napkins), ship.',
        stations: ['intake','artwork','strike','proof','schedule','print','printed','finish','cutsew','pack','ship'] },
  R6: { label: 'R6 — Click-and-Print → Ship',
        description: 'Auto-routed from CSV/XML, no internal proof, straight to scheduling.',
        stations: ['intake','schedule','print','printed','pack','ship'] },
  R7: { label: 'R7 — Reprint → Ship',
        description: 'Recursive PR off a prior PR. Skips intake/strike. Internal proof only if artwork changed.',
        stations: ['artwork','schedule','print','printed','pack','ship'] },
  R8: { label: 'R8 — Manual / Custom',
        description: 'No template. Megan-defined per order. Use sparingly.',
        stations: ['intake','artwork','proof','schedule','print','printed','pack','ship'] },
};

// Map PR/Order status string → which station is "active" (the one currently in progress).
function statusToStation(status: string): StationKey {
  const s = (status || '').toLowerCase();
  if (s === 'draft') return 'intake';
  if (s.includes('pending internal proof')) return 'proof';
  if (s.includes('ready for scheduling')) return 'schedule';
  if (s === 'scheduled') return 'schedule';
  if (s === 'printing') return 'print';
  if (s === 'printed') return 'printed';
  if (s.includes('finish')) return 'finish';
  if (s.includes('cut')) return 'cutsew';
  if (s.includes('packed') || s === 'complete') return 'pack';
  if (s.includes('ship')) return 'ship';
  if (s.includes('strike')) return 'strike';
  if (s.includes('artwork')) return 'artwork';
  return 'intake';
}

export function SubwayMap({
  roadmap,
  currentStatus,
  exception,
}: {
  roadmap: RoadmapCode;
  currentStatus: string;
  exception?: string;
}) {
  const route = ROADMAPS[roadmap] ?? ROADMAPS.R1;
  const current = statusToStation(currentStatus);
  const currentIdx = route.stations.indexOf(current);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs">
        <span className="font-mono font-semibold text-navy-700">{roadmap}</span>
        <span className="text-gray-500">{route.label.replace(/^R\d+\s*—\s*/, '')}</span>
        {exception ? (
          <span className="ml-auto inline-flex items-center gap-1 text-helm-red bg-red-50 px-2 py-0.5 rounded text-[10px] font-semibold">
            ⚠ {exception}
          </span>
        ) : null}
      </div>

      <div className="flex items-center">
        {route.stations.map((key, idx) => {
          const station = STATIONS[key];
          const isDone = idx < currentIdx;
          const isActive = idx === currentIdx;
          const isFuture = idx > currentIdx;
          const blocked = isActive && !!exception;

          // Circle color
          const circleCls = blocked
            ? 'bg-helm-red text-white border-red-700'
            : isDone
            ? 'bg-helm-green text-green-900 border-green-700'
            : isActive
            ? 'bg-navy-700 text-white border-navy-900 ring-4 ring-navy-700/20'
            : 'bg-white text-gray-400 border-gray-300';

          // Connector color (left of this station)
          const connectorCls = idx === 0
            ? 'hidden'
            : isDone || isActive
            ? 'bg-green-500'
            : 'bg-gray-200';

          return (
            <div key={key} className="flex items-center flex-1 last:flex-none">
              <div className={`h-1 flex-1 ${connectorCls}`} />
              <div className="flex flex-col items-center -mx-0.5">
                <div
                  title={station.label}
                  className={`w-9 h-9 rounded-full border-2 flex items-center justify-center text-[10px] font-bold ${circleCls}`}
                >
                  {isDone ? '✓' : station.short}
                </div>
                <div className={`mt-1 text-[10px] font-semibold whitespace-nowrap ${
                  isActive ? 'text-navy-900' : isFuture ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  {station.label}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
