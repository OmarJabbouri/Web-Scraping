import { describe, expect, it } from 'vitest';
import { askBody, idParam, listPagesQuery, rawPageQuery, searchQuery, startCrawlBody } from './schemas.js';

// These schemas are the API's whole input contract, so they are what CI is worth running: they
// encode the coercion (query strings → numbers) and the clamps that keep a client from asking for
// unbounded work. No database or network needed to verify any of it.

describe('idParam', () => {
  it('coerces a path string to a number', () => {
    expect(idParam.parse({ id: '42' })).toEqual({ id: 42 });
  });

  it.each(['0', '-1', 'abc', '1.5'])('rejects %s', (id) => {
    expect(idParam.safeParse({ id }).success).toBe(false);
  });
});

describe('listPagesQuery', () => {
  it('applies pagination defaults', () => {
    expect(listPagesQuery.parse({})).toMatchObject({ limit: 20, offset: 0 });
  });

  it('caps limit at 100 so one request cannot pull the whole table', () => {
    expect(listPagesQuery.safeParse({ limit: '101' }).success).toBe(false);
    expect(listPagesQuery.parse({ limit: '100' }).limit).toBe(100);
  });

  it('accepts the crawl statuses and rejects anything else', () => {
    expect(listPagesQuery.parse({ status: 'crawled' }).status).toBe('crawled');
    expect(listPagesQuery.safeParse({ status: 'done' }).success).toBe(false);
  });
});

describe('searchQuery', () => {
  it('defaults to hybrid mode with k=5', () => {
    expect(searchQuery.parse({ q: 'einstein' })).toEqual({ q: 'einstein', mode: 'hybrid', k: 5 });
  });

  it('requires a non-empty query', () => {
    expect(searchQuery.safeParse({}).success).toBe(false);
    expect(searchQuery.safeParse({ q: '   ' }).success).toBe(false);
  });

  it('rejects an unknown search mode', () => {
    expect(searchQuery.safeParse({ q: 'x', mode: 'fuzzy' }).success).toBe(false);
  });
});

describe('askBody', () => {
  it('keeps sub-queries for multi-source synthesis', () => {
    const parsed = askBody.parse({
      question: 'Which travel books are listed and what did Einstein say about life?',
      subQueries: ['travel books available', 'Einstein quote about life'],
    });
    expect(parsed.subQueries).toHaveLength(2);
    expect(parsed.k).toBe(5);
  });

  it('rejects a question that is too short', () => {
    expect(askBody.safeParse({ question: 'hi' }).success).toBe(false);
  });

  it('caps k so one question cannot stuff the LLM context', () => {
    expect(askBody.safeParse({ question: 'a valid question', k: 50 }).success).toBe(false);
  });
});

describe('rawPageQuery', () => {
  it('defaults to the JSON envelope and no pinned version', () => {
    expect(rawPageQuery.parse({})).toEqual({ format: 'json' });
  });

  it('accepts a historical version number', () => {
    expect(rawPageQuery.parse({ version: '2', format: 'html' })).toEqual({ version: 2, format: 'html' });
  });
});

describe('startCrawlBody', () => {
  it('falls back to the site defaults when the body is empty', () => {
    expect(startCrawlBody.parse(undefined)).toEqual({});
  });

  it('bounds the crawl budget', () => {
    expect(startCrawlBody.safeParse({ maxPages: 0 }).success).toBe(false);
    expect(startCrawlBody.safeParse({ maxDepth: 11 }).success).toBe(false);
    expect(startCrawlBody.parse({ maxDepth: '3', maxPages: '200' })).toEqual({ maxDepth: 3, maxPages: 200 });
  });
});
