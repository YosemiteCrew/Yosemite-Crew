import { prisma } from "src/config/prisma";
import {
  DeveloperExportJobs,
  DeveloperExportQueue,
} from "src/queues/developer-export.queue";
import { DeveloperDataService } from "src/services/developer-data.service";
import { DeveloperUsageService } from "src/services/developer-usage.service";
import { buildListPage, keysetWhere } from "src/utils/cursor-pagination";
import {
  generatePresignedDownloadUrl,
  uploadToS3,
} from "src/middlewares/upload";
import logger from "src/utils/logger";

// Bulk export (management plane, /v1/developers/exports): a DeveloperExportJob
// row tracks each request; the BullMQ worker streams every requested resource
// in keyset batches through the SAME contract field selects the data plane
// serves (DeveloperDataService), so an export can never contain a field the
// API would not return. Output is a single NDJSON file with resource-tagged
// lines ({"resource":"...","data":{...}}): one S3 key per job and no zip
// dependency, while each line stays self-describing.
//
// Error codes here extend the data-plane table with one management-plane
// addition (kept out of the contract doc on purpose):
//   409 conflict_pending_export - the org already has a QUEUED/RUNNING job.

export class DeveloperExportServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly code: string,
  ) {
    super(message);
    this.name = "DeveloperExportServiceError";
  }
}

export const EXPORTABLE_RESOURCES = [
  "appointments",
  "patients",
  "encounters",
  "invoices",
  "organization",
  "usage",
] as const;

export type ExportResource = (typeof EXPORTABLE_RESOURCES)[number];

const BATCH_SIZE = 500;
const MAX_ERROR_LENGTH = 500;
// A pending row older than this is unrecoverable state (Redis lost the job or
// the worker died and BullMQ's stalled-job retry gave up), not a slow export.
const STALE_JOB_MS = 24 * 60 * 60 * 1000;

const EXPORT_JOB_SELECT = {
  id: true,
  organisationId: true,
  status: true,
  resources: true,
  format: true,
  s3Key: true,
  error: true,
  rowCounts: true,
  createdAt: true,
  updatedAt: true,
} as const;

const toErrorText = (error: unknown): string => {
  const text = error instanceof Error ? error.message : String(error);
  return text.slice(0, MAX_ERROR_LENGTH);
};

// Drains one list endpoint org-scoped in keyset batches, invoking sink per row.
const drainPagedResource = async (
  list: (input: {
    organisationId: string;
    limit: number;
    cursor?: string;
  }) => Promise<{
    items: unknown[];
    pagination: { nextCursor: string | null; hasMore: boolean };
  }>,
  organisationId: string,
  sink: (row: unknown) => void,
): Promise<number> => {
  let cursor: string | undefined;
  let count = 0;
  let hasMore = true;
  while (hasMore) {
    const page = await list({ organisationId, limit: BATCH_SIZE, cursor });
    for (const row of page.items) {
      sink(row);
      count += 1;
    }
    hasMore = page.pagination.hasMore && page.pagination.nextCursor !== null;
    cursor = page.pagination.nextCursor ?? undefined;
  }
  return count;
};

const exportResource = async (
  resource: ExportResource,
  organisationId: string,
  sink: (row: unknown) => void,
): Promise<number> => {
  switch (resource) {
    case "appointments":
      return drainPagedResource(
        (input) => DeveloperDataService.listAppointments(input),
        organisationId,
        sink,
      );
    case "patients":
      return drainPagedResource(
        (input) => DeveloperDataService.listPatients(input),
        organisationId,
        sink,
      );
    case "encounters":
      return drainPagedResource(
        (input) => DeveloperDataService.listEncounters(input),
        organisationId,
        sink,
      );
    case "invoices":
      return drainPagedResource(
        (input) => DeveloperDataService.listInvoices(input),
        organisationId,
        sink,
      );
    case "organization": {
      const org = await DeveloperDataService.getOrganization(organisationId);
      if (!org) {
        return 0;
      }
      sink(org);
      return 1;
    }
    case "usage": {
      sink(await DeveloperUsageService.getUsage(organisationId));
      return 1;
    }
  }
};

export const DeveloperExportService = {
  // Creates the job row and enqueues the worker run. At most one QUEUED or
  // RUNNING job per organisation (checked, not constrained: a lost race
  // produces one redundant export, never corruption).
  async create(input: {
    organisationId: string;
    resources: ExportResource[];
    format: "ndjson";
  }) {
    const pending = await prisma.developerExportJob.findFirst({
      where: {
        organisationId: input.organisationId,
        status: { in: ["QUEUED", "RUNNING"] },
      },
      select: { id: true },
    });
    if (pending) {
      throw new DeveloperExportServiceError(
        "An export is already queued or running for this organisation",
        409,
        "conflict_pending_export",
      );
    }

    const resources = [...new Set(input.resources)];
    const job = await prisma.developerExportJob.create({
      data: {
        organisationId: input.organisationId,
        resources,
        format: input.format,
      },
      select: EXPORT_JOB_SELECT,
    });
    await DeveloperExportQueue.add(
      DeveloperExportJobs.RUN_EXPORT,
      { exportJobId: job.id },
      { jobId: job.id },
    );
    return job;
  },

  async list(input: {
    organisationId: string;
    limit: number;
    cursor?: string;
  }) {
    const where = { organisationId: input.organisationId };
    const keyset = keysetWhere("createdAt", input.cursor);
    const rows = await prisma.developerExportJob.findMany({
      where: keyset ? { ...where, AND: [keyset] } : where,
      select: EXPORT_JOB_SELECT,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: input.limit + 1,
    });
    return buildListPage(rows, input.limit, "createdAt");
  },

  // Detail view: null when absent or owned by another org (callers 404).
  // COMPLETED jobs carry the CloudFront download URL for their S3 key.
  async get(organisationId: string, id: string) {
    const job = await prisma.developerExportJob.findFirst({
      where: { id, organisationId },
      select: EXPORT_JOB_SELECT,
    });
    if (!job) {
      return null;
    }
    const downloadUrl =
      job.status === "COMPLETED" && job.s3Key
        ? await generatePresignedDownloadUrl(job.s3Key)
        : null;
    return { ...job, downloadUrl };
  },

  // Worker entry point. Idempotent per BullMQ's at-least-once delivery: only
  // a QUEUED row starts a run; a redelivered job for a finished row is a no-op.
  async run(exportJobId: string): Promise<void> {
    const job = await prisma.developerExportJob.findUnique({
      where: { id: exportJobId },
    });
    if (!job || job.status !== "QUEUED") {
      return;
    }
    await prisma.developerExportJob.update({
      where: { id: job.id },
      data: { status: "RUNNING" },
    });

    try {
      const lines: string[] = [];
      const rowCounts: Record<string, number> = {};
      for (const resource of job.resources as ExportResource[]) {
        rowCounts[resource] = await exportResource(
          resource,
          job.organisationId,
          (row) => lines.push(JSON.stringify({ resource, data: row })),
        );
      }

      const s3Key = `developer-exports/${job.organisationId}/${job.id}.ndjson`;
      await uploadToS3(
        s3Key,
        Buffer.from(`${lines.join("\n")}\n`, "utf8"),
        "application/x-ndjson",
      );

      await prisma.developerExportJob.update({
        where: { id: job.id },
        data: { status: "COMPLETED", s3Key, rowCounts },
      });
    } catch (error) {
      logger.error("Developer export failed", { exportJobId, error });
      await prisma.developerExportJob.update({
        where: { id: job.id },
        data: { status: "FAILED", error: toErrorText(error) },
      });
    }
  },

  // Boot-time safety net (see developer-export.scheduler.ts): fail pending
  // rows old enough that their queue job is certainly gone, so the per-org
  // pending cap cannot wedge an organisation permanently.
  async recoverStaleJobs(): Promise<number> {
    const result = await prisma.developerExportJob.updateMany({
      where: {
        status: { in: ["QUEUED", "RUNNING"] },
        updatedAt: { lt: new Date(Date.now() - STALE_JOB_MS) },
      },
      data: {
        status: "FAILED",
        error: "Export job went stale and was recovered at startup",
      },
    });
    return result.count;
  },
};
