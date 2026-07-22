import { getOpenAI, ANSWER_MODEL } from './client.js';
import { hybridSearch, type RetrievedChunk } from './retrieve.js';

export interface Citation {
  /** 1-based marker that matches the `[n]` used in the answer text. */
  marker: number;
  url: string;
  title: string | null;
  snippet: string;
}

export interface RagAnswer {
  answer: string;
  citations: Citation[];
  mode: 'hybrid';
}

// The whole point of RAG: the model answers strictly from retrieved sources and cites them, so the
// answer is grounded and auditable rather than invented. Low temperature keeps it faithful.
const SYSTEM_PROMPT = `You are a precise assistant answering questions using ONLY the numbered sources provided.
Rules:
- Use only facts found in the sources. Never rely on outside knowledge.
- After each claim, cite the source(s) it came from with bracket markers like [1] or [2][3].
- If the sources do not contain the answer, say you don't have enough information to answer.
- Be concise and factual.`;

/**
 * 5.5 — Retrieval-Augmented answer with inline citations.
 *
 * Retrieve the top-k chunks (hybrid), lay them out as a numbered source list, and ask gpt-4o-mini
 * to answer using only those, citing `[n]`. Returns the answer plus the citation list mapping each
 * marker to its source URL — the exact `{ answer, citations }` shape the API's `/ask` endpoint
 * returns in Phase 6.
 */
export async function answerQuestion(question: string, k = 5): Promise<RagAnswer> {
  return generateAnswer(question, await hybridSearch(question, k));
}

/**
 * Generate a cited answer from an already-retrieved set of chunks. Split out from `answerQuestion`
 * so callers that retrieved differently — e.g. multi-query retrieval for cross-source synthesis
 * (5.6) — can still get the same grounded, cited answer.
 */
export async function generateAnswer(question: string, chunks: RetrievedChunk[]): Promise<RagAnswer> {
  if (!chunks.length) {
    return {
      answer: "I don't have enough information in the indexed sources to answer that.",
      citations: [],
      mode: 'hybrid',
    };
  }

  const context = chunks
    .map((c, i) => `[${i + 1}] Source: ${c.url}\n${c.text}`)
    .join('\n\n');

  const res = await getOpenAI().chat.completions.create({
    model: ANSWER_MODEL,
    temperature: 0.2, // grounded + reproducible; top_p left at its default (tune one, not both)
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `Sources:\n${context}\n\nQuestion: ${question}` },
    ],
  });

  const answer = res.choices[0]?.message.content?.trim() ?? '';
  return { answer, citations: chunks.map(toCitation), mode: 'hybrid' };
}

function toCitation(chunk: RetrievedChunk, i: number): Citation {
  return {
    marker: i + 1,
    url: chunk.url,
    title: chunk.title,
    snippet: chunk.text.length > 160 ? `${chunk.text.slice(0, 160)}…` : chunk.text,
  };
}
