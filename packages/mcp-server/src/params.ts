import { z } from 'zod';

/** Shared query parameter schemas matching the v1 data API conventions. */

export const limitParam = z
  .number()
  .int()
  .min(1)
  .max(100)
  .default(50)
  .describe('Maximum number of results per page (1-100, default 50)');

export const cursorParam = z
  .string()
  .min(1)
  .optional()
  .describe(
    "Opaque pagination cursor from the previous response's pagination.nextCursor. Omit for the first page. Do not construct cursors manually."
  );

export function isoDateTimeParam(description: string) {
  return z.string().datetime({ offset: true }).optional().describe(description);
}

export function uuidParam(description: string) {
  return z.string().uuid().describe(description);
}

/** Drop undefined values so optional filters never appear in the query string. */
export function compactParams(params: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(params).filter(([, value]) => value !== undefined));
}
