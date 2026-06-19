import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatCurrency(n: number | null): string {
  if (n == null) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

export function daysAgo(iso: string | null): number {
  if (!iso) return 0;
  const ms = Date.now() - new Date(iso).getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

export function relativeTime(iso: string | null): string {
  if (!iso) return '—';
  const d = daysAgo(iso);
  if (d === 0) return 'today';
  if (d === 1) return 'yesterday';
  if (d < 7) return `${d}d ago`;
  if (d < 30) return `${Math.floor(d / 7)}w ago`;
  if (d < 365) return `${Math.floor(d / 30)}mo ago`;
  return `${Math.floor(d / 365)}y ago`;
}

/** Smart "promised date" formatter — Today / Tomorrow / Yesterday / weekday+date / short date.
 *  Used on dashboards where a long 'Jun 18, 2026' string adds noise without info. */
export function formatPromised(iso: string | null): { label: string; isLate: boolean } {
  if (!iso) return { label: '—', isLate: false };
  const target = new Date(iso);
  const today = new Date();
  // Normalize to midnight for date-only comparison
  target.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return { label: 'Today', isLate: false };
  if (diffDays === 1) return { label: 'Tomorrow', isLate: false };
  if (diffDays === -1) return { label: 'Yesterday', isLate: true };
  if (diffDays < -1) return { label: `${Math.abs(diffDays)}d late`, isLate: true };
  if (diffDays < 7) return { label: target.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }), isLate: false };
  return { label: target.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), isLate: false };
}
