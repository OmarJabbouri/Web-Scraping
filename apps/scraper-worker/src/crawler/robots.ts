import robotsParser from 'robots-parser';
import type { Site } from '@rag/db';
import { USER_AGENT } from './fetchers.js';

// robots-parser ships loose types, so pin the shape we use ourselves.
interface Robots {
  isAllowed(url: string, ua?: string): boolean | undefined;
  getCrawlDelay(ua?: string): number | undefined;
}
const parseRobots = robotsParser as unknown as (url: string, body: string) => Robots;

// robots.txt rarely changes, so cache the parsed result per origin for the life of the process.
const cache = new Map<string, Robots>();

function originOf(url: string): string {
  return new URL(url).origin;
}

/**
 * 3.2 — fetch, cache, and (once) persist a site's robots.txt. If robots.txt can't be fetched we
 * fail *open* with an empty ruleset (allow all) — the safe default for a well-behaved bot that
 * still respects an explicit Disallow when one exists.
 */
export async function getRobots(site: Site, sampleUrl: string): Promise<Robots> {
  const origin = originOf(sampleUrl);
  const cached = cache.get(origin);
  if (cached) return cached;

  let body = '';
  try {
    const res = await fetch(`${origin}/robots.txt`, { headers: { 'user-agent': USER_AGENT } });
    if (res.ok) body = await res.text();
  } catch {
    body = '';
  }

  const robots = parseRobots(`${origin}/robots.txt`, body);
  cache.set(origin, robots);

  // Cache the raw text on the site row the first time we see it (useful for the compliance note).
  if (site.robotsTxt === null && body) {
    site.robotsTxt = body;
    await site.save({ fields: ['robotsTxt'] }).catch(() => {});
  }
  return robots;
}

/** Whether our bot is allowed to fetch this URL. Missing verdict ⇒ allowed. */
export function isAllowed(robots: Robots, url: string): boolean {
  return robots.isAllowed(url, USER_AGENT) ?? true;
}

/**
 * The crawl delay we should honor: the larger of the site's configured delay and any Crawl-delay
 * the site declares in robots.txt. Politeness = respect whichever is stricter.
 */
export function effectiveCrawlDelayMs(robots: Robots, siteCrawlDelayMs: number): number {
  const robotsDelaySec = robots.getCrawlDelay(USER_AGENT);
  const robotsDelayMs = typeof robotsDelaySec === 'number' ? robotsDelaySec * 1000 : 0;
  return Math.max(siteCrawlDelayMs, robotsDelayMs);
}
