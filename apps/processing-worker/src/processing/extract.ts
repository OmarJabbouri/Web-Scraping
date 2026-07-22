import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import * as cheerio from 'cheerio';

/** The primary text extraction result for a page. */
export interface Extracted {
  /** Best-guess page title (Readability's, else <title>/<h1>). */
  title: string | null;
  /** Cleaned body text with boilerplate (scripts, nav, header, footer, aside) stripped. */
  text: string;
  /** True when Mozilla Readability recognised an article; false when we fell back to Cheerio. */
  usedReadability: boolean;
}

// Structural boilerplate that never belongs in the extracted text. Used by the Cheerio fallback
// (Readability strips these itself) and to compute the article-vs-listing signal.
const BOILERPLATE_SELECTORS = 'script, style, noscript, template, svg, nav, header, footer, aside';

/**
 * 4.1 — Boilerplate stripping.
 *
 * Prefer Mozilla Readability (the same extractor Firefox Reader View uses): given the page DOM it
 * finds the main article node and returns clean text, dropping chrome, ads, and navigation. It's
 * tuned for article-shaped pages though, so for listing/catalogue pages (e.g. books.toscrape.com
 * index pages) it often bails or returns too little. In that case we fall back to Cheerio: remove
 * the boilerplate elements and take the remaining body text.
 */
export function extractContent(html: string, url: string): Extracted {
  const readable = tryReadability(html, url);
  if (readable && readable.text.length >= MIN_READABLE_CHARS) return readable;

  // Fallback: Readability didn't find a confident article (short/listing/JS-shell page).
  const fallback = cheerioText(html);
  // Keep Readability's title if we got one — it's usually cleaner than the raw <title>.
  return { ...fallback, title: readable?.title ?? fallback.title };
}

// Below this, Readability's "article" is too thin to trust (nav-only shells, listing pages).
const MIN_READABLE_CHARS = 200;

function tryReadability(html: string, url: string): Extracted | null {
  try {
    // `url` gives Readability a base for resolving links and scoring; harmless if it can't parse.
    const dom = new JSDOM(html, { url });
    const article = new Readability(dom.window.document).parse();
    dom.window.close();
    if (!article) return null;
    const text = normalizeWhitespace(article.textContent ?? '');
    if (!text) return null;
    return { title: cleanTitle(article.title), text, usedReadability: true };
  } catch {
    // Malformed markup can trip jsdom/Readability — treat as "no article" and fall back.
    return null;
  }
}

function cheerioText(html: string): Extracted {
  const $ = cheerio.load(html);
  const title = cleanTitle($('title').first().text() || $('h1').first().text());
  $(BOILERPLATE_SELECTORS).remove();
  const body = $('main').length ? $('main') : $('body');
  const text = normalizeWhitespace(body.text());
  return { title, text, usedReadability: false };
}

/** Collapse runs of whitespace/newlines into single spaces and trim — DB-friendly, chunker-friendly. */
function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function cleanTitle(title: string | null | undefined): string | null {
  const t = (title ?? '').replace(/\s+/g, ' ').trim();
  return t.length ? t : null;
}
