import { useState } from 'react';
import { api } from '../api';
import { useAsync } from '../hooks';
import { Link, useQueryParam } from '../router';
import { Card, Empty, ErrorBox, Spinner, StatusBadge } from '../components/ui';
import type { PageStatus } from '../types';

const PAGE_SIZE = 20;
const STATUSES: (PageStatus | '')[] = ['', 'crawled', 'skipped', 'failed', 'pending'];

/** 7.4 (list) — Pages browser. Filter by site/status/URL, paginate; each row opens the detail view. */
export function Pages() {
  const siteId = useQueryParam('siteId');
  const [status, setStatus] = useState<PageStatus | ''>('');
  const [q, setQ] = useState('');
  const [offset, setOffset] = useState(0);

  const { data, error, loading } = useAsync(
    (signal) =>
      api.pages(
        {
          limit: PAGE_SIZE,
          offset,
          siteId: siteId ? Number(siteId) : undefined,
          status: status || undefined,
          q: q || undefined,
        },
        signal,
      ),
    [siteId, status, q, offset],
  );

  const total = data?.meta.total ?? 0;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Pages</h1>
        {siteId && (
          <Link to="/pages" className="text-sm text-brand-600 hover:underline">
            × clear site filter
          </Link>
        )}
      </div>

      <Card className="flex flex-wrap items-center gap-3 p-4">
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOffset(0);
          }}
          placeholder="Filter by URL…"
          className="min-w-48 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
        />
        <div className="inline-flex rounded-lg border border-slate-200 p-0.5">
          {STATUSES.map((s) => (
            <button
              key={s || 'all'}
              onClick={() => {
                setStatus(s);
                setOffset(0);
              }}
              className={`rounded-md px-3 py-1.5 text-sm capitalize transition ${
                status === s ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {s || 'all'}
            </button>
          ))}
        </div>
      </Card>

      {error && <ErrorBox message={error} />}
      {loading && !data && <Spinner label="Loading pages…" />}

      {data && (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-3 font-medium">URL</th>
                  <th className="px-4 py-3 font-medium">Site</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">HTTP</th>
                  <th className="px-4 py-3 font-medium">Last crawled</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {data.data.map((page) => (
                  <tr key={page.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                    <td className="max-w-md truncate px-4 py-3 font-medium text-slate-700">{page.url}</td>
                    <td className="px-4 py-3 text-slate-500">{page.site?.name ?? page.siteId}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={page.status} />
                    </td>
                    <td className="px-4 py-3 tabular-nums text-slate-500">{page.httpStatus ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-slate-400">
                      {page.lastCrawledAt ? new Date(page.lastCrawledAt).toLocaleString() : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link to={`/pages/${page.id}`} className="text-xs font-medium text-brand-600 hover:underline">
                        View →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data.data.length === 0 && <Empty>No pages match these filters.</Empty>}
        </Card>
      )}

      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between text-sm text-slate-500">
          <span>
            {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} of {total}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
              disabled={offset === 0}
              className="rounded-md border border-slate-300 px-3 py-1.5 disabled:opacity-40"
            >
              Prev
            </button>
            <button
              onClick={() => setOffset(offset + PAGE_SIZE)}
              disabled={offset + PAGE_SIZE >= total}
              className="rounded-md border border-slate-300 px-3 py-1.5 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
