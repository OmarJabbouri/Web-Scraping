import { countTokens, encode, decode } from './tokens.js';

/** A single chunk ready to be embedded and stored in the `chunks` table. */
export interface TextChunk {
  text: string;
  tokenCount: number;
  headingPath: string | null;
}

export interface ChunkOptions {
  /** Ideal chunk size in tokens. We stop adding sentences once a chunk reaches this. */
  targetTokens?: number;
  /** How much of the previous chunk to repeat at the start of the next (context continuity). */
  overlapTokens?: number;
  /** Hard ceiling: a single sentence longer than this is force-split by tokens. */
  maxTokens?: number;
}

// ~500-token chunks with ~12% overlap: big enough to hold a coherent idea, small enough that a
// retrieved chunk is mostly relevant to the query (less noise diluting the embedding). See the
// report's "chunking trade-offs" section for why this beats naive fixed-length splitting.
const DEFAULTS = { targetTokens: 500, overlapTokens: 60, maxTokens: 800 } as const;

/**
 * 5.1 — Deliberate, structure-aware chunking (NOT fixed-length).
 *
 * We split recursively by natural boundaries so a chunk never cuts mid-thought:
 *   paragraphs (blank line) → sentences → (last resort) a hard token split of a monster sentence.
 * Sentences are then greedily packed up to `targetTokens`, and each new chunk repeats the tail of
 * the previous one (`overlapTokens`) so an idea that straddles a boundary is still retrievable from
 * either side. `headingPath` (here, the page title) is carried onto every chunk as metadata for
 * citations.
 */
export function chunkDocument(
  text: string,
  headingPath: string | null,
  opts: ChunkOptions = {},
): TextChunk[] {
  const { targetTokens, overlapTokens, maxTokens } = { ...DEFAULTS, ...opts };
  const clean = text.trim();
  if (!clean) return [];

  // paragraph → sentence granularity, force-splitting any sentence bigger than the hard cap.
  const units: string[] = [];
  for (const paragraph of clean.split(/\n\s*\n/)) {
    const p = paragraph.trim();
    if (!p) continue;
    for (const sentence of splitSentences(p)) {
      if (countTokens(sentence) > maxTokens) units.push(...hardSplit(sentence, maxTokens));
      else units.push(sentence);
    }
  }

  const chunks: TextChunk[] = [];
  let current: string[] = [];
  let currentTokens = 0;

  const flush = (): void => {
    if (!current.length) return;
    const joined = current.join(' ').trim();
    if (joined) chunks.push({ text: joined, tokenCount: countTokens(joined), headingPath });
  };

  for (const unit of units) {
    const unitTokens = countTokens(unit);
    // Adding this unit would overflow the target → close the current chunk and seed the next one
    // with an overlapping tail of the sentences we just emitted.
    if (current.length && currentTokens + unitTokens > targetTokens) {
      flush();
      const tail = overlapTail(current, overlapTokens);
      current = tail.units;
      currentTokens = tail.tokens;
    }
    current.push(unit);
    currentTokens += unitTokens;
  }
  flush();

  return chunks;
}

/** Take sentences from the end of a chunk until we've collected ~`overlapTokens` worth. */
function overlapTail(sentences: string[], overlapTokens: number): { units: string[]; tokens: number } {
  const tail: string[] = [];
  let tokens = 0;
  for (let i = sentences.length - 1; i >= 0 && tokens < overlapTokens; i--) {
    const s = sentences[i];
    if (s === undefined) continue;
    tail.unshift(s);
    tokens += countTokens(s);
  }
  return { units: tail, tokens };
}

/**
 * Split a paragraph into sentences. A pragmatic regex (end punctuation followed by whitespace) —
 * not perfect on abbreviations, but chunk boundaries are forgiving and this needs no NLP model.
 */
function splitSentences(paragraph: string): string[] {
  const matches = paragraph.match(/[^.!?]+[.!?]+["')\]]*\s*|[^.!?]+$/g);
  const sentences = (matches ?? [paragraph]).map((s) => s.trim()).filter(Boolean);
  return sentences.length ? sentences : [paragraph];
}

/** Last resort: split a single over-long sentence into `maxTokens`-sized windows by token id. */
function hardSplit(sentence: string, maxTokens: number): string[] {
  const ids = encode(sentence);
  const pieces: string[] = [];
  for (let i = 0; i < ids.length; i += maxTokens) {
    pieces.push(decode(ids.slice(i, i + maxTokens)).trim());
  }
  return pieces.filter(Boolean);
}
