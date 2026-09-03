import { z } from 'zod';

/** Shared parameter schemas matching the data plane's query conventions. */

export const organisationIdParam = z
  .string()
  .min(1)
  .describe(
    'The organisation (practice) to read. Call list_organizations first to discover the ids this key may use; it is not configured on the server and cannot be guessed.'
  );

export const limitParam = z
  .number()
  .int()
  .min(1)
  .max(100)
  .optional()
  .describe('Results per page, 1-100. Defaults to 50. Larger values are clamped, not rejected.');

export const cursorParam = z
  .string()
  .min(1)
  .optional()
  .describe(
    "Opaque pagination cursor from the previous response's pagination.nextCursor. Omit for the first page; never construct one by hand."
  );

/** Drop undefined values so optional filters never reach the query string. */
export function compactParams(params: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(params).filter(([, value]) => value !== undefined));
}
