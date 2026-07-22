import { getOpenAI, EMBEDDING_MODEL } from './client.js';

/**
 * Embed a search query into the SAME 1536-d space the chunks were embedded into (Phase 5.3).
 * Retrieval only works because the question and the stored chunks are measured with the identical
 * model — that's what makes "nearest vector" mean "closest in meaning".
 */
export async function embedQuery(text: string): Promise<number[]> {
  const res = await getOpenAI().embeddings.create({ model: EMBEDDING_MODEL, input: text });
  const first = res.data[0];
  if (!first) throw new Error('OpenAI returned no embedding for the query');
  return first.embedding;
}

/** Format a JS number[] as a pgvector literal, e.g. `[0.1,0.2,...]`, for `::vector` casts in SQL. */
export function toVectorLiteral(vector: number[]): string {
  return `[${vector.join(',')}]`;
}
