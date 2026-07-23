import type { Request } from 'express';
import type { z, ZodTypeAny } from 'zod';

/**
 * Parse one part of the request with a zod schema (task 6.7). Throwing the raw ZodError is
 * deliberate: `errorHandler` turns it into a 400 with the field-level issues, so validation stays
 * one line at each call site and the response shape stays consistent.
 *
 * Generic over the schema (not its output type) so the *output* type is inferred — with
 * `ZodSchema<T>` TypeScript infers T from the input side, which would make every `.default()`
 * field optional at the call site even though zod has already filled it in.
 */
export function parseQuery<S extends ZodTypeAny>(req: Request, schema: S): z.infer<S> {
  return schema.parse(req.query);
}

export function parseBody<S extends ZodTypeAny>(req: Request, schema: S): z.infer<S> {
  return schema.parse(req.body);
}

export function parseParams<S extends ZodTypeAny>(req: Request, schema: S): z.infer<S> {
  return schema.parse(req.params);
}
