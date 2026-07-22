import * as cheerio from 'cheerio';

/** One HTML table normalized to structured JSON (stored in `documents.structured_data`). */
export interface ExtractedTable {
  caption: string | null;
  /** Column headers. Empty for key-value tables, where each row is a `[label, ...values]` pair. */
  headers: string[];
  rows: string[][];
}

/**
 * 4.2 — Extract HTML `<table>`s as structured JSON (a second content type beyond body text).
 *
 * Handles the two shapes that actually show up on the target sites:
 *   - Column tables: a header row (`<thead>` or an all-`<th>` first row) followed by data rows.
 *   - Key-value tables: every row leads with a `<th>` label (e.g. books.toscrape's "Product
 *     Information" table — UPC, Price, Availability). These have no column header, so we emit
 *     `headers: []` and keep each row as `[label, value]`.
 * Layout tables with a single cell are ignored — they're almost always page scaffolding.
 */
export function extractTables(html: string): ExtractedTable[] {
  const $ = cheerio.load(html);
  const tables: ExtractedTable[] = [];

  const cellsOf = (row: cheerio.Cheerio<never>): string[] =>
    row
      .first()
      .find('th, td')
      .toArray()
      .map((c) => cellText($(c).text()));

  const leadsWithTh = (row: cheerio.Cheerio<never>): boolean => row.children().first().is('th');

  $('table').each((_i, el) => {
    const $table = $(el);
    const caption = cellText($table.children('caption').first().text()) || null;
    const $rows = $table.find('tr');
    if (!$rows.length) return;

    let headers: string[];
    let $bodyRows: typeof $rows;

    const $thead = $table.find('thead tr').first();
    const dataRows = $rows.toArray();
    const everyRowLeadsWithTh =
      dataRows.length > 1 && dataRows.every((r) => leadsWithTh($(r) as cheerio.Cheerio<never>));

    if (everyRowLeadsWithTh && !$thead.length) {
      // Key-value layout: no column header, every row is a label→value(s) pair.
      headers = [];
      $bodyRows = $rows;
    } else if ($thead.length) {
      headers = cellsOf($thead as cheerio.Cheerio<never>);
      const $tbodyRows = $table.find('tbody tr');
      $bodyRows = ($tbodyRows.length
        ? $tbodyRows
        : $rows.filter((_j, r) => $(r).parents('thead').length === 0)) as typeof $rows;
    } else {
      // Plain table: first row is the header, the rest are data.
      headers = cellsOf($rows.first() as cheerio.Cheerio<never>);
      $bodyRows = $rows.slice(1) as typeof $rows;
    }

    const rows: string[][] = [];
    $bodyRows.each((_j, tr) => {
      const cells = cellsOf($(tr) as cheerio.Cheerio<never>);
      if (cells.length) rows.push(cells);
    });

    // Skip layout/scaffolding tables that carry no real tabular data.
    if (headers.length <= 1 && rows.every((r) => r.length <= 1)) return;

    tables.push({ caption, headers, rows });
  });

  return tables;
}

function cellText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}
