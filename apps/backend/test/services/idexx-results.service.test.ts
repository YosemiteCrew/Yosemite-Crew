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

  // Confirming the batch tells IDEXX it was consumed, so a batch whose LabOrder transition we
  // skipped must stay unconfirmed - otherwise the transition is lost for good.
  it("leaves a batch unconfirmed when a result status does not map", async () => {
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

    expect(mockedPrisma.labOrder.update).not.toHaveBeenCalled();
    expect(mockConfirmLatestBatch).not.toHaveBeenCalled();
    expect(mockedPrisma.labResultSyncState.upsert).not.toHaveBeenCalled();
    expect(mockedLogger.warn).toHaveBeenCalledWith(
      "IDEXX result status did not map to a LabOrder status",
      expect.objectContaining({
        resultId: "result-1",
        orderId: "order-1",
        status: "REQUIRES_REVIEW",
      }),
    );
    expect(mockedLogger.error).toHaveBeenCalledWith(
      "IDEXX batch left unconfirmed: a result status did not map to a LabOrder status",
      { batchId: "batch-1" },
    );
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

  it("holds back a mixed batch, applying the rows that do map", async () => {
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
    expect(mockConfirmLatestBatch).not.toHaveBeenCalled();
  });
});
