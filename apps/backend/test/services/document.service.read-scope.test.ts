// A practice reads a companion's documents only while it holds an ACTIVE link
// to that companion. A link the parent has not approved yet (PENDING), or one
// that has ended (REVOKED), reads as a missing document.

import { DocumentService } from "../../src/services/document.service";
import { documentWhereForOrg } from "../../src/services/document-scope";
import { prisma } from "src/config/prisma";
import { generatePresignedDownloadUrl } from "src/middlewares/upload";

jest.mock("src/middlewares/upload", () => ({
  __esModule: true,
  deleteFromS3: jest.fn(),
  generatePresignedDownloadUrl: jest.fn(async (key: string) => `cdn/${key}`),
}));

jest.mock("src/config/prisma", () => ({
  prisma: {
    patientOrganisation: { findFirst: jest.fn() },
    document: { findUnique: jest.fn(), findMany: jest.fn() },
    documentAttachment: { findFirst: jest.fn() },
    appointment: { findUnique: jest.fn(), findMany: jest.fn() },
    case: { findMany: jest.fn() },
    encounter: { findMany: jest.fn() },
    renderedDocument: { findMany: jest.fn() },
  },
}));

type Row = Record<string, unknown>;
const db = prisma as unknown as Record<string, Record<string, jest.Mock>>;

const ORG = "org-a";
const OTHER_ORG = "org-b";
const DOCUMENT = "document-1";
const APPOINTMENT = "appointment-1";
const FILE = "companion/companion-1/report.pdf";

// Applies a Prisma `where` the way Prisma does - an omitted field matches
// everything - so a loosened status filter lets the wrong link through.
const matches = (row: Row, where: Row): boolean =>
  Object.entries(where).every(([field, filter]) => {
    if (filter === undefined) return true;
    if (filter && typeof filter === "object" && "in" in filter) {
      return (filter as { in: unknown[] }).in.includes(row[field]);
    }
    return row[field] === filter;
  });

let links: Row[] = [];

const linkCompanion = (status: string, organisationId = ORG) => {
  links = [{ patientId: "companion-1", organisationId, status }];
};

const documentRow = (): Row => ({
  id: DOCUMENT,
  patientId: "companion-1",
  appointmentId: APPOINTMENT,
  category: "HEALTH",
  subcategory: null,
  title: "Lab report",
  pmsVisible: true,
  syncedFromPms: true,
  uploadedByParentId: null,
  uploadedByPmsUserId: "pms-1",
  createdAt: new Date("2026-09-01T00:00:00.000Z"),
  updatedAt: new Date("2026-09-01T00:00:00.000Z"),
  attachments: [{ key: FILE, mimeType: "application/pdf", size: 1 }],
});

beforeEach(() => {
  jest.clearAllMocks();
  linkCompanion("ACTIVE");
  db.patientOrganisation.findFirst.mockImplementation(
    async ({ where }: { where: Row }) =>
      links.find((row) => matches(row, where)) ?? null,
  );
  db.document.findUnique.mockResolvedValue(documentRow());
  db.document.findMany.mockResolvedValue([documentRow()]);
  db.documentAttachment.findFirst.mockResolvedValue({ documentId: DOCUMENT });
  db.appointment.findUnique.mockResolvedValue({
    id: APPOINTMENT,
    organisationId: ORG,
    patient: { id: "companion-1" },
  });
  db.appointment.findMany.mockResolvedValue([]);
  db.case.findMany.mockResolvedValue([]);
  db.encounter.findMany.mockResolvedValue([]);
  db.renderedDocument.findMany.mockResolvedValue([]);
});

const reads: Array<[string, () => Promise<unknown>]> = [
  ["the document details", () => DocumentService.getByIdForPms(DOCUMENT, ORG)],
  [
    "the signed download link",
    () =>
      DocumentService.getAttachmentUrlByKey({ key: FILE, organisationId: ORG }),
  ],
  [
    "the attachment links",
    () =>
      DocumentService.getAllAttachmentUrls({
        documentId: DOCUMENT,
        organisationId: ORG,
      }),
  ],
  [
    "the companion's document list",
    () =>
      DocumentService.listForPms({
        patientId: "companion-1",
        organisationId: ORG,
      }),
  ],
  [
    "the companion's consent documents",
    () =>
      DocumentService.listConsentDocumentsForPms({
        patientId: "companion-1",
        organisationId: ORG,
      }),
  ],
  [
    "the appointment's documents for the companion",
    () =>
      DocumentService.listForAppointmentPms({
        appointmentId: APPOINTMENT,
        organisationId: ORG,
        patientId: "companion-1",
      }),
  ],
];

describe("practice document reads", () => {
  it.each(reads)("returns %s for an ACTIVE link", async (_label, read) => {
    await expect(read()).resolves.toBeTruthy();
  });

  describe.each([
    ["a PENDING link", () => linkCompanion("PENDING")],
    ["a REVOKED link", () => linkCompanion("REVOKED")],
    ["another organisation's link", () => linkCompanion("ACTIVE", OTHER_ORG)],
  ])("with %s", (_label, arrange) => {
    it.each(reads)("returns 404 for %s", async (_read, read) => {
      arrange();

      await expect(read()).rejects.toMatchObject({
        statusCode: 404,
        message: "Document not found.",
      });
      expect(generatePresignedDownloadUrl).not.toHaveBeenCalled();
      expect(db.document.findMany).not.toHaveBeenCalled();
    });
  });
});

describe("documentWhereForOrg", () => {
  // Evaluates the scope against a document whose companion has `linkStatus`
  // with the organisation.
  const inScope = (linkStatus: string, pmsVisible = true) => {
    const where = documentWhereForOrg(ORG) as unknown as {
      pmsVisible: boolean;
      patient: { organisations: { some: Row } };
    };
    return (
      where.pmsVisible === pmsVisible &&
      matches(
        { organisationId: ORG, status: linkStatus },
        where.patient.organisations.some,
      )
    );
  };

  it("keeps a practice-visible document of an ACTIVE companion", () => {
    expect(inScope("ACTIVE")).toBe(true);
  });

  it.each(["PENDING", "REVOKED"])(
    "leaves out a companion whose link is %s",
    (status) => {
      expect(inScope(status)).toBe(false);
    },
  );

  it("leaves out a document the parent kept private", () => {
    expect(inScope("ACTIVE", false)).toBe(false);
  });
});
