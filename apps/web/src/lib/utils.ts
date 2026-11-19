import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function formatDate(value?: string): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString();
}

export function timeAgo(value?: string): string {
  if (!value) return 'never';
  const seconds = Math.floor((Date.now() - new Date(value).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export function truncate(value: string, length = 120): string {
  return value.length > length ? `${value.slice(0, length)}…` : value;
}

export function severityClass(severity: string): string {
  switch (severity) {
    case 'critical': return 'bg-rose-500/15 text-rose-300 border-rose-500/30';
    case 'high': return 'bg-orange-500/15 text-orange-300 border-orange-500/30';
    case 'medium': return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
    case 'low': return 'bg-sky-500/15 text-sky-300 border-sky-500/30';
    default: return 'bg-slate-500/15 text-slate-300 border-slate-500/30';
  }
}
