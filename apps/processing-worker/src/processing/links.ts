import * as cheerio from 'cheerio';

/** A link that points at a downloadable document (a third content type beyond text + tables). */
export interface DocumentLink {
  url: string;
  text: string;
  /** File kind inferred from the extension, e.g. `pdf`, `docx`, `csv`. */
  type: string;
}

// Extensions we treat as "documents" worth capturing separately from ordinary navigation links.
const DOCUMENT_EXTENSIONS = new Set([
  'pdf',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'ppt',
  'pptx',
  'csv',
  'tsv',
  'rtf',
  'odt',
  'ods',
  'odp',
  'txt',
  'json',
  'xml',
  'zip',
]);

/**
 * 4.2 — Extract links to downloadable documents, resolved to absolute URLs and de-duplicated.
 *
 * These are stored in `documents.structured_data.documentLinks`: they're the "attachments" of a
 * page (spec sheets, reports, datasets) and a distinct content type from prose and tables.
 */
export function extractDocumentLinks(html: string, pageUrl: string): DocumentLink[] {
  const $ = cheerio.load(html);
  const byUrl = new Map<string, DocumentLink>();

  $('a[href]').each((_i, el) => {
    const href = $(el).attr('href');
    if (!href) return;
    let abs: URL;
    try {
      abs = new URL(href, pageUrl);
    } catch {
      return; // mailto:, javascript:, malformed — ignore
    }
    if (abs.protocol !== 'http:' && abs.protocol !== 'https:') return;

    const ext = extensionOf(abs.pathname);
    if (!ext || !DOCUMENT_EXTENSIONS.has(ext)) return;

    abs.hash = '';
    const url = abs.toString();
    if (byUrl.has(url)) return;
    byUrl.set(url, { url, text: $(el).text().replace(/\s+/g, ' ').trim(), type: ext });
  });

  return [...byUrl.values()];
}

function extensionOf(pathname: string): string | null {
  const dot = pathname.lastIndexOf('.');
  if (dot === -1 || dot === pathname.length - 1) return null;
  return pathname.slice(dot + 1).toLowerCase();
}
