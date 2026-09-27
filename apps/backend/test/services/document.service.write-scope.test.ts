// Document writes stay inside the caller's scope: a practice adds documents
// only for its own companions and appointments and updates only what its own
// active staff uploaded, a parent deletes only while they may still reach the
// companion's documents, and every attachment added from a request is a file
// uploaded for the document's own companion that no other record uses.

import {
  assertCompanionAttachmentKeys,
  DocumentService,
} from "../../src/services/document.service";
import { prisma } from "src/config/prisma";
import { deleteFromS3 } from "src/middlewares/upload";

jest.mock("src/middlewares/upload", () => ({
  __esModule: true,
  deleteFromS3: jest.fn(),
  generatePresignedDownloadUrl: jest.fn(),
}));

jest.mock("../../src/services/audit-trail.service", () => ({
  __esModule: true,
  AuditTrailService: { recordSafely: jest.fn() },
}));

jest.mock("src/config/prisma", () => ({
  prisma: {
    parentPatient: { findFirst: jest.fn() },
    patientOrganisation: { findFirst: jest.fn() },
    patient: { findUnique: jest.fn() },
    userOrganization: { findMany: jest.fn() },
    appointment: { findUnique: jest.fn() },
    document: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
    },
    documentAttachment: {
      createMany: jest.fn(),
      deleteMany: jest.fn(),
      findMany: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

type Row = Record<string, unknown>;
const db = prisma as unknown as Record<string, Record<string, jest.Mock>>;
const transaction = prisma.$transaction as unknown as jest.Mock;
const s3Delete = deleteFromS3 as jest.Mock;

const ORG = "org-a";
const OTHER_ORG = "org-b";
const PARENT = "parent-caller";
const COMPANION = "companion-caller";
const OTHER_COMPANION = "companion-other";
const DOCUMENT = "document-1";
const key = (patientId = COMPANION, file = "0f4d.pdf") =>
  `companion/${patientId}/${file}`;

// Applies a Prisma `where` the way Prisma does - an omitted field matches
// everything - so a loosened filter lets the wrong row through instead of
// passing unnoticed.
const matches = (row: Row, where: Row): boolean =>
  Object.entries(where).every(([field, filter]) => {
    if (filter === undefined) return true;
    if (field === "OR") {
      return (filter as Row[]).some((branch) => matches(row, branch));
    }
    if (filter && typeof filter === "object" && "in" in filter) {
      return (filter as { in: unknown[] }).in.includes(row[field]);
    }
    if (filter && typeof filter === "object" && "not" in filter) {
      return row[field] !== (filter as { not: unknown }).not;
    }
    return row[field] === filter;
  });

const tables = {
  links: [] as Row[],
  memberships: [] as Row[],
  appointments: [] as Row[],
  documents: [] as Row[],
  patients: [] as Row[],
  staff: [] as Row[],
};

// Every stored attachment, as `DocumentAttachment` rows.
const attachmentRows = (): Row[] =>
  tables.documents.flatMap((doc) =>
    (doc.attachments as Row[]).map((attachment) => ({
      documentId: doc.id,
      key: attachment.key,
    })),
  );

const PHOTO = key(COMPANION, "b7e1.jpg");

const link = (overrides: Row = {}): Row => ({
  parentId: PARENT,
  patientId: COMPANION,
  role: "PRIMARY",
  status: "ACTIVE",
  permissions: {},
  ...overrides,
});

const documentRow = (overrides: Row = {}): Row => ({
  id: DOCUMENT,
  patientId: COMPANION,
  appointmentId: null,
  category: "HEALTH",
  subcategory: null,
  visitType: null,
  title: "Vaccination card",
  issuingBusinessName: null,
  issueDate: null,
  uploadedByParentId: PARENT,
  uploadedByPmsUserId: null,
  pmsVisible: true,
  syncedFromPms: false,
  createdAt: new Date("2026-09-01T00:00:00.000Z"),
  updatedAt: new Date("2026-09-01T00:00:00.000Z"),
  attachments: [{ key: key(), mimeType: "application/pdf", size: 1 }],
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  tables.links = [link()];
  tables.memberships = [
    { patientId: COMPANION, organisationId: ORG, status: "ACTIVE" },
    { patientId: "companion-pending", organisationId: ORG, status: "PENDING" },
  ];
  tables.appointments = [
    { id: "appt-caller", organisationId: ORG, patient: { id: COMPANION } },
    {
      id: "appt-other-family",
      organisationId: ORG,
      patient: { id: OTHER_COMPANION },
    },
    {
      id: "appt-other-org",
      organisationId: OTHER_ORG,
      patient: { id: COMPANION },
    },
  ];
  tables.documents = [documentRow()];
  tables.patients = [
    { id: COMPANION, photoUrl: `https://cdn.example.test/${PHOTO}` },
  ];
  tables.staff = [
    {
      practitionerReference: "pms-1",
      organizationReference: ORG,
      active: true,
    },
    {
      practitionerReference: "pms-other-org",
      organizationReference: OTHER_ORG,
      active: true,
    },
    {
      practitionerReference: "pms-left",
      organizationReference: ORG,
      active: false,
    },
  ];

  const findIn =
    (rows: () => Row[]) =>
    async ({ where }: { where: Row }) =>
      rows().find((row) => matches(row, where)) ?? null;
  db.parentPatient.findFirst.mockImplementation(findIn(() => tables.links));
  db.patientOrganisation.findFirst.mockImplementation(
    findIn(() => tables.memberships),
  );
  db.appointment.findUnique.mockImplementation(
    findIn(() => tables.appointments),
  );
  db.patient.findUnique.mockImplementation(findIn(() => tables.patients));
  db.userOrganization.findMany.mockImplementation(
    async ({ where }: { where: Row }) =>
      tables.staff.filter((row) => matches(row, where)),
  );
  db.documentAttachment.findMany.mockImplementation(
    async ({ where }: { where: Row }) =>
      attachmentRows().filter((row) => matches(row, where)),
  );
  db.document.findFirst.mockImplementation(findIn(() => tables.documents));
  db.document.findUnique.mockImplementation(findIn(() => tables.documents));
  db.document.create.mockResolvedValue({ id: DOCUMENT });
  db.document.update.mockImplementation(async () => tables.documents[0]);
  transaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
    fn(prisma),
  );
});

describe("assertCompanionAttachmentKeys", () => {
  it("accepts files uploaded for the companion", () => {
    expect(() =>
      assertCompanionAttachmentKeys(COMPANION, [
        { key: key() },
        { key: key(COMPANION, "a1-b2.jpeg") },
      ]),
    ).not.toThrow();
  });

  it.each([
    ["another companion's file", key(OTHER_COMPANION)],
    ["a file outside the companion folders", "orgs/org-a/0f4d.pdf"],
    ["a nested path", key(COMPANION, "nested/0f4d.pdf")],
    ["a parent directory segment", key(COMPANION, "../companion-other/x.pdf")],
    ["a dot file name", key(COMPANION, "..")],
    ["the bare prefix", key(COMPANION, "")],
    ["a prefix of a longer companion id", `companion/${COMPANION}x/0f4d.pdf`],
    ["a key that is not a string", { not: "" }],
  ])("rejects %s", (_label, attachmentKey) => {
    expect(() =>
      assertCompanionAttachmentKeys(COMPANION, [
        { key: key() },
        { key: attachmentKey },
      ]),
    ).toThrow(expect.objectContaining({ statusCode: 400 }));
  });

  it("leaves a list that is not an array to the document validation", () => {
    expect(() =>
      assertCompanionAttachmentKeys(COMPANION, undefined),
    ).not.toThrow();
  });
});

describe("DocumentService.create", () => {
  const create = (fields: Row, context: Row) =>
    DocumentService.create(
      {
        patientId: COMPANION,
        category: "HEALTH",
        title: "Lab report",
        attachments: [
          { key: key(COMPANION, "fresh.pdf"), mimeType: "application/pdf" },
        ],
        ...fields,
      } as never,
      context,
    );

  const asPractice = { pmsUserId: "pms-1", organisationId: ORG };
  const asParent = { parentId: PARENT };

  const expectNotCreated = async (
    pending: Promise<unknown>,
    message: string,
  ) => {
    await expect(pending).rejects.toMatchObject({ statusCode: 404, message });
    expect(db.document.create).not.toHaveBeenCalled();
  };

  it("adds a document for the practice's own companion and appointment", async () => {
    await create({ appointmentId: "appt-caller" }, asPractice);

    expect(db.document.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        patientId: COMPANION,
        appointmentId: "appt-caller",
      }),
    });
  });

  it("returns 404 for a companion that is not the practice's", async () => {
    await expectNotCreated(
      create({ patientId: OTHER_COMPANION }, asPractice),
      "Companion not found.",
    );
    await expectNotCreated(
      create({ patientId: "companion-pending" }, asPractice),
      "Companion not found.",
    );
  });

  it("returns 404 for an appointment at another organisation", async () => {
    await expectNotCreated(
      create({ appointmentId: "appt-other-org" }, asPractice),
      "Appointment not found.",
    );
  });

  it("returns 404 for another companion's appointment", async () => {
    await expectNotCreated(
      create({ appointmentId: "appt-other-family" }, asParent),
      "Appointment not found.",
    );
    await expectNotCreated(
      create({ appointmentId: "appt-other-family" }, asPractice),
      "Appointment not found.",
    );
  });

  it("returns 404 for an appointment that does not exist", async () => {
    await expectNotCreated(
      create({ appointmentId: "appt-missing" }, asParent),
      "Appointment not found.",
    );
  });

  it("adds a parent's document for their companion's appointment", async () => {
    await create({ appointmentId: "appt-other-org" }, asParent);

    expect(db.document.create).toHaveBeenCalled();
    expect(db.patientOrganisation.findFirst).not.toHaveBeenCalled();
  });

  it.each([
    ["a file another document already uses", key()],
    ["the companion's profile photo", PHOTO],
  ])("returns 400 for %s", async (_label, usedKey) => {
    for (const context of [asParent, asPractice]) {
      await expect(
        create(
          { attachments: [{ key: usedKey, mimeType: "application/pdf" }] },
          context,
        ),
      ).rejects.toMatchObject({
        statusCode: 400,
        message: "Invalid attachment key.",
      });
    }
    expect(db.document.create).not.toHaveBeenCalled();
    expect(db.documentAttachment.createMany).not.toHaveBeenCalled();
  });

  it("adds a file no other record uses", async () => {
    await create({}, asParent);

    expect(db.documentAttachment.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ key: key(COMPANION, "fresh.pdf") })],
    });
  });
});

describe("DocumentService.update attachments", () => {
  const update = (attachments: Row[]) =>
    DocumentService.update(DOCUMENT, { attachments } as never, {
      parentId: PARENT,
    });

  it("returns 400 for a new attachment outside the companion's files", async () => {
    await expect(
      update([{ key: key(OTHER_COMPANION), mimeType: "application/pdf" }]),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(db.document.update).not.toHaveBeenCalled();
    expect(db.documentAttachment.deleteMany).not.toHaveBeenCalled();
  });

  it("keeps an attachment the document already has", async () => {
    tables.documents = [
      documentRow({
        attachments: [{ key: "legacy/0f4d.pdf", mimeType: "application/pdf" }],
      }),
    ];

    await update([
      { key: "legacy/0f4d.pdf", mimeType: "application/pdf" },
      { key: key(COMPANION, "new.pdf"), mimeType: "application/pdf" },
    ]);

    expect(db.documentAttachment.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({ key: "legacy/0f4d.pdf" }),
        expect.objectContaining({ key: key(COMPANION, "new.pdf") }),
      ],
    });
  });

  const expectUnchanged = async (pending: Promise<unknown>) => {
    await expect(pending).rejects.toMatchObject({
      statusCode: 400,
      message: "Invalid attachment key.",
    });
    expect(db.document.update).not.toHaveBeenCalled();
    expect(db.documentAttachment.deleteMany).not.toHaveBeenCalled();
    expect(db.documentAttachment.createMany).not.toHaveBeenCalled();
  };

  it("returns 400 for a new attachment another document already uses", async () => {
    tables.documents = [
      documentRow({
        attachments: [{ key: key(COMPANION, "mine.pdf"), mimeType: "a" }],
      }),
      documentRow({
        id: "document-practice",
        uploadedByParentId: null,
        uploadedByPmsUserId: "pms-1",
        syncedFromPms: true,
        attachments: [{ key: key(COMPANION, "practice.pdf"), mimeType: "a" }],
      }),
    ];

    await expectUnchanged(
      update([
        { key: key(COMPANION, "mine.pdf"), mimeType: "application/pdf" },
        { key: key(COMPANION, "practice.pdf"), mimeType: "application/pdf" },
      ]),
    );
  });

  it("returns 400 for the companion's profile photo as a new attachment", async () => {
    await expectUnchanged(update([{ key: PHOTO, mimeType: "image/jpeg" }]));
  });

  it("returns 400 for an attachment entry that is not an object", async () => {
    await expectUnchanged(
      update([{ key: key(), mimeType: "application/pdf" }, null as never]),
    );
  });
});

describe("DocumentService.deleteForParent", () => {
  const expectKept = async () => {
    await expect(
      DocumentService.deleteForParent(DOCUMENT, PARENT),
    ).rejects.toMatchObject({
      statusCode: 404,
      message: "Document not found.",
    });
    expect(s3Delete).not.toHaveBeenCalled();
    expect(db.document.deleteMany).not.toHaveBeenCalled();
  };

  it("deletes the caller's upload while they may reach the companion's documents", async () => {
    await DocumentService.deleteForParent(DOCUMENT, PARENT);

    expect(s3Delete).toHaveBeenCalledWith(key());
    expect(db.document.deleteMany).toHaveBeenCalledWith({
      where: { id: DOCUMENT },
    });
  });

  it("deletes for a co-parent with the documents permission", async () => {
    tables.links = [
      link({ role: "CO_PARENT", permissions: { documents: true } }),
    ];

    await DocumentService.deleteForParent(DOCUMENT, PARENT);

    expect(db.document.deleteMany).toHaveBeenCalled();
  });

  it("returns 404 for a co-parent without the documents permission", async () => {
    tables.links = [
      link({ role: "CO_PARENT", permissions: { documents: false } }),
    ];

    await expectKept();
  });

  it.each(["PENDING", "REVOKED"])(
    "returns 404 once the caller's link is %s",
    async (status) => {
      tables.links = [link({ status })];

      await expectKept();
    },
  );

  it("returns 404 for a document another parent uploaded", async () => {
    tables.documents = [documentRow({ uploadedByParentId: "parent-other" })];

    await expectKept();
  });

  it("keeps a stored file another record still uses", async () => {
    const shared = key(COMPANION, "shared.pdf");
    tables.documents = [
      documentRow({
        attachments: [
          { key: shared, mimeType: "application/pdf" },
          { key: PHOTO, mimeType: "image/jpeg" },
          { key: key(COMPANION, "only-mine.pdf"), mimeType: "application/pdf" },
        ],
      }),
      documentRow({
        id: "document-practice",
        uploadedByParentId: null,
        attachments: [{ key: shared, mimeType: "application/pdf" }],
      }),
    ];

    await DocumentService.deleteForParent(DOCUMENT, PARENT);

    expect(s3Delete.mock.calls).toEqual([[key(COMPANION, "only-mine.pdf")]]);
    expect(db.document.deleteMany).toHaveBeenCalledWith({
      where: { id: DOCUMENT },
    });
  });
});

describe("DocumentService.update from the PMS", () => {
  const practiceDocument = (overrides: Row = {}) =>
    documentRow({
      uploadedByParentId: null,
      uploadedByPmsUserId: "pms-1",
      syncedFromPms: true,
      ...overrides,
    });

  const update = (organisationId = ORG) =>
    DocumentService.update(
      DOCUMENT,
      { title: "Renamed", attachments: [] } as never,
      { pmsUserId: "pms-caller", organisationId },
    );

  const expectHidden = async (pending: Promise<unknown>) => {
    await expect(pending).rejects.toMatchObject({
      statusCode: 404,
      message: "Document not found.",
    });
    expect(db.document.update).not.toHaveBeenCalled();
    expect(db.documentAttachment.deleteMany).not.toHaveBeenCalled();
  };

  it("updates a document the practice's active staff uploaded", async () => {
    tables.documents = [practiceDocument()];

    await update();

    expect(db.document.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: DOCUMENT } }),
    );
    expect(db.documentAttachment.deleteMany).toHaveBeenCalledWith({
      where: { documentId: DOCUMENT },
    });
  });

  it("updates for staff stored under the FHIR organisation reference", async () => {
    tables.documents = [practiceDocument()];
    tables.staff = [
      {
        practitionerReference: "pms-1",
        organizationReference: `Organization/${ORG}`,
        active: true,
      },
    ];

    await update();

    expect(db.document.update).toHaveBeenCalled();
  });

  it.each([
    ["the companion's link is PENDING", { patientId: "companion-pending" }],
    ["the companion is not linked", { patientId: OTHER_COMPANION }],
    [
      "another organisation's staff uploaded it",
      { uploadedByPmsUserId: "pms-other-org" },
    ],
    [
      "the uploader has left the organisation",
      { uploadedByPmsUserId: "pms-left" },
    ],
    ["no uploader was recorded", { uploadedByPmsUserId: null }],
  ])("returns 404 when %s", async (_label, overrides) => {
    tables.documents = [practiceDocument(overrides)];

    await expectHidden(update());
  });

  it("returns 403 for a document a parent uploaded", async () => {
    await expect(update()).rejects.toMatchObject({ statusCode: 403 });
    expect(db.document.update).not.toHaveBeenCalled();
  });
});
