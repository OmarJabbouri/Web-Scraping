import { useState, type FormEvent, type ReactNode } from 'react';
import { api, ApiError } from '../api';
import { Card, ErrorBox, SourceLink, Spinner } from '../components/ui';
import type { AskResponse, Citation } from '../types';

const EXAMPLES = [
  'What did Einstein say about imagination?',
  'Which travel books are listed and what did Einstein say about life?',
];

/** 7.3 — Ask. RAG Q&A: a question in, a grounded answer out with inline, clickable citations. */
export function Ask() {
  const [question, setQuestion] = useState('');
  const [useSubQueries, setUseSubQueries] = useState(false);
  const [subQueriesText, setSubQueriesText] = useState('');
  const [result, setResult] = useState<AskResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function ask(e: FormEvent) {
    e.preventDefault();
    const q = question.trim();
    if (q.length < 3) return;
    setLoading(true);
    setError(null);
    setResult(null);
    const subQueries =
      useSubQueries && subQueriesText.trim()
        ? subQueriesText.split('\n').map((s) => s.trim()).filter(Boolean)
        : undefined;
    try {
      setResult(await api.ask(q, 5, subQueries));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Ask</h1>
        <p className="mt-1 text-sm text-slate-500">
          Retrieval-augmented answers grounded strictly in the scraped content, with citations back to the
          exact source URLs. If the sources don’t cover it, the model says so instead of guessing.
        </p>
      </div>

      <Card className="p-5">
        <form onSubmit={ask} className="space-y-4">
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            rows={3}
            placeholder="Ask a question about the scraped sites…"
            className="w-full resize-y rounded-lg border border-slate-300 px-4 py-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          />

          <div className="flex flex-wrap gap-2">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => setQuestion(ex)}
                className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-500 hover:border-brand-300 hover:text-brand-600"
              >
                {ex}
              </button>
            ))}
          </div>

          <div className="rounded-lg bg-slate-50 p-3">
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={useSubQueries}
                onChange={(e) => setUseSubQueries(e.target.checked)}
                className="accent-brand-600"
              />
              Multi-source synthesis
              <span className="text-xs text-slate-400">
                — split a two-part question so retrieval spans multiple sites
              </span>
            </label>
            {useSubQueries && (
              <textarea
                value={subQueriesText}
                onChange={(e) => setSubQueriesText(e.target.value)}
                rows={2}
                placeholder={'One sub-query per line, e.g.\ntravel books available\nEinstein quote about life'}
                className="mt-2 w-full resize-y rounded-md border border-slate-300 px-3 py-2 text-xs outline-none focus:border-brand-500"
              />
            )}
          </div>

          <button
            type="submit"
            disabled={loading || question.trim().length < 3}
            className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-brand-700 disabled:opacity-50"
          >
            {loading ? 'Thinking…' : 'Ask'}
          </button>
        </form>
      </Card>

      {loading && <Spinner label="Retrieving sources and generating a grounded answer…" />}
      {error && <ErrorBox message={error} />}
      {result && !loading && <Answer result={result} />}
    </div>
  );
}

function Answer({ result }: { result: AskResponse }) {
  const { answer, citations } = result.data;
  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="mb-3 flex items-center justify-between text-xs text-slate-400">
          <span className="font-medium uppercase tracking-wide text-slate-500">Answer</span>
          <span className="tabular-nums">
            {result.meta.retrieved} chunks · {result.meta.sources} sources · {result.meta.tookMs}ms
          </span>
        </div>
        <div className="text-[15px] leading-relaxed text-slate-800">
          {renderWithCitations(answer, citations)}
        </div>
      </Card>

      {citations.length > 0 && (
        <Card className="p-5">
          <div className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-500">Citations</div>
          <ol className="space-y-3">
            {citations.map((c) => (
              <li key={c.marker} className="flex gap-3 text-sm">
                <span
                  id={`cite-${c.marker}`}
                  className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700"
                >
                  {c.marker}
                </span>
                <div className="min-w-0">
                  <SourceLink url={c.url}>{c.title ?? c.url}</SourceLink>
                  <p className="mt-0.5 text-xs text-slate-500">{c.snippet}</p>
                </div>
              </li>
            ))}
          </ol>
        </Card>
      )}
    </div>
  );
}

/**
 * Turn inline `[n]` markers in the answer text into clickable superscripts that jump to the matching
 * citation. This is the visible proof that the answer is grounded — every claim points at a source.
 */
function renderWithCitations(text: string, citations: Citation[]): ReactNode[] {
  const byMarker = new Map(citations.map((c) => [c.marker, c]));
  // Split on bracketed numbers, keeping the delimiters so we can replace them selectively.
  return text.split(/(\[\d+\])/g).map((part, i) => {
    const match = /^\[(\d+)\]$/.exec(part);
    if (!match) return <span key={i}>{part}</span>;
    const marker = Number(match[1]);
    const citation = byMarker.get(marker);
    if (!citation) return <span key={i}>{part}</span>;
    return (
      <a
        key={i}
        href={citation.url}
        target="_blank"
        rel="noreferrer"
        title={citation.title ?? citation.url}
        className="mx-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded bg-brand-100 px-1 align-super text-[10px] font-semibold text-brand-700 hover:bg-brand-200"
      >
        {marker}
      </a>
    );
  });
}
