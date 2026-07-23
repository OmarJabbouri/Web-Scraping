import type {
  AskResponse,
  CrawlSession,
  DocumentDetail,
  Envelope,
  ListMeta,
  PageDetail,
  PageRow,
  RawPage,
  SearchMode,
  SearchResponse,
  Site,
  Stats,
} from './types';

/**
 * One typed client for the whole API. Everything is same-origin `/api/*` (Vite proxy in dev, nginx
 * in prod), so there is no base URL to configure. Errors are normalized to the API's JSON envelope
 * `{ error: { message } }` and thrown, so pages only handle a single `Error` shape.
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function toError(res: Response): Promise<ApiError> {
  let message = `${res.status} ${res.statusText}`;
  try {
    const body = (await res.json()) as { error?: { message?: string } };
    if (body.error?.message) message = body.error.message;
  } catch {
    /* non-JSON error body — keep the status line */
  }
  return new ApiError(res.status, message);
}

async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`/api${path}`, { signal });
  if (!res.ok) throw await toError(res);
  return res.json() as Promise<T>;
}

async function post<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) throw await toError(res);
  return res.json() as Promise<T>;
}

/** Build a query string, dropping undefined/empty values so the URL stays clean. */
function qs(params: Record<string, string | number | undefined>): string {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== '');
  if (!entries.length) return '';
  return '?' + entries.map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&');
}

export const api = {
  stats: (signal?: AbortSignal) => get<Envelope<Stats>>('/stats', signal).then((r) => r.data),

  sites: (signal?: AbortSignal) => get<Envelope<Site[]>>('/sites', signal).then((r) => r.data),

  crawl: (siteId: number, opts: { maxPages?: number; maxDepth?: number } = {}) =>
    post<Envelope<{ sessionId: number; status: string }>>(`/sites/${siteId}/crawl`, opts).then(
      (r) => r.data,
    ),

  crawls: (siteId: number, signal?: AbortSignal) =>
    get<Envelope<CrawlSession[]>>(`/sites/${siteId}/crawls`, signal).then((r) => r.data),

  pages: (
    params: { limit?: number; offset?: number; siteId?: number; status?: string; q?: string },
    signal?: AbortSignal,
  ) => get<Envelope<PageRow[]> & { meta: ListMeta }>(`/pages${qs(params)}`, signal),

  page: (id: number, signal?: AbortSignal) =>
    get<Envelope<PageDetail>>(`/pages/${id}`, signal).then((r) => r.data),

  rawPage: (id: number, version?: number, signal?: AbortSignal) =>
    get<Envelope<RawPage>>(`/pages/${id}/raw${qs({ version })}`, signal).then((r) => r.data),

  document: (id: number, signal?: AbortSignal) =>
    get<Envelope<DocumentDetail>>(`/documents/${id}`, signal).then((r) => r.data),

  search: (q: string, mode: SearchMode, k: number, signal?: AbortSignal) =>
    get<SearchResponse>(`/search${qs({ q, mode, k })}`, signal),

  ask: (question: string, k: number, subQueries: string[] | undefined, signal?: AbortSignal) =>
    post<AskResponse>('/ask', { question, k, ...(subQueries?.length ? { subQueries } : {}) }, signal),
};
