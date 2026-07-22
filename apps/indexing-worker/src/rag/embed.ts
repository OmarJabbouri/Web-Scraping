import OpenAI from 'openai';
import { loadConfig } from '@rag/shared';

/**
 * 5.2 — Embeddings.
 *
 * An embedding turns a chunk of text into a 1536-number vector that captures its *meaning*: two
 * texts about the same topic land close together in that 1536-dimensional space, even if they share
 * no words. We store these vectors in the pgvector `embedding` column, and at query time we embed
 * the user's question the same way and find the nearest chunks by cosine distance. This is the
 * "retrieval" in Retrieval-Augmented Generation — no model training involved.
 */
export const EMBEDDING_MODEL = 'text-embedding-3-small';
export const EMBEDDING_DIMS = 1536; // must match chunks.embedding vector(1536)

// OpenAI accepts many inputs per request; batching keeps us well under rate limits and is far
// faster (and cheaper in round-trips) than one call per chunk.
const BATCH_SIZE = 100;

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (client) return client;
  const { OPENAI_API_KEY } = loadConfig();
  if (!OPENAI_API_KEY) {
    throw new Error(
      'OPENAI_API_KEY is required for the indexing worker (Phase 5 embeddings). Add it to .env.',
    );
  }
  client = new OpenAI({ apiKey: OPENAI_API_KEY });
  return client;
}

/**
 * Embed many texts, preserving input order. Returns one `number[]` (length 1536) per input.
 * Throws on API/network failure so BullMQ retries the whole job (Phase 2 backoff).
 */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  const vectors: number[][] = [];
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const res = await getClient().embeddings.create({ model: EMBEDDING_MODEL, input: batch });
    // The API echoes each result's `index`; sort by it so order is guaranteed even if reordered.
    const ordered = [...res.data].sort((a, b) => a.index - b.index);
    for (const item of ordered) vectors.push(item.embedding);
  }
  return vectors;
}
