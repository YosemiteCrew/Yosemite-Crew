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
});
