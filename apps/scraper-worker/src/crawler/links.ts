import * as cheerio from 'cheerio';

/**
 * 3.3 — extract same-domain links from an HTML page and normalize them.
 *
 * Normalization matters for deduplication: `/page`, `/page#top`, and `/page?x=1` might all be the
 * same document, and relative hrefs (`../book.html`) must be resolved against the page URL. We:
 *   - resolve every href against the page's URL (handles relative links);
 *   - keep only http(s) links on the *same host* (we don't crawl the whole internet);
 *   - drop the fragment (`#...`) so anchors don't create duplicate URLs;
 *   - de-duplicate within the page.
 */
export function extractSameDomainLinks(html: string, pageUrl: string): string[] {
  const $ = cheerio.load(html);
  const host = new URL(pageUrl).host;
  const found = new Set<string>();

  $('a[href]').each((_i, el) => {
    const href = $(el).attr('href');
    if (!href) return;
    try {
      const abs = new URL(href, pageUrl);
      if (abs.protocol !== 'http:' && abs.protocol !== 'https:') return;
      if (abs.host !== host) return;
      abs.hash = '';
      found.add(abs.toString());
    } catch {
      // ignore malformed hrefs (mailto:, javascript:, etc.)
    }
  });

  return [...found];
}
