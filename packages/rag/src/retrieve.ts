import { sequelize } from '@rag/db';
import { QueryTypes } from 'sequelize';
import { embedQuery, toVectorLiteral } from './embed.js';

/** One chunk returned by a search, joined back to its source page for citation. */
export interface RetrievedChunk {
  chunkId: number;
  documentId: number;
  url: string;
  title: string | null;
  headingPath: string | null;
  text: string;
  /** Meaning depends on the search: cosine similarity, ts_rank, or fused RRF score. */
  score: number;
}

export type SearchMode = 'semantic' | 'keyword' | 'hybrid';

// Every search returns the same shape, so it always resolves the chunk back to a source URL/title.
const SELECT_JOINS = `
  FROM chunks c
  JOIN documents d ON d.id = c.document_id
  JOIN page_versions pv ON pv.id = d.page_version_id
  JOIN pages p ON p.id = pv.page_id
`;

/**
 * 5.3 — Semantic (vector) search. Embed the query, then let pgvector find the chunks whose
 * embeddings are closest by cosine distance (`<=>`). Uses the HNSW index for speed. `score` is
 * cosine similarity in [0,1] (1 = identical direction), i.e. `1 - distance`.
 */
export async function vectorSearch(query: string, k = 5): Promise<RetrievedChunk[]> {
  const qvec = toVectorLiteral(await embedQuery(query));
  return sequelize.query<RetrievedChunk>(
    `SELECT c.id AS "chunkId", c.document_id AS "documentId", p.url, d.title,
            c.heading_path AS "headingPath", c.text,
            1 - (c.embedding <=> :qvec::vector) AS score
     ${SELECT_JOINS}
     WHERE c.embedding IS NOT NULL
     ORDER BY c.embedding <=> :qvec::vector
     LIMIT :k`,
    { replacements: { qvec, k }, type: QueryTypes.SELECT },
  );
}

/**
 * 5.4 (half) — Keyword (full-text) search over the generated `content_tsv` column, ranked by
 * `ts_rank`. Catches exact terms (names, codes, prices) that semantic search can miss.
 *
 * We build the tsquery as an OR of the query's lexemes, not the default AND. `plainto_tsquery`
 * stems and ANDs every word ("travel & book & avail & cost"), so one absent term drops the whole
 * match — fatal for natural-language questions. Casting it to text and swapping `&`→`|` turns it
 * into "travel | book | avail | cost": any term can match, and `ts_rank` still floats chunks that
 * hit MORE terms to the top. Exactly the recall behaviour hybrid search wants from its keyword arm.
 */
export async function keywordSearch(query: string, k = 5): Promise<RetrievedChunk[]> {
  return sequelize.query<RetrievedChunk>(
    `WITH q AS (
       SELECT NULLIF(replace(plainto_tsquery('english', :q)::text, ' & ', ' | '), '')::tsquery AS tsq
     )
     SELECT c.id AS "chunkId", c.document_id AS "documentId", p.url, d.title,
            c.heading_path AS "headingPath", c.text,
            ts_rank(c.content_tsv, q.tsq) AS score
     ${SELECT_JOINS}
     CROSS JOIN q
     WHERE q.tsq IS NOT NULL AND c.content_tsv @@ q.tsq
     ORDER BY score DESC
     LIMIT :k`,
    { replacements: { q: query, k }, type: QueryTypes.SELECT },
  );
}

// Reciprocal Rank Fusion constant. 60 is the value from the original RRF paper; it dampens the
// influence of any single list's top ranks so the two rankings blend smoothly.
const RRF_K = 60;

/**
 * Reciprocal Rank Fusion of several ranked lists. Each chunk scores the sum of `1/(RRF_K + rank)`
 * over every list it appears in, so chunks ranked highly by multiple lists rise to the top. RRF
 * needs no score normalization between lists (cosine vs ts_rank vs different queries), which is why
 * it fuses both search *modes* and multiple *queries* with the same code.
 */
export function rrfMerge(lists: RetrievedChunk[][], k: number): RetrievedChunk[] {
  const byId = new Map<number, RetrievedChunk>();
  const fused = new Map<number, number>();
  for (const list of lists) {
    list.forEach((chunk, rank) => {
      byId.set(chunk.chunkId, chunk);
      fused.set(chunk.chunkId, (fused.get(chunk.chunkId) ?? 0) + 1 / (RRF_K + rank + 1));
    });
  }
  return [...fused.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, k)
    .map(([chunkId, score]) => {
      const chunk = byId.get(chunkId);
      if (!chunk) throw new Error(`fused chunk ${chunkId} missing`);
      return { ...chunk, score };
    });
}

/**
 * 5.4 — Hybrid search: fuse semantic (vector) and keyword (full-text) rankings for one query. A
 * chunk ranked highly by *both* rises to the top, combining "means the same" with "says the same".
 */
export async function hybridSearch(query: string, k = 5): Promise<RetrievedChunk[]> {
  const pool = Math.max(k, 10); // pull a deeper list from each before fusing
  const [semantic, keyword] = await Promise.all([
    vectorSearch(query, pool),
    keywordSearch(query, pool),
  ]);
  return rrfMerge([semantic, keyword], k);
}

/**
 * Multi-query retrieval — the key to multi-source synthesis (5.6). A single question with two
 * disjoint intents ("travel books" + "a life quote") produces one averaged embedding that only
 * matches the dominant intent, starving the other. Instead we hybrid-search each sub-query
 * separately and RRF-merge the results, so every intent contributes its own best chunks — which is
 * how an answer ends up spanning multiple sites.
 */
export async function multiHybridSearch(queries: string[], k = 8): Promise<RetrievedChunk[]> {
  const pool = Math.max(k, 10);
  const perQuery = await Promise.all(queries.map((q) => hybridSearch(q, pool)));
  return rrfMerge(perQuery, k);
}

/** Dispatch by mode — the shape the API's `/search?mode=` endpoint will call in Phase 6. */
export function search(query: string, mode: SearchMode, k = 5): Promise<RetrievedChunk[]> {
  if (mode === 'semantic') return vectorSearch(query, k);
  if (mode === 'keyword') return keywordSearch(query, k);
  return hybridSearch(query, k);
}
