import { PathologySubmissionService } from "../../src/services/pathology-submission.service";

jest.mock("src/config/prisma", () => ({
  prisma: {
    pathologySubmission: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock("../../src/services/audit-trail.service", () => ({
  AuditTrailService: { recordSafely: jest.fn() },
}));

import { prisma } from "src/config/prisma";

const mockCreate = prisma.pathologySubmission.create as jest.Mock;
const mockFindFirst = prisma.pathologySubmission.findFirst as jest.Mock;
const mockFindMany = prisma.pathologySubmission.findMany as jest.Mock;
const mockUpdate = prisma.pathologySubmission.update as jest.Mock;

const baseSubmission = {
  id: "ps-1",
  organisationId: "org-1",
  patientId: "pat-1",
  encounterId: null,
  pathologyType: "HISTOPATHOLOGY" as const,
  sampleType: "Fine needle aspirate",
  anatomicSite: "Right axillary lymph node",
  collectedAt: new Date("2026-06-30T09:00:00Z"),
  collectedBy: "vet-1",
  submittedAt: null,
  labName: null,
  labRefNumber: null,
  clinicalHistory: null,
  differentials: null,
  results: null,
  diagnosis: null,
  interpretation: null,
  reviewedBy: null,
  reviewedAt: null,
  status: "PENDING" as const,
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

beforeEach(() => jest.clearAllMocks());

describe("PathologySubmissionService.create", () => {
  it("creates a submission with PENDING status", async () => {
    mockCreate.mockResolvedValue(baseSubmission);
    const result = await PathologySubmissionService.create({
      organisationId: "org-1",
      patientId: "pat-1",
      pathologyType: "HISTOPATHOLOGY",
      sampleType: "Fine needle aspirate",
      anatomicSite: "Right axillary lymph node",
      collectedAt: new Date("2026-06-30T09:00:00Z"),
    });
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "PENDING" }),
      }),
    );
    expect(result.status).toBe("PENDING");
  });
});

describe("PathologySubmissionService.get", () => {
  it("returns submission when found", async () => {
    mockFindFirst.mockResolvedValue(baseSubmission);
    const result = await PathologySubmissionService.get("ps-1", "org-1");
    expect(result.id).toBe("ps-1");
  });

  it("throws 404 when not found", async () => {
    mockFindFirst.mockResolvedValue(null);
    await expect(
      PathologySubmissionService.get("ps-x", "org-1"),
    ).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});

describe("PathologySubmissionService.list", () => {
  it("returns submissions for an organisation", async () => {
    mockFindMany.mockResolvedValue([baseSubmission]);
    const result = await PathologySubmissionService.list({
      organisationId: "org-1",
    });
    expect(result).toHaveLength(1);
  });

  it("filters by status when provided", async () => {
    mockFindMany.mockResolvedValue([]);
    await PathologySubmissionService.list({
      organisationId: "org-1",
      status: "REVIEWED",
    });
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "REVIEWED" }),
      }),
    );
  });
});

describe("PathologySubmissionService.recordResults", () => {
  it("updates results and sets status RESULTS_AVAILABLE", async () => {
    const withResults = {
      ...baseSubmission,
      results: "Malignant cells detected",
      status: "RESULTS_AVAILABLE" as const,
    };
    mockFindFirst.mockResolvedValue(baseSubmission);
    mockUpdate.mockResolvedValue(withResults);
    const result = await PathologySubmissionService.recordResults(
      "ps-1",
      "org-1",
      { results: "Malignant cells detected" },
    );
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          results: "Malignant cells detected",
          status: "RESULTS_AVAILABLE",
        }),
      }),
    );
    expect(result.status).toBe("RESULTS_AVAILABLE");
  });

  it("throws 404 when submission not found", async () => {
    mockFindFirst.mockResolvedValue(null);
    await expect(
      PathologySubmissionService.recordResults("ps-x", "org-1", {
        results: "test",
      }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("PathologySubmissionService.review", () => {
  it("sets status REVIEWED and stamps reviewedBy/reviewedAt", async () => {
    const submissionWithResults = {
      ...baseSubmission,
      results: "Lymphoma confirmed",
    };
    const reviewed = {
      ...submissionWithResults,
      status: "REVIEWED" as const,
      reviewedBy: "vet-1",
      reviewedAt: new Date(),
    };
    mockFindFirst.mockResolvedValue(submissionWithResults);
    mockUpdate.mockResolvedValue(reviewed);
    const result = await PathologySubmissionService.review(
      "ps-1",
      "org-1",
      {},
      "vet-1",
    );
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "REVIEWED",
          reviewedBy: "vet-1",
        }),
      }),
    );
    expect(result.status).toBe("REVIEWED");
  });

  it("throws 409 when results are not yet recorded", async () => {
    mockFindFirst.mockResolvedValue(baseSubmission);
    await expect(
      PathologySubmissionService.review("ps-1", "org-1", {}, "vet-1"),
    ).rejects.toMatchObject({ statusCode: 409 });
  });
});

describe("PathologySubmissionService.update", () => {
  it("updates mutable fields", async () => {
    const updated = {
      ...baseSubmission,
      labName: "External Lab",
      labRefNumber: "LAB-001",
    };
    mockFindFirst.mockResolvedValue(baseSubmission);
    mockUpdate.mockResolvedValue(updated);
    const result = await PathologySubmissionService.update("ps-1", "org-1", {
      labName: "External Lab",
      labRefNumber: "LAB-001",
    });
    expect(mockUpdate).toHaveBeenCalled();
    expect(result.labName).toBe("External Lab");
  });

  it("throws 404 when not found", async () => {
    mockFindFirst.mockResolvedValue(null);
    await expect(
      PathologySubmissionService.update("ps-x", "org-1", { labName: "Lab" }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});
