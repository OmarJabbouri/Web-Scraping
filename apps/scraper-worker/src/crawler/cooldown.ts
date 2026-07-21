import type { Redis } from '@rag/shared';
import { RetryableError } from './errors.js';

/**
 * 3.6 — domain-level cooldown (a stand-in for "temporary IP block" handling). If a domain returns
 * several 403/429 responses in a short window, we assume it's rate-limiting or blocking us and put
 * the *whole domain* on ice for a while. State lives in Redis so all workers honor the same
 * cooldown (a block is a property of the site, not of one worker).
 */
const BLOCK_THRESHOLD = 3; // this many blocks…
const BLOCK_WINDOW_MS = 60_000; // …within this window…
const COOLDOWN_MS = 120_000; // …triggers this long a cooldown.

const cooldownKey = (domain: string) => `cooldown:domain:${domain}`;
const blockCountKey = (domain: string) => `blockcount:domain:${domain}`;

/** Throw (retryable) if the domain is currently cooling down, so the job backs off and retries later. */
export async function assertNotInCooldown(redis: Redis, domain: string): Promise<void> {
  const ttl = await redis.pttl(cooldownKey(domain));
  if (ttl > 0) {
    throw new RetryableError(`domain ${domain} in cooldown for ${Math.ceil(ttl / 1000)}s`);
  }
}

/** Record a block (403/429). Once the threshold is hit within the window, start a cooldown. */
export async function noteBlocked(redis: Redis, domain: string): Promise<void> {
  const key = blockCountKey(domain);
  const count = await redis.incr(key);
  if (count === 1) await redis.pexpire(key, BLOCK_WINDOW_MS);
  if (count >= BLOCK_THRESHOLD) {
    await redis.set(cooldownKey(domain), '1', 'PX', COOLDOWN_MS);
    await redis.del(key);
    console.warn(`[scraper-worker] domain ${domain} hit ${count} blocks — cooling down ${COOLDOWN_MS / 1000}s`);
  }
}
