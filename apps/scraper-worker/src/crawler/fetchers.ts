import type { RenderMode } from '@rag/db';
import { RetryableError } from './errors.js';

export const USER_AGENT = 'RagScraperBot/0.1 (+https://example.com/bot; educational project)';
const FETCH_TIMEOUT_MS = 20_000;

export interface FetchResult {
  status: number;
  html: string;
  finalUrl: string;
}

/**
 * 3.1 — two interchangeable fetchers behind one shape, chosen per site by `render_mode`:
 *   - staticFetcher: plain HTTP (Node's built-in fetch / undici). Fast + cheap; the right tool
 *     for server-rendered HTML like books.toscrape.com.
 *   - jsFetcher: a real headless browser (Playwright/Chromium) that runs the page's JavaScript.
 *     Needed for client-rendered sites like quotes.toscrape.com/js where the HTML is empty until
 *     scripts run. Much heavier, so we only use it when the site actually needs it.
 */
export function selectFetcher(renderMode: RenderMode): (url: string) => Promise<FetchResult> {
  return renderMode === 'js' ? jsFetch : staticFetch;
}

/** Map transient HTTP statuses to a retryable error so BullMQ backs off and retries. */
function assertFetchable(status: number, url: string): void {
  if (status === 429 || status === 503 || (status >= 500 && status < 600)) {
    throw new RetryableError(`transient HTTP ${status} for ${url}`, status);
  }
}

async function staticFetch(url: string): Promise<FetchResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'user-agent': USER_AGENT, accept: 'text/html,application/xhtml+xml' },
    });
    assertFetchable(res.status, url);
    const html = await res.text();
    return { status: res.status, html, finalUrl: res.url || url };
  } catch (err) {
    if (err instanceof RetryableError) throw err;
    // Network error / abort (timeout) — worth retrying.
    throw new RetryableError(`fetch failed for ${url}: ${(err as Error).message}`);
  } finally {
    clearTimeout(timer);
  }
}

// Playwright is imported lazily so the static path (and typechecking) doesn't require a browser
// binary to be present. The browser is launched once per process and reused across jobs.
let browserPromise: Promise<import('playwright').Browser> | null = null;
async function getBrowser(): Promise<import('playwright').Browser> {
  if (!browserPromise) {
    const { chromium } = await import('playwright');
    browserPromise = chromium.launch({ headless: true });
  }
  return browserPromise;
}

async function jsFetch(url: string): Promise<FetchResult> {
  const browser = await getBrowser();
  const context = await browser.newContext({ userAgent: USER_AGENT });
  const page = await context.newPage();
  try {
    const response = await page.goto(url, { waitUntil: 'networkidle', timeout: FETCH_TIMEOUT_MS });
    const status = response?.status() ?? 0;
    assertFetchable(status, url);
    // 3.3 (infinite scroll): scroll to the bottom repeatedly until height stops growing, so
    // lazy-loaded content is present in the HTML we capture.
    await autoScroll(page);
    const html = await page.content();
    return { status, html, finalUrl: page.url() };
  } catch (err) {
    if (err instanceof RetryableError) throw err;
    throw new RetryableError(`playwright failed for ${url}: ${(err as Error).message}`);
  } finally {
    await context.close();
  }
}

async function autoScroll(page: import('playwright').Page): Promise<void> {
  let previousHeight = 0;
  for (let i = 0; i < 20; i++) {
    const height = (await page.evaluate(() => document.body.scrollHeight)) as number;
    if (height === previousHeight) break;
    previousHeight = height;
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(400);
  }
}

/** Close the shared browser (called on graceful shutdown). */
export async function closeBrowser(): Promise<void> {
  if (browserPromise) {
    const browser = await browserPromise;
    await browser.close();
    browserPromise = null;
  }
}
