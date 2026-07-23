import { useEffect, useState, type ReactNode } from 'react';

/**
 * A ~40-line hash router. Hash routing (`#/search`) needs no server-side rewrite, so it works
 * identically under the Vite dev server and the static nginx container without extra config — and
 * it keeps the UI dependency-free (no react-router) for a "basic interface". Enough for four pages
 * plus a `/pages/:id` param.
 */
/** Split the hash into pathname + query, e.g. `#/pages?siteId=3` → { pathname:'/pages', search:'siteId=3' }. */
function readHash(): { pathname: string; search: string } {
  const raw = window.location.hash.replace(/^#/, '');
  const [path, search = ''] = raw.split('?');
  const pathname = !path ? '/' : path.startsWith('/') ? path : `/${path}`;
  return { pathname, search };
}

/** Subscribe to hash changes; re-renders on navigation. Returns the current pathname (no query). */
export function useRoute(): string {
  const [hash, setHash] = useState(readHash);
  useEffect(() => {
    const onChange = () => setHash(readHash());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return hash.pathname;
}

/** Read a single query-string param out of the current hash (e.g. `?siteId=3`). */
export function useQueryParam(key: string): string | null {
  const [hash, setHash] = useState(readHash);
  useEffect(() => {
    const onChange = () => setHash(readHash());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return new URLSearchParams(hash.search).get(key);
}

export function navigate(to: string): void {
  window.location.hash = to;
}

/** Match a route like `/pages/:id` against the current path, returning captured params or null. */
export function matchRoute(pattern: string, path: string): Record<string, string> | null {
  const p = pattern.split('/').filter(Boolean);
  const a = path.split('/').filter(Boolean);
  if (p.length !== a.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < p.length; i++) {
    const seg = p[i]!;
    const val = a[i]!;
    if (seg.startsWith(':')) params[seg.slice(1)] = decodeURIComponent(val);
    else if (seg !== val) return null;
  }
  return params;
}

export function Link({
  to,
  className,
  children,
  onClick,
}: {
  to: string;
  className?: string;
  children: ReactNode;
  onClick?: () => void;
}) {
  return (
    <a href={`#${to}`} className={className} onClick={onClick}>
      {children}
    </a>
  );
}
