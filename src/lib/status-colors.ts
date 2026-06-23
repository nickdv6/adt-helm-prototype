// Centralized status → Tag color mapping (Phase 2 cleanup).
//
// Two different mechanisms in use across the app:
//   1. <StatusPill> reads CSS attribute selectors in globals.css — used for Order/PR statuses.
//   2. Pages that render status as <Tag color="..."> need a programmatic map — collected here.
//
// Source of truth for each enum is the schema (see comments alongside status TEXT columns).
// When adding a value to the schema, add the color here AND the CSS rule in globals.css if
// the value should render via <StatusPill>.

type TagColor = 'gray' | 'blue' | 'green' | 'yellow' | 'red' | 'purple';

// ---------- Strike-Off lifecycle (14 values) ----------
export const STRIKE_OFF_STATUS_COLORS: Record<string, TagColor> = {
  'Requested': 'gray',
  'In Queue': 'gray',
  'In Color Matching': 'blue',
  'Printing': 'blue',
  'Quality Check': 'blue',
  'Awaiting Approval': 'yellow',
  'Customer Reviewing': 'yellow',
  'Approved': 'green',
  'Approve with Changes': 'purple',
  'Rejected': 'red',
  'Revision Required': 'red',
  'On Hold': 'gray',
  'Cancelled': 'gray',
  'Closed': 'gray',
};

// ---------- Artwork file status (4 values from schema) ----------
export const ARTWORK_STATUS_COLORS: Record<string, TagColor> = {
  'Draft': 'gray',
  'Pending Approval': 'yellow',
  'Approved': 'green',
  'Archived': 'gray',
};

// ---------- Print process (PR Dashboard) ----------
export const PROCESS_COLORS: Record<string, TagColor> = {
  reactive: 'blue',
  pigment: 'purple',
  dye_sublimation: 'yellow',
  latex: 'green',
  direct_disperse: 'red',
  other_manual_review: 'gray',
};

export const PROCESS_LABELS: Record<string, string> = {
  reactive: 'Reactive',
  pigment: 'Pigment',
  dye_sublimation: 'Dye Sub',
  latex: 'Latex',
  direct_disperse: 'Direct Disperse',
  other_manual_review: 'Other',
};

// ---------- Helper for callers ----------
export function tagColorFor(map: Record<string, TagColor>, value: string | null | undefined, fallback: TagColor = 'gray'): TagColor {
  if (!value) return fallback;
  return map[value] ?? fallback;
}
