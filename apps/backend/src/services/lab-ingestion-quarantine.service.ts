import { prisma } from "src/config/prisma";

/**
 * Results a provider sent that we could not apply, and which are therefore
 * waiting on a human.
 *
 * This is the operator half of the quarantine: without it, "ingestion has a
 * stuck row" exists only as a `logger.error` line, and nobody finds out until a
 * clinic asks where a result went.
 */

const DEFAULT_PROVIDER = "IDEXX";

// A bounded read on purpose. This is a list endpoint over a table that grows
// with provider mistakes, and an unbounded one is the defect recorded in #2709.
// `total` is reported separately so a truncated page is visible as truncated
// rather than looking like the whole picture.
const MAX_ROWS = 200;

export type QuarantinedResultSummary = {
  id: string;
  provider: string;
  batchId: string;
  resultId: string | null;
  orderId: string | null;
  labOrderId: string | null;
  organisationId: string | null;
  reason: string;
  externalStatus: string | null;
  statusDetail: string | null;
  modality: string | null;
  createdAt: Date;
};

export const LabIngestionQuarantineService = {
  /**
   * Unresolved rows, oldest first - the oldest is the one that has been waiting
   * longest, which is the one an operator wants to see at the top.
   *
   * The provider `payload` is deliberately NOT selected. This endpoint is
   * super-admin and therefore cross-tenant, and the payload is the raw provider
   * body: patient name, client name, clinical detail. Everything needed to
   * decide "which status value is missing from the mapper" is in the columns
   * below, so reading the payload is not required to act on one of these.
   */
  async listUnresolved(provider: string = DEFAULT_PROVIDER): Promise<{
    total: number;
    returned: number;
    results: QuarantinedResultSummary[];
  }> {
    const where = { provider, resolvedAt: null };

    const [total, rows] = await Promise.all([
      prisma.labResultQuarantine.count({ where }),
      prisma.labResultQuarantine.findMany({
        where,
        orderBy: { createdAt: "asc" },
        take: MAX_ROWS,
        select: {
          id: true,
          provider: true,
          batchId: true,
          resultId: true,
          orderId: true,
          labOrderId: true,
          organisationId: true,
          reason: true,
          externalStatus: true,
          statusDetail: true,
          modality: true,
          createdAt: true,
        },
      }),
    ]);

    return { total, returned: rows.length, results: rows };
  },

  /**
   * Mark a held row as dealt with.
   *
   * Without this the `resolvedAt` column has no writer, so `listUnresolved` is
   * `listAll` and `total` can only ever go up - "981 stuck rows" would come to
   * mean "981 rows we have ever held", and the number that exists to tell an
   * operator the severity would stop being able to fall.
   *
   * `updateMany` with `resolvedAt: null` in the `where` rather than `update` on
   * the id alone: resolving is idempotent, and the count distinguishes "there
   * was something to resolve" from "already resolved or no such row" without a
   * second read. Note that a bare `update` would also throw rather than answer.
   *
   * Returns whether this call is the one that resolved it.
   */
  async resolve(id: string): Promise<boolean> {
    const { count } = await prisma.labResultQuarantine.updateMany({
      where: { id, resolvedAt: null },
      data: { resolvedAt: new Date() },
    });

    return count > 0;
  },
};
