import { describe, expect, it, beforeEach, jest } from "@jest/globals";
import {
  CreateDocumentInput,
  DocumentService,
  DocumentServiceError,
} from "../../src/services/document.service";
import { prisma } from "src/config/prisma";
import {
  deleteFromS3,
  generatePresignedDownloadUrl,
} from "src/middlewares/upload";
import { AuditTrailService } from "../../src/services/audit-trail.service";

jest.mock("src/middlewares/upload", () => ({
  __esModule: true,
  deleteFromS3: jest.fn(),
  generatePresignedDownloadUrl: jest.fn(),
}));

jest.mock("../../src/services/audit-trail.service", () => ({
  __esModule: true,
  AuditTrailService: {
    recordSafely: jest.fn(),
  },
}));

jest.mock("src/config/prisma", () => ({
  prisma: {
    parentPatient: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    patientOrganisation: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    document: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
    },
    documentAttachment: {
      createMany: jest.fn(),
      findFirst: jest.fn(),
      deleteMany: jest.fn(),
    },
    renderedDocument: {
      findMany: jest.fn(),
    },
    appointment: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(async (fn: any) => fn(prisma)),
  },
}));

const mockedPrisma = prisma as jest.Mocked<typeof prisma>;
const mockedUpload = {
  deleteFromS3: jest.mocked(deleteFromS3),
  generatePresignedDownloadUrl: jest.mocked(generatePresignedDownloadUrl),
};
const mockedAuditTrail = jest.mocked(AuditTrailService);

const uuidPatientId = "550e8400-e29b-41d4-a716-446655440000";
const uuidParentId = "3fa85f64-5717-4562-b3fc-2c963f66afa6";
const uuidOrganisationId = "d2719f61-98a5-4cb8-9a5c-36ec4d1c2d1a";
const uuidAppointmentId = "11111111-2222-3333-4444-555555555555";
const uuidDocumentId = "22222222-3333-4444-5555-666666666666";
const now = new Date("2026-06-17T00:00:00.000Z");

const baseRow = {
  id: uuidDocumentId,
  patientId: uuidPatientId,
  appointmentId: null,
  category: "HEALTH",
  subcategory: null,
  visitType: null,
  title: "Vaccination card",
  issuingBusinessName: null,
  issueDate: null,
  uploadedByParentId: uuidParentId,
  uploadedByPmsUserId: null,
  pmsVisible: true,
  syncedFromPms: false,
  createdAt: now,
  updatedAt: now,
  attachments: [{ key: "k-1", mimeType: "image/png", size: 123 }],
};

const resetPrisma = () => {
  mockedPrisma.parentPatient.findFirst.mockReset();
  mockedPrisma.parentPatient.findMany.mockReset();
  mockedPrisma.patientOrganisation.findFirst.mockReset();
  mockedPrisma.patientOrganisation.findMany.mockReset();
  mockedPrisma.document.create.mockReset();
  mockedPrisma.document.findMany.mockReset();
  mockedPrisma.document.findUnique.mockReset();
  mockedPrisma.document.findFirst.mockReset();
  mockedPrisma.document.update.mockReset();
  mockedPrisma.document.deleteMany.mockReset();
  mockedPrisma.documentAttachment.createMany.mockReset();
  mockedPrisma.documentAttachment.findFirst.mockReset();
  mockedPrisma.documentAttachment.deleteMany.mockReset();
  mockedPrisma.renderedDocument.findMany.mockReset();
  mockedPrisma.appointment.findUnique.mockReset();
  mockedPrisma.$transaction.mockReset();
  mockedPrisma.$transaction.mockImplementation(async (fn: any) => fn(prisma));
};

describe("DocumentService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetPrisma();
    mockedPrisma.parentPatient.findFirst.mockResolvedValue({
      id: "pp-1",
    } as any);
    mockedPrisma.parentPatient.findMany.mockResolvedValue([
      { patientId: uuidPatientId },
    ] as any);
    mockedPrisma.patientOrganisation.findFirst.mockResolvedValue({
      id: "po-1",
    } as any);
    mockedPrisma.patientOrganisation.findMany.mockResolvedValue([
      { patientId: uuidPatientId },
    ] as any);
    mockedPrisma.document.findUnique.mockResolvedValue({
      ...baseRow,
      attachments: baseRow.attachments,
    } as any);
    mockedPrisma.document.findFirst.mockResolvedValue({
      id: uuidDocumentId,
      attachments: [{ key: "k-1" }],
    } as any);
    mockedPrisma.documentAttachment.findFirst.mockResolvedValue({
      documentId: uuidDocumentId,
    } as any);
    mockedPrisma.document.findMany.mockResolvedValue([
      {
        ...baseRow,
        attachments: baseRow.attachments,
      },
    ] as any);
    mockedPrisma.document.create.mockResolvedValue({
      ...baseRow,
      id: uuidDocumentId,
    } as any);
    mockedPrisma.renderedDocument.findMany.mockResolvedValue([]);
    mockedPrisma.appointment.findUnique.mockResolvedValue({
      organisationId: uuidOrganisationId,
      patient: { id: uuidPatientId },
    } as any);
    mockedUpload.generatePresignedDownloadUrl.mockResolvedValue(
      "https://download/url",
    );
  });

  it("creates a document with uuid patient ids", async () => {
    const input: CreateDocumentInput = {
      patientId: uuidPatientId,
      category: "HEALTH",
      subcategory: "PRESCRIPTION",
      title: "Vaccination card",
      attachments: [{ key: "k-1", mimeType: "image/png", size: 123 }],
    };

    const result = await DocumentService.create(input, {
      parentId: uuidParentId,
      organisationId: uuidOrganisationId,
    });

    expect(mockedPrisma.document.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          patientId: uuidPatientId,
          subcategory: "PRESCRIPTION",
          uploadedByParentId: uuidParentId,
          pmsVisible: true,
        }),
      }),
    );
    expect(mockedPrisma.documentAttachment.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [
          expect.objectContaining({
            documentId: uuidDocumentId,
            key: "k-1",
          }),
        ],
      }),
    );
    expect(mockedAuditTrail.recordSafely).toHaveBeenCalledWith(
      expect.objectContaining({
        organisationId: uuidOrganisationId,
        patientId: uuidPatientId,
      }),
    );
    expect(result.patientId).toBe(uuidPatientId);
  });

  it("lists documents for a parent using postgres ids", async () => {
    const result = await DocumentService.listForParent({
      patientId: uuidPatientId,
      parentId: uuidParentId,
      category: "HEALTH",
    });

    expect(mockedPrisma.parentPatient.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          parentId: uuidParentId,
          patientId: uuidPatientId,
        }),
      }),
    );
    expect(mockedPrisma.document.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          patientId: uuidPatientId,
          category: "HEALTH",
        }),
      }),
    );
    expect(result).toHaveLength(1);
  });

  it("lists documents for pms using postgres ids", async () => {
    const result = await DocumentService.listForPms({
      patientId: uuidPatientId,
      organisationId: uuidOrganisationId,
      appointmentId: uuidAppointmentId,
    });

    expect(mockedPrisma.patientOrganisation.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organisationId: uuidOrganisationId,
          patientId: uuidPatientId,
        }),
      }),
    );
    expect(mockedPrisma.document.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          patientId: uuidPatientId,
          appointmentId: uuidAppointmentId,
          pmsVisible: true,
        }),
      }),
    );
    expect(result).toHaveLength(1);
  });

  it("loads appointment documents from postgres only", async () => {
    mockedPrisma.document.findMany.mockResolvedValueOnce([
      {
        ...baseRow,
        appointmentId: uuidAppointmentId,
        attachments: baseRow.attachments,
      },
    ] as any);

    const result = await DocumentService.listForAppointmentParent({
      appointmentId: uuidAppointmentId,
      parentId: uuidParentId,
    });

    expect(mockedPrisma.appointment.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: uuidAppointmentId },
      }),
    );
    expect(result).toHaveLength(1);
  });

  it("updates and deletes documents in postgres", async () => {
    mockedPrisma.document.update.mockResolvedValueOnce({
      ...baseRow,
      title: "Updated title",
      attachments: baseRow.attachments,
    } as any);

    const updated = await DocumentService.update(
      uuidDocumentId,
      { title: "Updated title" },
      { parentId: uuidParentId, organisationId: uuidOrganisationId },
    );

    expect(mockedPrisma.document.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: uuidDocumentId },
        data: expect.objectContaining({ title: "Updated title" }),
      }),
    );
    expect(updated.title).toBe("Updated title");

    await DocumentService.deleteForParent(uuidDocumentId, uuidParentId);
    expect(mockedUpload.deleteFromS3).toHaveBeenCalledWith("k-1");
    expect(mockedPrisma.document.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: uuidDocumentId },
      }),
    );
  });

  it("returns attachment urls and supports key lookup", async () => {
    mockedPrisma.document.findUnique.mockResolvedValueOnce({
      ...baseRow,
      attachments: [{ key: "k-1", mimeType: "image/png", size: 123 }],
    } as any);

    const urls = await DocumentService.getAllAttachmentUrls({
      documentId: uuidDocumentId,
      parentId: uuidParentId,
    });

    expect(urls).toEqual([
      {
        url: "https://download/url",
        mimeType: "image/png",
        key: "k-1",
      },
    ]);

    const signed = await DocumentService.getAttachmentUrlByKey({
      key: "k-1",
      organisationId: uuidOrganisationId,
    });

    expect(signed).toBe("https://download/url");
  });

  it("searches by title with postgres ids", async () => {
    await DocumentService.searchByTitleForParent({
      patientId: uuidPatientId,
      parentId: uuidParentId,
      title: "vacc",
    });

    expect(mockedPrisma.document.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          patientId: uuidPatientId,
          title: expect.objectContaining({
            contains: "vacc",
          }),
        }),
      }),
    );
  });

  it("rejects invalid inputs", async () => {
    await expect(
      DocumentService.create(
        {
          patientId: uuidPatientId,
          category: "INVALID",
          title: "Doc",
          attachments: [{ key: "k-1", mimeType: "image/png" }],
        },
        { parentId: uuidParentId },
      ),
    ).rejects.toBeInstanceOf(DocumentServiceError);

    await expect(
      DocumentService.create(
        {
          patientId: uuidPatientId,
          category: "HEALTH",
          subcategory: "INVALID",
          title: "Doc",
          attachments: [{ key: "k-1", mimeType: "image/png" }],
        },
        { parentId: uuidParentId },
      ),
    ).rejects.toThrow(
      new DocumentServiceError(
        "Invalid subcategory 'INVALID' for category 'HEALTH'",
        400,
      ),
    );

    await expect(
      DocumentService.searchByTitleForParent({
        patientId: uuidPatientId,
        parentId: uuidParentId,
        title: "",
      }),
    ).rejects.toThrow(
      new DocumentServiceError("Search title is required.", 400),
    );
  });
});
