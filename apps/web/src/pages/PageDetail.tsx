import { useState } from 'react';
import { api } from '../api';
import { useAsync } from '../hooks';
import { Link } from '../router';
import { Card, ErrorBox, Pill, Spinner, StatusBadge } from '../components/ui';
import type { DocumentDetail, RawPage } from '../types';

type View = 'raw' | 'processed';

/** 7.4 (detail) — one page: its version history, the raw stored HTML, and the processed document. */
export function PageDetail({ id }: { id: number }) {
  const page = useAsync((signal) => api.page(id, signal), [id]);
  const [version, setVersion] = useState<number | undefined>(undefined);
  const [view, setView] = useState<View>('processed');

  // The raw endpoint returns both the stored HTML and the id of the document processed from it, so
  // one fetch drives both the "raw" view and the link into the "processed" view.
  const raw = useAsync((signal) => api.rawPage(id, version, signal), [id, version]);

  if (page.loading && !page.data) return <Spinner label="Loading page…" />;
  if (page.error) return <ErrorBox message={page.error} />;
  if (!page.data) return null;

  const p = page.data;
  const activeVersion = version ?? p.versions[0]?.versionNo;

  return (
    <div className="space-y-5">
      <div>
        <Link to="/pages" className="text-sm text-brand-600 hover:underline">
          ← All pages
        </Link>
      </div>

      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <a
              href={p.url}
              target="_blank"
              rel="noreferrer"
              className="break-all text-lg font-semibold text-slate-900 hover:text-brand-600"
            >
              {p.url} ↗
            </a>
            <div className="mt-1 flex items-center gap-2 text-sm text-slate-500">
              <StatusBadge status={p.status} />
              <span>{p.site?.name}</span>
              {p.httpStatus && <Pill>HTTP {p.httpStatus}</Pill>}
              <Pill>{p.versions.length} version{p.versions.length === 1 ? '' : 's'}</Pill>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-[220px_1fr]">
        <VersionList
          versions={p.versions}
          active={activeVersion}
          onSelect={(v) => setVersion(v)}
        />

        <div className="space-y-4">
          <div className="inline-flex rounded-lg border border-slate-200 p-0.5">
            {(['processed', 'raw'] as View[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`rounded-md px-4 py-1.5 text-sm font-medium capitalize transition ${
                  view === v ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {v === 'processed' ? 'Processed' : 'Raw HTML'}
              </button>
            ))}
          </div>

          {raw.loading && !raw.data && <Spinner label="Loading version…" />}
          {raw.error && <ErrorBox message={raw.error} />}
          {raw.data && view === 'raw' && <RawView raw={raw.data} />}
          {raw.data && view === 'processed' && <ProcessedView documentId={raw.data.documentId} />}
        </div>
      </div>
    </div>
  );
}

function VersionList({
  versions,
  active,
  onSelect,
}: {
  versions: { id: number; versionNo: number; contentHash: string; fetchedAt: string; rawHtmlLength: number }[];
  active: number | undefined;
  onSelect: (v: number) => void;
}) {
  return (
    <Card className="h-fit p-3">
      <div className="mb-2 px-2 text-xs font-medium uppercase tracking-wide text-slate-400">History</div>
      <div className="space-y-1">
        {versions.map((v) => (
          <button
            key={v.id}
            onClick={() => onSelect(v.versionNo)}
            className={`w-full rounded-lg px-3 py-2 text-left text-sm transition ${
              active === v.versionNo ? 'bg-brand-50 text-brand-700' : 'hover:bg-slate-50'
            }`}
          >
            <div className="font-medium">v{v.versionNo}</div>
            <div className="text-xs text-slate-400">{new Date(v.fetchedAt).toLocaleString()}</div>
            <div className="font-mono text-[10px] text-slate-400">
              {v.contentHash.slice(0, 10)}… · {(v.rawHtmlLength / 1024).toFixed(1)}kB
            </div>
          </button>
        ))}
        {!versions.length && <p className="px-3 py-2 text-sm text-slate-400">No versions.</p>}
      </div>
    </Card>
  );
}

function RawView({ raw }: { raw: RawPage }) {
  return (
    <Card className="p-4">
      <div className="mb-2 flex items-center justify-between text-xs text-slate-400">
        <span>
          v{raw.versionNo} · fetched {new Date(raw.fetchedAt).toLocaleString()}
        </span>
        <span className="font-mono">{raw.contentHash.slice(0, 16)}…</span>
      </div>
      <pre className="max-h-[28rem] overflow-auto rounded-lg bg-slate-900 p-4 text-xs leading-relaxed text-slate-100">
        {raw.rawHtml}
      </pre>
    </Card>
  );
}

function ProcessedView({ documentId }: { documentId: number | null }) {
  if (documentId === null) {
    return (
      <Card className="p-6">
        <p className="text-sm text-slate-500">
          This version has no processed document — it was skipped (e.g. unchanged content or a non-article
          page), so nothing was cleaned or indexed from it. Switch to <strong>Raw HTML</strong> to see what
          was stored.
        </p>
      </Card>
    );
  }
  return <DocumentBody documentId={documentId} />;
}

function DocumentBody({ documentId }: { documentId: number }) {
  const { data, error, loading } = useAsync((signal) => api.document(documentId, signal), [documentId]);
  if (loading && !data) return <Spinner label="Loading document…" />;
  if (error) return <ErrorBox message={error} />;
  if (!data) return null;

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Pill tone="brand">{data.contentType}</Pill>
          <Pill>{data.chunkCount} chunks</Pill>
          <Pill>{data.embeddedChunkCount} embedded</Pill>
          {data.title && <span className="text-sm font-medium text-slate-700">{data.title}</span>}
        </div>
        <div className="max-h-72 overflow-auto whitespace-pre-wrap text-sm leading-relaxed text-slate-600">
          {data.cleanedText}
        </div>
      </Card>

      <StructuredData data={data.structuredData} />
      <Chunks chunks={data.chunks} />
    </div>
  );
}

/** Renders the "more than one content type" extraction (tables + document links) generically. */
function StructuredData({ data }: { data: DocumentDetail['structuredData'] }) {
  const keys = Object.keys(data ?? {});
  if (!keys.length) return null;
  return (
    <Card className="p-5">
      <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
        Structured data (tables, links, …)
      </div>
      <pre className="max-h-72 overflow-auto rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
        {JSON.stringify(data, null, 2)}
      </pre>
    </Card>
  );
}

function Chunks({ chunks }: { chunks: DocumentDetail['chunks'] }) {
  if (!chunks.length) return null;
  return (
    <Card className="p-5">
      <div className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-500">
        Indexed chunks — {chunks.length}
      </div>
      <div className="space-y-2">
        {chunks.map((c) => (
          <div key={c.id} className="rounded-lg bg-slate-50 p-3 text-sm">
            <div className="mb-1 flex items-center justify-between text-xs text-slate-400">
              <span>chunk #{c.chunkIndex}{c.headingPath ? ` · ${c.headingPath}` : ''}</span>
              <span>{c.tokenCount} tokens</span>
            </div>
            <p className="text-slate-600">
              {c.text.length > 260 ? `${c.text.slice(0, 260)}…` : c.text}
            </p>
          </div>
        ))}
      </div>
    </Card>
  );
}
