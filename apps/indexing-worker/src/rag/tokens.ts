import { getEncoding } from 'js-tiktoken';

/**
 * Token counting for chunk sizing (Phase 5.1).
 *
 * We size chunks in *tokens*, not characters, because that's the unit the embedding model and the
 * LLM actually bill and truncate on. `cl100k_base` is the BPE vocabulary used by
 * `text-embedding-3-small`, so counts here match what OpenAI charges for. The encoder is pure JS
 * (no native/wasm build) so it runs fine inside the Alpine worker container.
 */
const enc = getEncoding('cl100k_base');

export function countTokens(text: string): number {
  return enc.encode(text).length;
}

export function encode(text: string): number[] {
  return enc.encode(text);
}

export function decode(tokens: number[]): string {
  return enc.decode(tokens);
}
