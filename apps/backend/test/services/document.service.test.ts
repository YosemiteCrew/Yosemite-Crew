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

  describe("listForAppointmentPms tenant scope", () => {
    const victimOrganisationId = "9f1b2c3d-4e5f-4a6b-8c7d-0e1f2a3b4c5d";

    it("refuses an appointment owned by another organisation", async () => {
      mockedPrisma.appointment.findUnique.mockResolvedValue({
        organisationId: victimOrganisationId,
        patient: { id: uuidPatientId },
      } as any);

      await expect(
        DocumentService.listForAppointmentPms({
          appointmentId: uuidAppointmentId,
          organisationId: uuidOrganisationId,
        }),
      ).rejects.toMatchObject({ statusCode: 404 });

      // The leak was loading the victim's rendered documents off the org read
      // from the attacker-supplied appointment.
      expect(mockedPrisma.renderedDocument.findMany).not.toHaveBeenCalled();
      expect(mockedPrisma.document.findMany).not.toHaveBeenCalled();
    });

    it("reads rendered documents for the caller's own organisation, never the appointment's", async () => {
      await DocumentService.listForAppointmentPms({
        appointmentId: uuidAppointmentId,
        organisationId: uuidOrganisationId,
      });

      expect(mockedPrisma.renderedDocument.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organisationId: uuidOrganisationId,
          }),
        }),
      );
    });

    it("scopes documents through patientOrganisation and hides parent-private uploads", async () => {
      await DocumentService.listForAppointmentPms({
        appointmentId: uuidAppointmentId,
        organisationId: uuidOrganisationId,
      });

      expect(mockedPrisma.document.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            appointmentId: uuidAppointmentId,
            pmsVisible: true,
            patient: {
              organisations: {
                some: {
                  organisationId: uuidOrganisationId,
                  status: { in: ["ACTIVE", "PENDING"] },
                },
              },
            },
          }),
        }),
      );
    });

    it("returns nothing when the appointment has no resolvable patient for a parent", async () => {
      mockedPrisma.appointment.findUnique.mockResolvedValue({
        organisationId: uuidOrganisationId,
        patient: null,
      } as any);

      const result = await DocumentService.listForAppointmentParent({
        appointmentId: uuidAppointmentId,
        parentId: uuidParentId,
      });

      expect(result).toEqual([]);
      expect(mockedPrisma.renderedDocument.findMany).not.toHaveBeenCalled();
    });

    it("returns nothing when the appointment's patient is not the parent's", async () => {
      mockedPrisma.appointment.findUnique.mockResolvedValue({
        organisationId: uuidOrganisationId,
        patient: { id: "11112222-3333-4444-5555-666677778888" },
      } as any);

      const result = await DocumentService.listForAppointmentParent({
        appointmentId: uuidAppointmentId,
        parentId: uuidParentId,
      });

      expect(result).toEqual([]);
      expect(mockedPrisma.renderedDocument.findMany).not.toHaveBeenCalled();
    });
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

  it("updates a synced document as a PMS user with new categorization and attachments", async () => {
    mockedPrisma.document.findUnique.mockResolvedValueOnce({
      ...baseRow,
      uploadedByParentId: null,
      uploadedByPmsUserId: "pms-1",
      syncedFromPms: true,
      attachments: baseRow.attachments,
    } as any);
    mockedPrisma.document.update.mockResolvedValueOnce({
      ...baseRow,
      category: "ADMIN",
      subcategory: "PASSPORT",
      syncedFromPms: true,
      attachments: baseRow.attachments,
    } as any);

    const updated = await DocumentService.update(
      uuidDocumentId,
      {
        category: "admin",
        subcategory: "passport",
        attachments: [{ key: "k-2", mimeType: "application/pdf", size: 5 }],
      },
      { pmsUserId: "pms-1", organisationId: uuidOrganisationId },
    );

    expect(mockedPrisma.document.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          category: "ADMIN",
          subcategory: "PASSPORT",
          pmsVisible: true,
        }),
      }),
    );
    expect(mockedPrisma.documentAttachment.deleteMany).toHaveBeenCalledWith({
      where: { documentId: uuidDocumentId },
    });
    expect(mockedPrisma.documentAttachment.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [
          expect.objectContaining({ documentId: uuidDocumentId, key: "k-2" }),
        ],
      }),
    );
    expect(mockedAuditTrail.recordSafely).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "DOCUMENT_UPDATED",
        actorType: "PMS_USER",
        actorId: "pms-1",
      }),
    );
    expect(updated.category).toBe("ADMIN");
  });

  it("clears the subcategory when the update sets it to null", async () => {
    mockedPrisma.document.findUnique.mockResolvedValueOnce({
      ...baseRow,
      subcategory: "PRESCRIPTION",
      attachments: baseRow.attachments,
    } as any);
    mockedPrisma.document.update.mockResolvedValueOnce({
      ...baseRow,
      subcategory: null,
      attachments: baseRow.attachments,
    } as any);

    await DocumentService.update(
      uuidDocumentId,
      { subcategory: null },
      { parentId: uuidParentId },
    );

    expect(mockedPrisma.document.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ subcategory: undefined }),
      }),
    );
  });

  it("enforces update permissions", async () => {
    mockedPrisma.document.findUnique.mockResolvedValueOnce(null);
    await expect(
      DocumentService.update(uuidDocumentId, {}, { parentId: uuidParentId }),
    ).rejects.toMatchObject({ statusCode: 404 });

    mockedPrisma.document.findUnique.mockResolvedValueOnce({
      ...baseRow,
      uploadedByParentId: "someone-else",
      attachments: baseRow.attachments,
    } as any);
    await expect(
      DocumentService.update(uuidDocumentId, {}, { parentId: uuidParentId }),
    ).rejects.toMatchObject({ statusCode: 403 });

    mockedPrisma.document.findUnique.mockResolvedValueOnce({
      ...baseRow,
      syncedFromPms: true,
      attachments: baseRow.attachments,
    } as any);
    await expect(
      DocumentService.update(uuidDocumentId, {}, { pmsUserId: "pms-1" }),
    ).rejects.toMatchObject({ statusCode: 400 });

    mockedPrisma.document.findUnique.mockResolvedValueOnce({
      ...baseRow,
      syncedFromPms: false,
      attachments: baseRow.attachments,
    } as any);
    await expect(
      DocumentService.update(
        uuidDocumentId,
        {},
        { pmsUserId: "pms-1", organisationId: uuidOrganisationId },
      ),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("maps rendered documents with signing status for appointment listings", async () => {
    const renderedBase = {
      organisationId: uuidOrganisationId,
      sourceKind: "TEMPLATE_INSTANCE",
      templateId: "tpl-1",
      templateVersion: 2,
      kind: "SOAP_NOTE",
      title: "Soap note",
      pdfUrl: "https://pdf/url",
      createdAt: now,
      updatedAt: now,
      templateInstance: { appointmentId: uuidAppointmentId, encounterId: null },
      clinicalArtifact: null,
    };
    mockedPrisma.renderedDocument.findMany.mockResolvedValueOnce([
      {
        ...renderedBase,
        id: "rd-1",
        sourceId: "src-1",
        status: "DRAFT",
        signing: { status: "IN_PROGRESS" },
      },
      {
        ...renderedBase,
        id: "rd-2",
        sourceId: "src-2",
        status: "SIGNED",
        signing: null,
      },
      {
        ...renderedBase,
        id: "rd-3",
        sourceId: "src-3",
        status: "DRAFT",
        signing: [],
        templateInstance: null,
      },
    ] as any);

    const result = await DocumentService.listForAppointmentParent({
      appointmentId: uuidAppointmentId,
      parentId: uuidParentId,
    });

    const byId = new Map(result.map((doc) => [doc.id, doc]));
    expect(byId.get("rd-1")).toMatchObject({
      signingStatus: "IN_PROGRESS",
      pmsVisible: false,
      appointmentId: uuidAppointmentId,
      templateId: "tpl-1",
    });
    expect(byId.get("rd-2")).toMatchObject({
      signingStatus: "SIGNED",
      pmsVisible: true,
    });
    expect(byId.get("rd-3")).toMatchObject({
      signingStatus: "NOT_STARTED",
      patientId: "src-3",
      appointmentId: null,
    });
  });

  it("rejects attachment lookups without a requester scope", async () => {
    await expect(
      DocumentService.getAllAttachmentUrls({ documentId: uuidDocumentId }),
    ).rejects.toMatchObject({ statusCode: 404 });

    await expect(
      DocumentService.getAttachmentUrlByKey({ key: "k-1" }),
    ).rejects.toMatchObject({ statusCode: 404 });
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

  // Guards against the taxonomy drifting away from the clients again. Every
  // value below is one the web picker (apps/frontend .. companionDocuments.ts)
  // or the mobile SUBCATEGORY_API_MAP actually puts on the wire; when the
  // server-side set stopped accepting one, the upload failed with a 400 on a
  // choice the UI had offered the user.
  it.each([
    ["ADMIN", "PASSPORT"],
    ["ADMIN", "CERTIFICATES"],
    ["ADMIN", "INSURANCE"],
    ["HEALTH", "SURGERY_OR_PROCEDURE"],
    ["HEALTH", "PRESCRIPTION"],
    ["HEALTH", "VACCINATION"],
    ["HEALTH", "DISCHARGE_SUMMARY"],
    ["HEALTH", "LAB_TEST"],
    ["HEALTH", "IMAGING_OR_DIAGNOSTIC"],
    ["HEALTH", "PARASITE_PREVENTION"],
    ["HEALTH", "MEDICAL_CONDITION"],
    ["HEALTH", "OTHER"],
    ["HYGIENE_MAINTENANCE", "BATHING"],
    ["HYGIENE_MAINTENANCE", "NAIL_TRIM"],
    ["HYGIENE_MAINTENANCE", "GROOMING"],
    ["HYGIENE_MAINTENANCE", "EAR_CLEANING"],
    ["HYGIENE_MAINTENANCE", "DENTAL_CLEANING"],
    ["HYGIENE_MAINTENANCE", "SKIN_CARE"],
    ["HYGIENE_MAINTENANCE", "ANAL_GLAND_EXPRESSION"],
    ["HYGIENE_MAINTENANCE", "OTHER"],
    ["DIETARY_PLANS", "NUTRITION_PLANS"],
  ])(
    "accepts the %s/%s pair the clients send",
    async (category, subcategory) => {
      await expect(
        DocumentService.create(
          {
            patientId: uuidPatientId,
            category,
            subcategory,
            title: "Doc",
            attachments: [{ key: "k-1", mimeType: "image/png" }],
          },
          { parentId: uuidParentId },
        ),
      ).resolves.toBeDefined();
    },
  );

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
