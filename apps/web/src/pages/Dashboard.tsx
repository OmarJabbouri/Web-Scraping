import { useCallback, useState } from 'react';
import { api } from '../api';
import { usePoll } from '../hooks';
import { Link } from '../router';
import { Card, ErrorBox, Pill, Spinner } from '../components/ui';
import type { QueueCounts, Site, Stats } from '../types';

const POLL_MS = 4000;

/** 7.1 — Dashboard. Polls `/api/stats` every few seconds for live queue + pipeline numbers. */
export function Dashboard() {
  const { data, error, loading, refreshing } = usePoll<Stats>((signal) => api.stats(signal), POLL_MS);
  const sitesQuery = usePoll<Site[]>((signal) => api.sites(signal), POLL_MS);

  if (loading && !data) return <Spinner label="Loading dashboard…" />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
        <LiveIndicator refreshing={refreshing} />
      </div>

      {error && <ErrorBox message={error} />}

      {data?.totals && <Totals totals={data.totals} />}

      <div className="grid gap-6 lg:grid-cols-2">
        <QueuePanel queues={data?.queues ?? []} />
        <RecentCrawls crawls={data?.recentCrawls ?? []} />
      </div>

      <SitesPanel sites={sitesQuery.data ?? []} onCrawled={() => sitesQuery.refresh()} />
    </div>
  );
}

function LiveIndicator({ refreshing }: { refreshing: boolean }) {
  return (
    <div className="flex items-center gap-2 text-xs text-slate-500">
      <span className={`h-2 w-2 rounded-full bg-emerald-500 ${refreshing ? 'live-dot' : ''}`} />
      live · auto-refresh {POLL_MS / 1000}s
    </div>
  );
}

function Totals({ totals }: { totals: NonNullable<Stats['totals']> }) {
  const embedPct = totals.chunks ? Math.round((totals.chunksEmbedded / totals.chunks) * 100) : 0;
  const tiles: { label: string; value: number | string; hint?: string }[] = [
    { label: 'Sites', value: totals.sites },
    { label: 'Pages crawled', value: totals.pagesCrawled, hint: `${totals.pages} discovered` },
    { label: 'Page versions', value: totals.pageVersions, hint: 'immutable history' },
    { label: 'Documents', value: totals.documents, hint: 'cleaned + normalized' },
    { label: 'Chunks embedded', value: `${totals.chunksEmbedded}/${totals.chunks}`, hint: `${embedPct}% indexed` },
    { label: 'Dead-letter', value: totals.deadLetterJobs, hint: 'permanently failed' },
  ];
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
      {tiles.map((t) => (
        <Card key={t.label} className="p-4">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-400">{t.label}</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{t.value}</div>
          {t.hint && <div className="mt-0.5 text-xs text-slate-400">{t.hint}</div>}
        </Card>
      ))}
    </div>
  );
}

const QUEUE_LABELS: Record<string, string> = {
  scrape: 'Scrape',
  process: 'Process',
  index: 'Index',
  'dead-letter': 'Dead-letter',
};

function QueuePanel({ queues }: { queues: Stats['queues'] }) {
  return (
    <Card className="p-5">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Queues (Redis / BullMQ)</h2>
      <div className="space-y-3">
        {queues.map((q) => (
          <QueueRow key={q.name} name={QUEUE_LABELS[q.name] ?? q.name} counts={q.counts} />
        ))}
        {!queues.length && <p className="text-sm text-slate-400">No queue data.</p>}
      </div>
    </Card>
  );
}

function QueueRow({ name, counts }: { name: string; counts: QueueCounts }) {
  const cells: { label: string; value: number; className: string }[] = [
    { label: 'waiting', value: counts.waiting, className: 'text-slate-600' },
    { label: 'active', value: counts.active, className: 'text-brand-600 font-semibold' },
    { label: 'done', value: counts.completed, className: 'text-emerald-600' },
    { label: 'failed', value: counts.failed, className: 'text-red-600' },
  ];
  return (
    <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
      <span className="text-sm font-medium text-slate-700">{name}</span>
      <div className="flex gap-4">
        {cells.map((c) => (
          <div key={c.label} className="text-center">
            <div className={`text-sm tabular-nums ${c.className}`}>{c.value}</div>
            <div className="text-[10px] uppercase text-slate-400">{c.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RecentCrawls({ crawls }: { crawls: Stats['recentCrawls'] }) {
  return (
    <Card className="p-5">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Recent crawls</h2>
      <div className="space-y-2">
        {crawls.map((c) => (
          <div key={c.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
            <div className="min-w-0">
              <div className="truncate font-medium text-slate-700">{c.site?.name ?? `Site ${c.siteId}`}</div>
              <div className="text-xs text-slate-400">
                {c.pagesCrawled} crawled · {c.pagesSkipped} skipped · {c.pagesFailed} failed
              </div>
            </div>
            <Pill tone={c.status === 'completed' ? 'brand' : c.status === 'failed' ? 'slate' : 'js'}>
              {c.status}
            </Pill>
          </div>
        ))}
        {!crawls.length && <p className="text-sm text-slate-400">No crawls yet.</p>}
      </div>
    </Card>
  );
}

function SitesPanel({ sites, onCrawled }: { sites: Site[]; onCrawled: () => void }) {
  return (
    <Card className="p-5">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Sites</h2>
      <div className="grid gap-3 md:grid-cols-3">
        {sites.map((site) => (
          <SiteCard key={site.id} site={site} onCrawled={onCrawled} />
        ))}
        {!sites.length && <p className="text-sm text-slate-400">No sites seeded.</p>}
      </div>
    </Card>
  );
}

function SiteCard({ site, onCrawled }: { site: Site; onCrawled: () => void }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const startCrawl = useCallback(async () => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await api.crawl(site.id, {});
      setMsg(`Crawl #${res.sessionId} started`);
      onCrawled();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Failed to start');
    } finally {
      setBusy(false);
    }
  }, [site.id, onCrawled]);

  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate font-medium text-slate-800">{site.name}</div>
          <div className="truncate text-xs text-slate-400">{site.baseUrl}</div>
        </div>
        <Pill tone={site.renderMode === 'js' ? 'js' : 'slate'}>{site.renderMode}</Pill>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <Link to={`/pages?siteId=${site.id}`} className="text-xs text-brand-600 hover:underline">
          {site.crawledCount}/{site.pageCount} pages →
        </Link>
        <button
          onClick={startCrawl}
          disabled={busy || !site.allowed}
          className="rounded-md bg-brand-600 px-3 py-1 text-xs font-medium text-white transition hover:bg-brand-700 disabled:opacity-50"
        >
          {busy ? 'Starting…' : 'Crawl'}
        </button>
      </div>
      {msg && <div className="mt-2 text-xs text-slate-500">{msg}</div>}
    </div>
  );
}
