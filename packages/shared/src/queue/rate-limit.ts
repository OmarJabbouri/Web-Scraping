import type { Redis } from 'ioredis';

/**
 * Per-domain rate limiting (task 2.4) — a distributed, politeness-focused limiter.
 *
 * The requirement is to honor each site's `crawl_delay_ms`: never hit the same domain more often
 * than once per delay window, *even with many workers running in parallel*. A plain per-process
 * timer can't do that — four scaled containers would each keep their own clock and collectively
 * quadruple the request rate. So the state lives in Redis, shared by all workers.
 *
 * Model: for each domain we store the timestamp of the *next* allowed request. A worker asks for a
 * slot; the Lua script atomically claims the next free slot and tells the worker how long to wait
 * before using it. Because the read-modify-write runs inside Redis as one script, concurrent
 * workers get serialized, evenly-spaced slots with no race.
 */

const KEY_PREFIX = 'ratelimit:domain:';

// KEYS[1] = domain key, ARGV[1] = now (ms), ARGV[2] = delay (ms).
// Returns the number of ms the caller should sleep before making its request.
const RESERVE_SLOT_LUA = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local delay = tonumber(ARGV[2])
local next_at = tonumber(redis.call('GET', key) or '0')
local slot = math.max(now, next_at)
redis.call('SET', key, slot + delay, 'PX', delay * 4 + 1000)
return slot - now
`;

/** Extract the domain (host) used as the rate-limit key. Falls back to the raw string if unparseable. */
export function domainOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

/**
 * Reserve the next request slot for a domain and return how many ms to wait before using it.
 * Does not sleep — see {@link waitForDomainSlot} for the blocking variant.
 */
export async function reserveDomainSlot(
  redis: Redis,
  domain: string,
  crawlDelayMs: number,
): Promise<number> {
  const waitMs = (await redis.eval(
    RESERVE_SLOT_LUA,
    1,
    `${KEY_PREFIX}${domain}`,
    Date.now().toString(),
    Math.max(0, crawlDelayMs).toString(),
  )) as number;
  return waitMs;
}

/**
 * Block until this worker is allowed to hit `domain` again, respecting `crawlDelayMs` globally.
 * Call this right before fetching a URL in the scraper worker (Phase 3).
 */
export async function waitForDomainSlot(
  redis: Redis,
  domain: string,
  crawlDelayMs: number,
): Promise<void> {
  const waitMs = await reserveDomainSlot(redis, domain, crawlDelayMs);
  if (waitMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }
}
