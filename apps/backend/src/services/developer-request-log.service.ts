import type { DeveloperApiKeyEnvironment, Prisma } from "@prisma/client";
import { prisma } from "src/config/prisma";
import { buildListPage, keysetWhere } from "src/utils/cursor-pagination";

// Persistence for developer data-plane request logs. Writes come from the
// capture middleware (fire-and-forget); reads serve the management-plane
// GET /v1/developers/request-logs endpoint. Retention is enforced by the
// developer-maintenance job via deleteOlderThan.

export const REQUEST_LOG_RETENTION_DAYS = 30;

const REQUEST_LOG_SELECT = {
  id: true,
  apiKeyId: true,
  method: true,
  path: true,
  statusCode: true,
  durationMs: true,
  errorCode: true,
  environment: true,
  createdAt: true,
} as const;

// Status-class filter values map to half-open statusCode ranges.
export const STATUS_CLASSES = ["2xx", "3xx", "4xx", "5xx"] as const;
export type StatusClass = (typeof STATUS_CLASSES)[number];

const statusRange = (statusClass: StatusClass): { gte: number; lt: number } => {
  const hundreds = Number(statusClass[0]) * 100;
  return { gte: hundreds, lt: hundreds + 100 };
};

const createdAtRange = (
  dateFrom?: string,
  dateTo?: string,
): Prisma.DateTimeFilter | undefined => {
  if (!dateFrom && !dateTo) {
    return undefined;
  }
  return {
    ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
    ...(dateTo ? { lte: new Date(dateTo) } : {}),
  };
};

export type RequestLogEntry = {
  organisationId: string;
  apiKeyId: string;
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
  errorCode: string | null;
  environment: DeveloperApiKeyEnvironment;
};

export const DeveloperRequestLogService = {
  // Persists one request log row. Callers on the hot path must treat this as
  // fire-and-forget (void + catch); it never gates a response.
  async record(entry: RequestLogEntry): Promise<void> {
    await prisma.developerApiRequestLog.create({ data: entry });
  },

  async list(input: {
    organisationId: string;
    limit: number;
    cursor?: string;
    apiKeyId?: string;
    statusClass?: StatusClass;
    dateFrom?: string;
    dateTo?: string;
  }) {
    const createdAt = createdAtRange(input.dateFrom, input.dateTo);
    const where: Prisma.DeveloperApiRequestLogWhereInput = {
      organisationId: input.organisationId,
      ...(input.apiKeyId ? { apiKeyId: input.apiKeyId } : {}),
      ...(input.statusClass
        ? { statusCode: statusRange(input.statusClass) }
        : {}),
      ...(createdAt ? { createdAt } : {}),
    };
    const keyset = keysetWhere("createdAt", input.cursor);
    const rows = await prisma.developerApiRequestLog.findMany({
      where: keyset ? { AND: [where, keyset] } : where,
      select: REQUEST_LOG_SELECT,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: input.limit + 1,
    });
    return buildListPage(rows, input.limit, "createdAt");
  },

  // Retention: hard-deletes rows older than the given number of days.
  async deleteOlderThan(days: number): Promise<number> {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const result = await prisma.developerApiRequestLog.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });
    return result.count;
  },
};
