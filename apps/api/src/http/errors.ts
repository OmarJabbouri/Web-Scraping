import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { ZodError } from 'zod';

/**
 * An error we deliberately surface to the client with a specific status code. Anything else that
 * escapes a handler is treated as a bug and reported as a generic 500 (never leaking internals).
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  static notFound(what: string): ApiError {
    return new ApiError(404, `${what} not found`);
  }

  static badRequest(message: string, details?: unknown): ApiError {
    return new ApiError(400, message, details);
  }
}

/**
 * Express 4 does not catch rejected promises from async handlers — an unhandled rejection would
 * hang the request instead of reaching the error middleware. Every async route is wrapped in this.
 * (Express 5 forwards them natively; this wrapper is what keeps us on the widely-deployed v4.)
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}

/** Terminal 404 for unmatched routes, so clients always get JSON rather than Express' HTML page. */
export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({ error: { message: `No route for ${req.method} ${req.path}` } });
};

/**
 * Single JSON error shape for the whole API: `{ error: { message, details? } }`.
 * Zod failures become 400 with the field-level issues attached so the UI can point at the input.
 */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  // Express identifies error middleware by arity — `next` must stay in the signature.
  _next: NextFunction,
): void {
  if (err instanceof ZodError) {
    res.status(400).json({ error: { message: 'Invalid request', details: err.issues } });
    return;
  }
  if (err instanceof ApiError) {
    res.status(err.status).json({ error: { message: err.message, details: err.details } });
    return;
  }
  console.error('[api] unhandled error', err);
  res.status(500).json({ error: { message: 'Internal server error' } });
}
