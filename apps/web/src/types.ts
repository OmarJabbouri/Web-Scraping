/**
 * TypeScript mirrors of the API response shapes (Phase 6). Hand-kept in sync with the API routes;
 * small enough that a codegen step would cost more than it saves. Every list endpoint returns
 * `{ data, meta }`; single resources return `{ data }`.
 */

export interface Envelope<T> {
  data: T;
  meta?: Record<string, unknown>;
}

export interface ListMeta {
  total: number;
  limit: number;
  offset: number;
}

export type RenderMode = 'static' | 'js';
export type PageStatus = 'pending' | 'crawled' | 'failed' | 'skipped';
export type SearchMode = 'keyword' | 'semantic' | 'hybrid';

export interface Site {
  id: number;
  name: string;
  baseUrl: string;
  renderMode: RenderMode;
  crawlDelayMs: number;
  allowed: boolean;
  robotsTxtCached: boolean;
  pageCount: number;
  crawledCount: number;
}

export interface CrawlSession {
  id: number;
  siteId: number;
  status: 'running' | 'completed' | 'failed';
  maxDepth: number;
  maxPages: number;
  pagesCrawled: number;
  pagesSkipped: number;
  pagesFailed: number;
  startedAt: string;
  finishedAt: string | null;
  site?: Pick<Site, 'id' | 'name' | 'baseUrl'>;
}

export interface QueueCounts {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: number;
}

export interface Stats {
  totals: {
    sites: number;
    pages: number;
    pagesCrawled: number;
    pagesFailed: number;
    pagesSkipped: number;
    pagesPending: number;
    pageVersions: number;
    documents: number;
    chunks: number;
    chunksEmbedded: number;
    deadLetterJobs: number;
  } | null;
  queues: { name: string; counts: QueueCounts }[];
  recentCrawls: CrawlSession[];
}

export interface PageRow {
  id: number;
  siteId: number;
  url: string;
  status: PageStatus;
  contentHash: string | null;
  httpStatus: number | null;
  lastCrawledAt: string | null;
  site?: Pick<Site, 'id' | 'name' | 'baseUrl'>;
}

export interface PageVersionSummary {
  id: number;
  versionNo: number;
  contentHash: string;
  fetchedAt: string;
  rawHtmlLength: number;
}

export interface PageDetail extends PageRow {
  versions: PageVersionSummary[];
}

export interface RawPage {
  pageId: number;
  url: string;
  versionNo: number;
  contentHash: string;
  fetchedAt: string;
  httpStatus: number | null;
  rawHtml: string;
  documentId: number | null;
}

export interface DocumentChunk {
  id: number;
  chunkIndex: number;
  headingPath: string | null;
  text: string;
  tokenCount: number;
}

export interface DocumentDetail {
  id: number;
  title: string | null;
  contentType: string;
  cleanedText: string;
  structuredData: Record<string, unknown>;
  chunkCount: number;
  embeddedChunkCount: number;
  chunks: DocumentChunk[];
  pageVersion?: {
    id: number;
    versionNo: number;
    fetchedAt: string;
    page?: { id: number; url: string; site?: { id: number; name: string } };
  };
}

export interface RetrievedChunk {
  chunkId: number;
  documentId: number;
  url: string;
  title: string | null;
  headingPath: string | null;
  text: string;
  score: number;
}

export interface SearchResponse {
  data: RetrievedChunk[];
  meta: { query: string; mode: SearchMode; k: number; count: number; tookMs: number };
}

export interface Citation {
  marker: number;
  url: string;
  title: string | null;
  snippet: string;
}

export interface AskResponse {
  data: { answer: string; citations: Citation[]; mode: string };
  meta: {
    question: string;
    k: number;
    subQueries: string[] | null;
    retrieved: number;
    sources: number;
    tookMs: number;
  };
}
