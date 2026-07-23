import { useCallback, useEffect, useRef, useState } from 'react';

export interface AsyncState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
}

/**
 * Run an async fetch tied to `deps`, exposing `{ data, error, loading }` plus a `reload()`.
 *
 * Every run gets an AbortController and a generation guard, so if deps change (or the component
 * unmounts) mid-flight, the stale response is dropped instead of overwriting fresher state — the
 * classic React data-fetching race. `fn` receives the signal so the underlying fetch is cancelled.
 */
export function useAsync<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  deps: unknown[],
): AsyncState<T> & { reload: () => void } {
  const [state, setState] = useState<AsyncState<T>>({ data: null, error: null, loading: true });
  const [nonce, setNonce] = useState(0);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    const controller = new AbortController();
    setState((s) => ({ ...s, loading: true, error: null }));
    fnRef
      .current(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setState({ data, error: null, loading: false });
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setState({ data: null, error: err instanceof Error ? err.message : String(err), loading: false });
      });
    return () => controller.abort();
  }, [...deps, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { ...state, reload };
}

/**
 * Poll `fn` every `intervalMs` (task 7.1's "real-time data access"). Keeps the last good data
 * visible across refreshes so the dashboard never flickers to a spinner while polling, and pauses
 * automatically when the browser tab is hidden to avoid burning the API rate limit in the
 * background. Returns `refreshing` so the UI can show a subtle live indicator.
 */
export function usePoll<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  intervalMs: number,
): AsyncState<T> & { refreshing: boolean; refresh: () => void } {
  const [state, setState] = useState<AsyncState<T>>({ data: null, error: null, loading: true });
  const [refreshing, setRefreshing] = useState(false);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const run = useCallback(async (signal: AbortSignal) => {
    setRefreshing(true);
    try {
      const data = await fnRef.current(signal);
      if (!signal.aborted) setState({ data, error: null, loading: false });
    } catch (err) {
      if (!signal.aborted) {
        // Keep prior data on a transient failure; only surface the error text.
        setState((s) => ({ ...s, error: err instanceof Error ? err.message : String(err), loading: false }));
      }
    } finally {
      if (!signal.aborted) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void run(controller.signal);
    const timer = window.setInterval(() => {
      if (!document.hidden) void run(controller.signal);
    }, intervalMs);
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, [intervalMs, run]);

  const refresh = useCallback(() => {
    const controller = new AbortController();
    void run(controller.signal);
  }, [run]);

  return { ...state, refreshing, refresh };
}
