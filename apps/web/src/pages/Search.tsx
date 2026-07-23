import { useState, type FormEvent } from 'react';
import { api, ApiError } from '../api';
import { Card, Empty, ErrorBox, ScoreBar, SourceLink, Spinner } from '../components/ui';
import type { SearchMode, SearchResponse } from '../types';

const MODES: { value: SearchMode; label: string; hint: string }[] = [
  { value: 'hybrid', label: 'Hybrid', hint: 'vector + keyword, fused (RRF)' },
  { value: 'semantic', label: 'Semantic', hint: 'meaning — pgvector cosine' },
  { value: 'keyword', label: 'Keyword', hint: 'exact terms — Postgres full-text' },
];

/** 7.2 — Search. One box, a mode toggle over the three retrieval strategies, ranked results. */
export function Search() {
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<SearchMode>('hybrid');
  const [k, setK] = useState(5);
  const [result, setResult] = useState<SearchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function runSearch(e: FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    setLoading(true);
    setError(null);
    try {
      setResult(await api.search(q, mode, k));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Search</h1>
        <p className="mt-1 text-sm text-slate-500">
          Search the indexed chunks three ways and compare. Semantic matches meaning, keyword matches exact
          terms, hybrid fuses both.
        </p>
      </div>

      <Card className="p-5">
        <form onSubmit={runSearch} className="space-y-4">
          <div className="flex gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. what did Einstein say about imagination?"
              className="flex-1 rounded-lg border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
            <button
              type="submit"
              disabled={loading || !query.trim()}
              className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-brand-700 disabled:opacity-50"
            >
              Search
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="inline-flex rounded-lg border border-slate-200 p-0.5">
              {MODES.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setMode(m.value)}
                  title={m.hint}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                    mode === m.value ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-500">
              top-k
              <input
                type="number"
                min={1}
                max={50}
                value={k}
                onChange={(e) => setK(Math.max(1, Math.min(50, Number(e.target.value) || 5)))}
                className="w-16 rounded-md border border-slate-300 px-2 py-1 text-sm"
              />
            </label>
            <span className="text-xs text-slate-400">{MODES.find((m) => m.value === mode)?.hint}</span>
          </div>
        </form>
      </Card>

      {loading && <Spinner label="Searching…" />}
      {error && <ErrorBox message={error} />}

      {result && !loading && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm text-slate-500">
            <span>
              {result.meta.count} result{result.meta.count === 1 ? '' : 's'} for “{result.meta.query}”
            </span>
            <span className="tabular-nums">
              {result.meta.mode} · {result.meta.tookMs}ms
            </span>
          </div>
          {result.data.length === 0 && <Empty>No chunks matched. Try another query or mode.</Empty>}
          {result.data.map((chunk, i) => (
            <Card key={chunk.chunkId} className="p-4">
              <div className="mb-2 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-xs text-slate-400">#{i + 1} · {chunk.title ?? 'Untitled'}</div>
                  <SourceLink url={chunk.url} />
                </div>
                <ScoreBar score={chunk.score} />
              </div>
              <p className="text-sm leading-relaxed text-slate-600">
                {chunk.text.length > 320 ? `${chunk.text.slice(0, 320)}…` : chunk.text}
              </p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
