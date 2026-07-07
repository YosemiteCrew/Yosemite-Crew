import {
  DeveloperExportService,
  DeveloperExportServiceError,
} from "../../src/services/developer-export.service";
import { DeveloperDataService } from "../../src/services/developer-data.service";
import { DeveloperUsageService } from "../../src/services/developer-usage.service";
import {
  DeveloperExportJobs,
  DeveloperExportQueue,
} from "../../src/queues/developer-export.queue";
import {
  createMultipartNdjsonUpload,
  generatePresignedGetUrl,
} from "../../src/middlewares/upload";
import { prisma } from "../../src/config/prisma";
import { encodeCursor } from "../../src/utils/cursor-pagination";
import logger from "../../src/utils/logger";

jest.mock("../../src/config/prisma", () => ({
  prisma: {
    developerExportJob: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  },
}));

jest.mock("src/queues/developer-export.queue", () => ({
  DeveloperExportQueue: { add: jest.fn() },
  DeveloperExportJobs: { RUN_EXPORT: "RUN_EXPORT" },
}));

jest.mock("src/services/developer-data.service", () => ({
  DeveloperDataService: {
    listAppointments: jest.fn(),
    listPatients: jest.fn(),
    listEncounters: jest.fn(),
    listInvoices: jest.fn(),
    getOrganization: jest.fn(),
  },
}));

jest.mock("src/services/developer-usage.service", () => ({
  DeveloperUsageService: { getUsage: jest.fn() },
}));

jest.mock("src/middlewares/upload", () => ({
  createMultipartNdjsonUpload: jest.fn(),
  generatePresignedGetUrl: jest.fn(
    async (key: string, expires: number) =>
      `https://signed.example/${key}?expires=${expires}`,
  ),
}));

jest.mock("src/utils/logger", () => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
}));

const mockPrisma = prisma as unknown as {
  developerExportJob: Record<string, jest.Mock>;
};
const mockQueue = DeveloperExportQueue as unknown as { add: jest.Mock };
const mockData = DeveloperDataService as unknown as Record<string, jest.Mock>;
const mockUsage = DeveloperUsageService as unknown as { getUsage: jest.Mock };
const mockMultipart = createMultipartNdjsonUpload as jest.Mock;
const mockSignedGetUrl = generatePresignedGetUrl as jest.Mock;
const mockLogger = logger as unknown as { warn: jest.Mock; error: jest.Mock };

const lastPage = (items: unknown[]) => ({
  items,
  pagination: { nextCursor: null, hasMore: false, limit: 500 },
});

describe("DeveloperExportService.create", () => {
  beforeEach(() => jest.clearAllMocks());

  it("409s with conflict_pending_export when a job is already pending", async () => {
    mockPrisma.developerExportJob.findFirst.mockResolvedValue({ id: "job-0" });

    await expect(
      DeveloperExportService.create({
        organisationId: "org-1",
        resources: ["patients"],
        format: "ndjson",
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: "conflict_pending_export",
    });
    expect(mockPrisma.developerExportJob.create).not.toHaveBeenCalled();
    expect(mockQueue.add).not.toHaveBeenCalled();
  });

  it("creates the row, dedupes resources, and enqueues one BullMQ job keyed by the row id", async () => {
    mockPrisma.developerExportJob.findFirst.mockResolvedValue(null);
    mockPrisma.developerExportJob.create.mockResolvedValue({
      id: "job-1",
      organisationId: "org-1",
      status: "QUEUED",
      resources: ["patients", "invoices"],
      format: "ndjson",
    });

    const job = await DeveloperExportService.create({
      organisationId: "org-1",
      resources: ["patients", "invoices", "patients"],
      format: "ndjson",
    });

    expect(mockPrisma.developerExportJob.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          organisationId: "org-1",
          resources: ["patients", "invoices"],
          format: "ndjson",
        },
      }),
    );
    expect(mockQueue.add).toHaveBeenCalledWith(
      DeveloperExportJobs.RUN_EXPORT,
      { exportJobId: "job-1" },
      { jobId: "job-1" },
    );
    expect(job.id).toBe("job-1");
  });

  it("only counts QUEUED/RUNNING jobs against the pending cap", async () => {
    mockPrisma.developerExportJob.findFirst.mockResolvedValue(null);
    mockPrisma.developerExportJob.create.mockResolvedValue({ id: "job-2" });

    await DeveloperExportService.create({
      organisationId: "org-1",
      resources: ["usage"],
      format: "ndjson",
    });

    expect(mockPrisma.developerExportJob.findFirst).toHaveBeenCalledWith({
      where: {
        organisationId: "org-1",
        status: { in: ["QUEUED", "RUNNING"] },
      },
      select: { id: true },
    });
  });
});

describe("DeveloperExportService.list / get", () => {
  beforeEach(() => jest.clearAllMocks());

  it("paginates org-scoped with the shared keyset helper", async () => {
    mockPrisma.developerExportJob.findMany.mockResolvedValue([]);
    const cursor = encodeCursor({
      sortKey: new Date("2026-07-01T00:00:00.000Z").toISOString(),
      id: "job-5",
    });

    await DeveloperExportService.list({
      organisationId: "org-1",
      limit: 10,
      cursor,
    });

    const arg = mockPrisma.developerExportJob.findMany.mock.calls[0][0];
    expect(arg.take).toBe(11);
    expect(arg.orderBy).toEqual([{ createdAt: "desc" }, { id: "desc" }]);
    expect(arg.where.organisationId).toBe("org-1");
    expect(arg.where.AND).toHaveLength(1);
  });

  it("get returns null for another org's job (no existence leak)", async () => {
    mockPrisma.developerExportJob.findFirst.mockResolvedValue(null);
    await expect(
      DeveloperExportService.get("org-1", "job-9"),
    ).resolves.toBeNull();
    expect(mockPrisma.developerExportJob.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "job-9", organisationId: "org-1" },
      }),
    );
  });

  it("get mints a fresh 15-minute signed URL only when COMPLETED", async () => {
    mockPrisma.developerExportJob.findFirst.mockResolvedValueOnce({
      id: "job-1",
      status: "COMPLETED",
      s3Key: "developer-exports/org-1/job-1.ndjson",
    });
    const done = await DeveloperExportService.get("org-1", "job-1");
    expect(done?.downloadUrl).toBe(
      "https://signed.example/developer-exports/org-1/job-1.ndjson?expires=900",
    );
    expect(mockSignedGetUrl).toHaveBeenCalledWith(
      "developer-exports/org-1/job-1.ndjson",
      900,
    );

    mockPrisma.developerExportJob.findFirst.mockResolvedValueOnce({
      id: "job-2",
      status: "RUNNING",
      s3Key: null,
    });
    const running = await DeveloperExportService.get("org-1", "job-2");
    expect(running?.downloadUrl).toBeNull();
  });

  it("get signs anew on every call - the URL is never stored", async () => {
    const row = {
      id: "job-1",
      status: "COMPLETED",
      s3Key: "developer-exports/org-1/job-1.ndjson",
    };
    mockPrisma.developerExportJob.findFirst.mockResolvedValue(row);
    await DeveloperExportService.get("org-1", "job-1");
    await DeveloperExportService.get("org-1", "job-1");
    expect(mockSignedGetUrl).toHaveBeenCalledTimes(2);
  });
});

describe("DeveloperExportService.run", () => {
  let writtenLines: string[];
  let completeMock: jest.Mock;
  let abortMock: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    writtenLines = [];
    completeMock = jest.fn(async () => ({ key: "key" }));
    abortMock = jest.fn(async () => undefined);
    mockMultipart.mockResolvedValue({
      writeLine: jest.fn(async (line: string) => {
        writtenLines.push(line);
      }),
      complete: completeMock,
      abort: abortMock,
    });
  });

  const primeJob = (resources: string[]) => {
    mockPrisma.developerExportJob.findUnique.mockResolvedValue({
      id: "job-1",
      organisationId: "org-1",
      status: "QUEUED",
      resources,
      format: "ndjson",
    });
    mockPrisma.developerExportJob.update.mockResolvedValue({});
  };

  it("is a no-op for a redelivered job that already finished", async () => {
    mockPrisma.developerExportJob.findUnique.mockResolvedValue({
      id: "job-1",
      status: "COMPLETED",
    });

    await DeveloperExportService.run("job-1");

    expect(mockPrisma.developerExportJob.update).not.toHaveBeenCalled();
    expect(mockMultipart).not.toHaveBeenCalled();
  });

  it("drains a paged resource in keyset batches of 500 until exhausted", async () => {
    primeJob(["patients"]);
    mockData.listPatients
      .mockResolvedValueOnce({
        items: [{ id: "p1" }, { id: "p2" }],
        pagination: { nextCursor: "cursor-2", hasMore: true, limit: 500 },
      })
      .mockResolvedValueOnce(lastPage([{ id: "p3" }]));

    await DeveloperExportService.run("job-1");

    expect(mockData.listPatients).toHaveBeenNthCalledWith(1, {
      organisationId: "org-1",
      limit: 500,
      cursor: undefined,
    });
    expect(mockData.listPatients).toHaveBeenNthCalledWith(2, {
      organisationId: "org-1",
      limit: 500,
      cursor: "cursor-2",
    });
    const complete = mockPrisma.developerExportJob.update.mock.calls.at(-1)[0];
    expect(complete.data).toEqual({
      status: "COMPLETED",
      s3Key: "developer-exports/org-1/job-1.ndjson",
      rowCounts: { patients: 3 },
    });
  });

  it("streams resource-tagged NDJSON lines to the job's multipart upload", async () => {
    primeJob(["patients", "organization", "usage"]);
    mockData.listPatients.mockResolvedValue(lastPage([{ id: "p1" }]));
    mockData.getOrganization.mockResolvedValue({ id: "org-1", name: "Vet" });
    mockUsage.getUsage.mockResolvedValue({
      billingPeriod: "2026-07",
      callCount: 12,
      limit: 1000,
    });

    await DeveloperExportService.run("job-1");

    expect(mockMultipart).toHaveBeenCalledWith(
      "developer-exports/org-1/job-1.ndjson",
    );
    expect(writtenLines.map((line) => JSON.parse(line))).toEqual([
      { resource: "patients", data: { id: "p1" } },
      { resource: "organization", data: { id: "org-1", name: "Vet" } },
      {
        resource: "usage",
        data: { billingPeriod: "2026-07", callCount: 12, limit: 1000 },
      },
    ]);
    expect(completeMock).toHaveBeenCalled();
    expect(abortMock).not.toHaveBeenCalled();
    const complete = mockPrisma.developerExportJob.update.mock.calls.at(-1)[0];
    expect(complete.data.rowCounts).toEqual({
      patients: 1,
      organization: 1,
      usage: 1,
    });
  });

  it("marks the row RUNNING before streaming", async () => {
    primeJob(["usage"]);
    mockUsage.getUsage.mockResolvedValue({});

    await DeveloperExportService.run("job-1");

    expect(mockPrisma.developerExportJob.update).toHaveBeenNthCalledWith(1, {
      where: { id: "job-1" },
      data: { status: "RUNNING" },
    });
  });

  it("caps a runaway resource at 1,000,000 rows and records the truncation", async () => {
    primeJob(["patients"]);
    const page = {
      items: Array.from({ length: 500 }, (_, index) => ({ id: index })),
      pagination: { nextCursor: "next", hasMore: true, limit: 500 },
    };
    mockData.listPatients.mockImplementation(async () => page);
    // Plain counters instead of jest.fn: recording 1M mock calls is too slow.
    let written = 0;
    mockMultipart.mockResolvedValue({
      writeLine: async () => {
        written += 1;
      },
      complete: completeMock,
      abort: abortMock,
    });

    await DeveloperExportService.run("job-1");

    expect(written).toBe(1_000_000);
    expect(completeMock).toHaveBeenCalled();
    const complete = mockPrisma.developerExportJob.update.mock.calls.at(-1)[0];
    expect(complete.data).toEqual({
      status: "COMPLETED",
      s3Key: "developer-exports/org-1/job-1.ndjson",
      rowCounts: { patients: 1_000_000, truncated: true },
    });
    // Never a silent cap: what was dropped is logged.
    expect(mockLogger.warn).toHaveBeenCalledWith(
      "Developer export truncated at the per-resource cap",
      expect.objectContaining({ truncatedResources: ["patients"] }),
    );
  });

  it("marks the row FAILED and aborts the upload when streaming blows up", async () => {
    primeJob(["invoices"]);
    mockData.listInvoices.mockRejectedValue(new Error("x".repeat(1000)));

    await DeveloperExportService.run("job-1");

    const failed = mockPrisma.developerExportJob.update.mock.calls.at(-1)[0];
    expect(failed.data.status).toBe("FAILED");
    expect(failed.data.error).toHaveLength(500);
    expect(abortMock).toHaveBeenCalled();
    expect(completeMock).not.toHaveBeenCalled();
  });

  it("marks the row FAILED when the multipart upload cannot even start", async () => {
    primeJob(["usage"]);
    mockMultipart.mockRejectedValue(new Error("no bucket"));

    await DeveloperExportService.run("job-1");

    const failed = mockPrisma.developerExportJob.update.mock.calls.at(-1)[0];
    expect(failed.data.status).toBe("FAILED");
    expect(abortMock).not.toHaveBeenCalled();
  });
});

describe("DeveloperExportService.recoverStaleJobs", () => {
  beforeEach(() => jest.clearAllMocks());

  it("fails only pending rows stale enough that their queue job is gone", async () => {
    mockPrisma.developerExportJob.updateMany.mockResolvedValue({ count: 2 });

    await expect(DeveloperExportService.recoverStaleJobs()).resolves.toBe(2);

    const arg = mockPrisma.developerExportJob.updateMany.mock.calls[0][0];
    expect(arg.where.status).toEqual({ in: ["QUEUED", "RUNNING"] });
    expect(arg.where.updatedAt.lt).toBeInstanceOf(Date);
    expect(arg.data.status).toBe("FAILED");
  });
});

describe("DeveloperExportServiceError", () => {
  it("carries status and machine code", () => {
    const err = new DeveloperExportServiceError(
      "m",
      409,
      "conflict_pending_export",
    );
    expect(err.statusCode).toBe(409);
    expect(err.code).toBe("conflict_pending_export");
  });
});
