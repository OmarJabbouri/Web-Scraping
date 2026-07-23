import type { ReactNode } from 'react';
import type { PageStatus } from '../types';

/** Small presentational primitives shared across pages, so the look stays consistent. */

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}>{children}</div>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 text-slate-500">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-brand-600" />
      {label && <span className="text-sm">{label}</span>}
    </div>
  );
}

export function ErrorBox({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      {message}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="py-10 text-center text-sm text-slate-400">{children}</div>;
}

const STATUS_STYLES: Record<PageStatus, string> = {
  crawled: 'bg-emerald-100 text-emerald-700',
  pending: 'bg-amber-100 text-amber-700',
  skipped: 'bg-slate-100 text-slate-600',
  failed: 'bg-red-100 text-red-700',
};

export function StatusBadge({ status }: { status: PageStatus }) {
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}>
      {status}
    </span>
  );
}

export function Pill({ children, tone = 'slate' }: { children: ReactNode; tone?: 'slate' | 'brand' | 'js' }) {
  const tones = {
    slate: 'bg-slate-100 text-slate-600',
    brand: 'bg-brand-100 text-brand-700',
    js: 'bg-purple-100 text-purple-700',
  };
  return <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${tones[tone]}`}>{children}</span>;
}

/** A source URL rendered as an external link with a trailing arrow — used by search + citations. */
export function SourceLink({ url, children }: { url: string; children?: ReactNode }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="break-all font-medium text-brand-600 hover:text-brand-700 hover:underline"
    >
      {children ?? url} ↗
    </a>
  );
}

export function ScoreBar({ score }: { score: number }) {
  // Scores are unnormalized across modes (cosine vs ts_rank vs RRF), so this is a relative cue,
  // not an absolute percentage. Clamp to [0,1] for the bar width.
  const pct = Math.max(0, Math.min(1, score)) * 100;
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-brand-500" style={{ width: `${pct}%` }} />
      </div>
      <span className="tabular-nums text-xs text-slate-400">{score.toFixed(3)}</span>
    </div>
  );
}
