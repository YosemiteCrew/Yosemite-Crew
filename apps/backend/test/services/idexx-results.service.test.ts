import { describe, expect, it, beforeEach, jest } from "@jest/globals";
import { prisma } from "src/config/prisma";
import { DocumentService } from "src/services/document.service";
import { TaskService } from "src/services/task.service";
import { uploadBufferAsFile } from "src/middlewares/upload";
import logger from "src/utils/logger";

const mockGetLatestResults = jest.fn() as jest.MockedFunction<
  (limit?: number) => Promise<unknown>
>;
const mockConfirmLatestBatch = jest.fn() as jest.MockedFunction<
  (batchId: string) => Promise<unknown>
>;
const mockGetResultPdf = jest.fn() as jest.MockedFunction<
  (resultId: string) => Promise<{
    data: ArrayBuffer;
    headers: Record<string, string>;
  }>
>;

jest.mock("../../src/integrations/idexx/idexx-results.client", () => ({
  __esModule: true,
  IdexxResultsClient: jest.fn().mockImplementation(() => ({
    getLatestResults: mockGetLatestResults,
    confirmLatestBatch: mockConfirmLatestBatch,
    getResultPdf: mockGetResultPdf,
  })),
}));

jest.mock("src/config/prisma", () => ({
  prisma: {
    labOrder: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    labResult: {
      upsert: jest.fn(),
    },
    labResultSyncState: {
      upsert: jest.fn(),
    },
    labResultQuarantine: {
      create: jest.fn(),
    },
    task: {
      findFirst: jest.fn(),
    },
    document: {
      findFirst: jest.fn(),
    },
  },
}));

jest.mock("src/services/document.service", () => ({
  DocumentService: {
    create: jest.fn(),
  },
}));

jest.mock("src/services/task.service", () => ({
  TaskService: {
    createCustom: jest.fn(),
  },
}));

jest.mock("src/middlewares/upload", () => ({
  uploadBufferAsFile: jest.fn(),
}));

jest.mock("src/utils/logger", () => ({
  __esModule: true,
  default: {
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

const mockedPrisma = prisma as jest.Mocked<typeof prisma>;
const mockedDocumentService = jest.mocked(DocumentService);
const mockedTaskService = jest.mocked(TaskService);
const mockedUploadBufferAsFile = jest.mocked(uploadBufferAsFile);
const mockedLogger = jest.mocked(logger);
let IdexxResultsService: typeof import("../../src/services/idexx-results.service").IdexxResultsService;

describe("IdexxResultsService", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    process.env.IDEXX_GLOBAL_USERNAME = "user";
    process.env.IDEXX_GLOBAL_PASSWORD = "pass";
    process.env.IDEXX_PIMS_ID = "pims-id";
    process.env.IDEXX_PIMS_VERSION = "1.0";

    ({ IdexxResultsService } =
      await import("../../src/services/idexx-results.service"));

    mockGetLatestResults.mockResolvedValue({
      batchId: "batch-1",
      hasMoreResults: false,
      results: [
        {
          resultId: "result-1",
          orderId: "order-1",
          status: "COMPLETE",
          updatedDate: "2026-06-17T12:00:00.000Z",
          patient: {
            patientId: "patient-1",
          },
        },
      ],
    });
    mockConfirmLatestBatch.mockResolvedValue({});
    mockGetResultPdf.mockResolvedValue({
      data: new ArrayBuffer(8),
      headers: {},
    });

    mockedPrisma.labOrder.findFirst.mockResolvedValue({
      id: "lab-order-1",
      organisationId: "org-1",
      appointmentId: "appointment-1",
      createdByUserId: "user-1",
      patientId: "patient-1",
    } as any);
    mockedPrisma.labOrder.update.mockResolvedValue({} as any);
    mockedPrisma.labResult.upsert.mockResolvedValue({} as any);
    mockedPrisma.labResultSyncState.upsert.mockResolvedValue({} as any);
    mockedPrisma.labResultQuarantine.create.mockResolvedValue({} as any);
    mockedPrisma.task.findFirst.mockResolvedValue(null as any);
    mockedPrisma.document.findFirst.mockResolvedValue(null as any);
    mockedDocumentService.create.mockResolvedValue({} as any);
    mockedTaskService.createCustom.mockResolvedValue({} as any);
    mockedUploadBufferAsFile.mockResolvedValue({
      key: "lab-results/patient-1/result-1.pdf",
    } as any);
  });

  it("creates lab result documents with the accepted HEALTH subcategory", async () => {
    await IdexxResultsService.pollLatest(1, 1);

    expect(mockedPrisma.document.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          category: "HEALTH",
          subcategory: "LAB_TEST",
          title: "Lab Result result-1",
        }),
      }),
    );
    expect(mockedDocumentService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        category: "HEALTH",
        subcategory: "LAB_TEST",
        title: "Lab Result result-1",
        issuingBusinessName: "IDEXX",
      }),
      expect.objectContaining({
        organisationId: "org-1",
        pmsUserId: "user-1",
      }),
    );
    expect(mockConfirmLatestBatch).toHaveBeenCalledWith("batch-1");
    expect(mockedLogger.error).not.toHaveBeenCalled();
    expect(mockedTaskService.createCustom).toHaveBeenCalled();
  });

  // lab-result reads authorize on the stored organisationId, so it must come from the
  // LabOrder we placed and never from the provider's response.
  it("stores the organisation from the lab order, not the provider payload", async () => {
    mockGetLatestResults.mockResolvedValue({
      batchId: "batch-1",
      hasMoreResults: false,
      results: [
        {
          resultId: "result-1",
          orderId: "order-1",
          organisationId: "attacker-org",
          status: "COMPLETE",
          updatedDate: "2026-06-17T12:00:00.000Z",
          patient: { patientId: "patient-1" },
        },
      ],
    });

    await IdexxResultsService.pollLatest(1, 1);

    expect(mockedPrisma.labResult.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ organisationId: "org-1" }),
        update: expect.objectContaining({ organisationId: "org-1" }),
      }),
    );
  });

  it("does not fall back to the provider organisation when no lab order matches", async () => {
    mockedPrisma.labOrder.findFirst.mockResolvedValue(null as any);
    mockGetLatestResults.mockResolvedValue({
      batchId: "batch-1",
      hasMoreResults: false,
      results: [
        {
          resultId: "result-1",
          orderId: "order-1",
          organisationId: "attacker-org",
          status: "COMPLETE",
          updatedDate: "2026-06-17T12:00:00.000Z",
          patient: { patientId: "patient-1" },
        },
      ],
    });

    await IdexxResultsService.pollLatest(1, 1);

    expect(mockedPrisma.labResult.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ organisationId: null }),
        update: expect.objectContaining({ organisationId: null }),
      }),
    );
  });

  // The poll is GLOBAL - one client from IDEXX_GLOBAL_USERNAME, organisationId derived per
  // result - and IDEXX confirms a BATCH. So refusing to confirm because one row did not map
  // does not hold up one clinic's queue, it holds up every clinic's, indefinitely: the
  // unconfirmed batch is re-fetched next poll and meets the same row again. The row is held
  // instead, and the rest of the batch goes through.
  it("quarantines an unmapped result and confirms the rest of the batch", async () => {
    mockGetLatestResults.mockResolvedValue({
      batchId: "batch-1",
      hasMoreResults: false,
      results: [
        {
          resultId: "result-1",
          orderId: "order-1",
          status: "REQUIRES_REVIEW",
          statusDetail: "awaiting pathologist",
          modality: "REFERENCE_LAB",
          updatedDate: "2026-06-17T12:00:00.000Z",
          patient: { patientId: "patient-1" },
        },
      ],
    });

    await IdexxResultsService.pollLatest(1, 1);

    // The transition is still NOT applied - that part of #2699 is deliberate and unchanged.
    expect(mockedPrisma.labOrder.update).not.toHaveBeenCalled();

    // It is held somewhere queryable instead, with the payload needed to replay it.
    expect(mockedPrisma.labResultQuarantine.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        provider: "IDEXX",
        batchId: "batch-1",
        resultId: "result-1",
        orderId: "order-1",
        labOrderId: "lab-order-1",
        organisationId: "org-1",
        reason: "UNMAPPED_RESULT_STATUS",
        externalStatus: "REQUIRES_REVIEW",
        statusDetail: "awaiting pathologist",
        modality: "REFERENCE_LAB",
        payload: expect.objectContaining({ resultId: "result-1" }),
      }),
    });

    // And ingestion continues, which is the whole point.
    expect(mockConfirmLatestBatch).toHaveBeenCalledWith("batch-1");
    expect(mockedPrisma.labResultSyncState.upsert).toHaveBeenCalled();

    expect(mockedLogger.warn).toHaveBeenCalledWith(
      "IDEXX result status did not map to a LabOrder status",
      expect.objectContaining({
        resultId: "result-1",
        orderId: "order-1",
        status: "REQUIRES_REVIEW",
      }),
    );
    expect(mockedLogger.error).toHaveBeenCalledWith(
      "IDEXX results quarantined: a result status did not map to a LabOrder status",
      { batchId: "batch-1", quarantined: 1 },
    );
  });

  // The fallback, and the reason the order is quarantine-then-confirm rather than the
  // reverse. If nothing is holding the skipped transition, confirming would lose it for
  // good - so a failed quarantine write returns to the old behaviour: stall, loudly.
  it("does not confirm a batch when the quarantine write fails", async () => {
    mockedPrisma.labResultQuarantine.create.mockRejectedValue(
      new Error("database unavailable") as never,
    );
    mockGetLatestResults.mockResolvedValue({
      batchId: "batch-1",
      hasMoreResults: false,
      results: [
        {
          resultId: "result-1",
          orderId: "order-1",
          status: "REQUIRES_REVIEW",
          updatedDate: "2026-06-17T12:00:00.000Z",
          patient: { patientId: "patient-1" },
        },
      ],
    });

    await IdexxResultsService.pollLatest(1, 1);

    // Both assertions are needed: confirming alone would not prove the batch was not
    // consumed if the sync state had advanced anyway.
    expect(mockConfirmLatestBatch).not.toHaveBeenCalled();
    expect(mockedPrisma.labResultSyncState.upsert).not.toHaveBeenCalled();
    expect(mockedLogger.error).toHaveBeenCalledWith(
      "IDEXX batch left unconfirmed: could not quarantine an unmapped result",
      expect.objectContaining({ batchId: "batch-1" }),
    );
  });

  // One row per unapplicable result, including when the provider sent no result id at all.
  // An upsert key would collapse these two onto one row, which is the silent loss the whole
  // change exists to prevent - hence no unique key on the table.
  it("records every unmapped result in a batch, including ones with no result id", async () => {
    mockGetLatestResults.mockResolvedValue({
      batchId: "batch-1",
      hasMoreResults: false,
      results: [
        {
          orderId: "order-1",
          status: "REQUIRES_REVIEW",
          updatedDate: "2026-06-17T12:00:00.000Z",
          patient: { patientId: "patient-1" },
        },
        {
          orderId: "order-2",
          status: "SOMETHING_NEW",
          updatedDate: "2026-06-17T12:00:00.000Z",
          patient: { patientId: "patient-2" },
        },
      ],
    });

    await IdexxResultsService.pollLatest(2, 1);

    expect(mockedPrisma.labResultQuarantine.create).toHaveBeenCalledTimes(2);
    const reasons = mockedPrisma.labResultQuarantine.create.mock.calls.map(
      (call) =>
        (call[0] as { data: { resultId: unknown; orderId: unknown } }).data,
    );
    // Null, not "": an id the provider never sent is worth seeing as absent.
    expect(reasons).toEqual([
      expect.objectContaining({ resultId: null, orderId: "order-1" }),
      expect.objectContaining({ resultId: null, orderId: "order-2" }),
    ]);
    expect(mockConfirmLatestBatch).toHaveBeenCalledWith("batch-1");
  });

  it("does not quarantine a result whose status maps", async () => {
    await IdexxResultsService.pollLatest(1, 1);

    expect(mockedPrisma.labResultQuarantine.create).not.toHaveBeenCalled();
    expect(mockConfirmLatestBatch).toHaveBeenCalledWith("batch-1");
  });

  // The result row itself still lands, so an unmapped status is not a lost result - but the
  // document and task are gated on COMPLETE, and a COMPLETE status always maps, so an unmapped
  // row never produces either.
  it("still persists a result whose status does not map", async () => {
    mockGetLatestResults.mockResolvedValue({
      batchId: "batch-1",
      hasMoreResults: false,
      results: [
        {
          resultId: "result-1",
          orderId: "order-1",
          status: "REQUIRES_REVIEW",
          updatedDate: "2026-06-17T12:00:00.000Z",
          patient: { patientId: "patient-1" },
        },
      ],
    });

    await IdexxResultsService.pollLatest(1, 1);

    expect(mockedPrisma.labResult.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ organisationId: "org-1" }),
      }),
    );
    expect(mockedTaskService.createCustom).not.toHaveBeenCalled();
    expect(mockedDocumentService.create).not.toHaveBeenCalled();
  });

  // The mixed batch is the realistic case: one clinic's unrecognised status arriving
  // alongside other clinics' ordinary results. Before the quarantine, the whole batch was
  // held for the one row - which is the outage.
  it("applies the rows that do map in a mixed batch, and holds only the one that does not", async () => {
    mockGetLatestResults.mockResolvedValue({
      batchId: "batch-1",
      hasMoreResults: false,
      results: [
        {
          resultId: "result-1",
          orderId: "order-1",
          status: "COMPLETE",
          updatedDate: "2026-06-17T12:00:00.000Z",
          patient: { patientId: "patient-1" },
        },
        {
          resultId: "result-2",
          orderId: "order-1",
          status: "REQUIRES_REVIEW",
          updatedDate: "2026-06-17T12:05:00.000Z",
          patient: { patientId: "patient-1" },
        },
      ],
    });

    await IdexxResultsService.pollLatest(2, 1);

    expect(mockedPrisma.labOrder.update).toHaveBeenCalledTimes(1);
    expect(mockedPrisma.labResultQuarantine.create).toHaveBeenCalledTimes(1);
    expect(mockedPrisma.labResultQuarantine.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ resultId: "result-2" }),
    });
    expect(mockConfirmLatestBatch).toHaveBeenCalledWith("batch-1");
  });
});
