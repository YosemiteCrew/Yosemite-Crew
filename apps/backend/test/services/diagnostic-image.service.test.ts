import {
  DiagnosticImageService,
  DiagnosticImageError,
} from "src/services/diagnostic-image.service";
import { prisma } from "src/config/prisma";
import { AuditTrailService } from "src/services/audit-trail.service";

jest.mock("src/config/prisma", () => ({
  prisma: {
    diagnosticImage: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock("src/services/audit-trail.service", () => ({
  AuditTrailService: { recordSafely: jest.fn().mockResolvedValue(undefined) },
}));

const pm = prisma as unknown as {
  diagnosticImage: {
    create: jest.Mock;
    findFirst: jest.Mock;
    findMany: jest.Mock;
    update: jest.Mock;
  };
};

const makeImage = (over: Record<string, unknown> = {}) => ({
  id: "img-1",
  organisationId: "org-1",
  patientId: "pat-1",
  encounterId: "enc-1",
  imagingType: "RADIOGRAPH",
  bodyRegion: "thorax",
  indication: "Coughing",
  takenAt: new Date("2026-06-30T08:00:00Z"),
  takenBy: "tech-1",
  interpretedBy: null,
  interpretedAt: null,
  findings: null,
  impression: null,
  followUpRequired: false,
  documentId: null,
  status: "PENDING_REVIEW",
  createdAt: new Date(),
  updatedAt: new Date(),
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  (AuditTrailService.recordSafely as jest.Mock).mockResolvedValue(undefined);
  pm.diagnosticImage.findFirst.mockResolvedValue(makeImage());
  pm.diagnosticImage.create.mockResolvedValue(makeImage());
  pm.diagnosticImage.update.mockImplementation(
    (args: { data: Record<string, unknown> }) =>
      Promise.resolve(makeImage({ ...args.data })),
  );
  pm.diagnosticImage.findMany.mockResolvedValue([makeImage()]);
});

// ---------------------------------------------------------------------------
// record
// ---------------------------------------------------------------------------

describe("DiagnosticImageService.record", () => {
  it("creates a PENDING_REVIEW image and emits audit", async () => {
    const result = await DiagnosticImageService.record({
      organisationId: "org-1",
      patientId: "pat-1",
      encounterId: "enc-1",
      imagingType: "RADIOGRAPH",
      bodyRegion: "thorax",
      takenAt: new Date("2026-06-30T08:00:00Z"),
      takenBy: "tech-1",
    });
    expect(pm.diagnosticImage.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          imagingType: "RADIOGRAPH",
          status: "PENDING_REVIEW",
        }),
      }),
    );
    expect(AuditTrailService.recordSafely).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "DIAGNOSTIC_IMAGE_RECORDED",
        actorId: "tech-1",
      }),
    );
    expect(result.status).toBe("PENDING_REVIEW");
  });

  it("defaults followUpRequired to false", async () => {
    await DiagnosticImageService.record({
      organisationId: "org-1",
      patientId: "pat-1",
      imagingType: "ULTRASOUND",
      takenAt: new Date(),
    });
    expect(pm.diagnosticImage.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ followUpRequired: false }),
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// get / list
// ---------------------------------------------------------------------------

describe("DiagnosticImageService.get", () => {
  it("returns an image by id and org", async () => {
    const result = await DiagnosticImageService.get("img-1", "org-1");
    expect(result.id).toBe("img-1");
  });

  it("404s an unknown record", async () => {
    pm.diagnosticImage.findFirst.mockResolvedValue(null);
    await expect(
      DiagnosticImageService.get("bad", "org-1"),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("DiagnosticImageService.list", () => {
  it("lists all images for the org", async () => {
    const result = await DiagnosticImageService.list({
      organisationId: "org-1",
    });
    expect(result).toHaveLength(1);
  });

  it("filters by patientId, encounterId, imagingType and status", async () => {
    await DiagnosticImageService.list({
      organisationId: "org-1",
      patientId: "pat-1",
      encounterId: "enc-1",
      imagingType: "RADIOGRAPH",
      status: "PENDING_REVIEW",
    });
    expect(pm.diagnosticImage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          patientId: "pat-1",
          imagingType: "RADIOGRAPH",
          status: "PENDING_REVIEW",
        }),
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// review
// ---------------------------------------------------------------------------

describe("DiagnosticImageService.review", () => {
  it("stamps interpretation and emits DIAGNOSTIC_IMAGE_REVIEWED", async () => {
    pm.diagnosticImage.update.mockResolvedValue(
      makeImage({
        interpretedBy: "vet-1",
        findings: "Pulmonary infiltrates present",
        status: "REVIEWED",
      }),
    );
    const result = await DiagnosticImageService.review(
      "img-1",
      "org-1",
      { interpretedBy: "vet-1", findings: "Pulmonary infiltrates present" },
      "vet-1",
    );
    expect(pm.diagnosticImage.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          interpretedBy: "vet-1",
          status: "REVIEWED",
        }),
      }),
    );
    expect(AuditTrailService.recordSafely).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "DIAGNOSTIC_IMAGE_REVIEWED" }),
    );
    expect(result.status).toBe("REVIEWED");
  });

  it("can set REQUIRES_SPECIALIST status", async () => {
    pm.diagnosticImage.update.mockResolvedValue(
      makeImage({ status: "REQUIRES_SPECIALIST" }),
    );
    await DiagnosticImageService.review("img-1", "org-1", {
      interpretedBy: "vet-1",
      findings: "Unclear mass",
      status: "REQUIRES_SPECIALIST",
    });
    expect(pm.diagnosticImage.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "REQUIRES_SPECIALIST" }),
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// update
// ---------------------------------------------------------------------------

describe("DiagnosticImageService.update", () => {
  it("updates editable fields", async () => {
    await DiagnosticImageService.update("img-1", "org-1", {
      bodyRegion: "abdomen",
      followUpRequired: true,
    });
    expect(pm.diagnosticImage.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          bodyRegion: "abdomen",
          followUpRequired: true,
        }),
      }),
    );
  });
});
