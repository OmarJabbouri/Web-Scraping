// A failure we WANT BullMQ to retry (transient: timeout, 429, 503, temporary domain cooldown).
// Throwing this lets the Phase-2 retry policy (attempts + exponential backoff w/ jitter) kick in.
export class RetryableError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'RetryableError';
  }
}

// A failure that will never succeed on retry (e.g. 404, disallowed by robots) — record and move on.
export class PermanentError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'PermanentError';
  }
}
