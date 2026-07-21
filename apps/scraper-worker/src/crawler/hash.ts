import { createHash } from 'node:crypto';

// 3.4 — a SHA-256 fingerprint of the page content. Re-crawling a page whose hash is unchanged
// means nothing new to process, so we can skip the expensive downstream steps (incremental
// re-crawls). 64 hex chars → matches the CHAR(64) columns on pages / page_versions.
export function sha256(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}
