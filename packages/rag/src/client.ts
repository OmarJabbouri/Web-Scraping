import OpenAI from 'openai';
import { loadConfig } from '@rag/shared';

/**
 * Shared, lazily-created OpenAI client for the retrieval + answer side of RAG.
 *
 * Both models are the ones locked in Decision D2. The client is created on first use so importing
 * this package (e.g. in tests that never call OpenAI) doesn't require a key.
 */
export const EMBEDDING_MODEL = 'text-embedding-3-small';
export const ANSWER_MODEL = 'gpt-4o-mini';

let client: OpenAI | null = null;

export function getOpenAI(): OpenAI {
  if (client) return client;
  const { OPENAI_API_KEY } = loadConfig();
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is required for RAG retrieval/answers. Add it to .env.');
  }
  client = new OpenAI({ apiKey: OPENAI_API_KEY });
  return client;
}
