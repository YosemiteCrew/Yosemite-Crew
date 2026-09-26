// What a pet parent may read through the mobile form routes.
//
// Submissions (getSubmission, listSubmissions, generatePDFForSubmission): the
// caller's own submissions (parent AND submitter), and those for a companion
// the caller holds an ACTIVE PRIMARY or CO_PARENT link to. A co-parent needs
// the appointments permission for a form a parent filled in, and the medical
// records permission for a row the practice wrote.
//
// SOAP notes (getSOAPNotesByAppointment): an ACTIVE link to the appointment's
// companion, and the medical records permission for a co-parent.

jest.mock("../../src/services/documenso.service", () => ({
  DocumensoService: { downloadSignedDocument: jest.fn() },
}));
jest.mock("../../src/services/audit-trail.service", () => ({
  AuditTrailService: { recordSafely: jest.fn() },
}));
jest.mock("../../src/services/template.service", () => ({
  TemplateService: { getById: jest.fn() },
}));
jest.mock("../../src/services/form-assignment.service", () => ({
  FormAssignmentService: {},
}));
jest.mock("../../src/services/fhir-template.mapper", () => ({
  templateMapper: {},
}));
jest.mock("../../src/services/formPDF.service", () => ({
  buildPdfViewModel: jest.fn(() => ({})),
  renderPdf: jest.fn(async () => Buffer.from("pdf")),
}));
jest.mock("src/config/prisma", () => ({
  prisma: {
    formSubmission: { findUnique: jest.fn(), findMany: jest.fn() },
    formVersion: { findFirst: jest.fn(), findMany: jest.fn() },
    parentPatient: { findMany: jest.fn(), findFirst: jest.fn() },
    appointment: { findUnique: jest.fn() },
    organization: { findUnique: jest.fn() },
    form: { findMany: jest.fn() },
  },
}));
jest.mock("@yosemite-crew/types", () => ({
  toFHIRQuestionnaireResponse: jest.fn((submission, schema) => ({
    ...submission,
    schema,
  })),
}));

import { FormService } from "../../src/services/form.service";
import { prisma } from "src/config/prisma";

const mockedPrisma = prisma as unknown as {
  formSubmission: { findUnique: jest.Mock; findMany: jest.Mock };
  formVersion: { findFirst: jest.Mock; findMany: jest.Mock };
  parentPatient: { findMany: jest.Mock; findFirst: jest.Mock };
  appointment: { findUnique: jest.Mock };
  organization: { findUnique: jest.Mock };
  form: { findMany: jest.Mock };
};

const CALLER = "parent-caller";
const OTHER_PARENT = "parent-other";
const STAFF = "practice-user";
const COMPANION = "companion-caller";
const OTHER_COMPANION = "companion-other";
const FORM = "form-org-a";
const OTHER_ORG_FORM = "form-org-b";
const APPOINTMENT = "appointment-1";
const SOAP_FORM = "soap-form";

type Row = Record<string, unknown>;

// Applies a Prisma `where` the way Prisma does - an omitted field matches
// everything - so a loosened filter lets the wrong row through instead of
// passing unnoticed.
const matches = (row: Row, where: Record<string, unknown>): boolean =>
  Object.entries(where).every(([key, filter]) => {
    if (key === "OR") {
      return (filter as Record<string, unknown>[]).some((w) => matches(row, w));
    }
    if (filter === undefined) return true;
    if (filter && typeof filter === "object" && "in" in filter) {
      return (filter as { in: unknown[] }).in.includes(row[key]);
    }
    return row[key] === filter;
  });

const VERSIONS: Row[] = [
  { formId: FORM, version: 1, schemaSnapshot: [{ id: "q-v1" }] },
  { formId: FORM, version: 2, schemaSnapshot: [{ id: "q-v2" }] },
  { formId: OTHER_ORG_FORM, version: 1, schemaSnapshot: [{ id: "q-b" }] },
];

let submissionRows: Row[] = [];

const useTables = (tables: { links: Row[]; submissions: Row[] }) => {
  submissionRows = tables.submissions;
  mockedPrisma.parentPatient.findMany.mockImplementation(async ({ where }) =>
    tables.links.filter((row) => matches(row, where)),
  );
  mockedPrisma.parentPatient.findFirst.mockImplementation(
    async ({ where }) =>
      tables.links.find((row) => matches(row, where)) ?? null,
  );
  mockedPrisma.formSubmission.findMany.mockImplementation(async ({ where }) =>
    tables.submissions.filter((row) => matches(row, where)),
  );
  mockedPrisma.formSubmission.findUnique.mockImplementation(
    async ({ where }) =>
      tables.submissions.find((row) => row.id === where.id) ?? null,
  );
};

const link = (overrides: Row = {}): Row => ({
  parentId: CALLER,
  patientId: COMPANION,
  role: "PRIMARY",
  status: "ACTIVE",
  permissions: {},
  ...overrides,
});

const coParent = (permissions: Row | null) =>
  link({ role: "CO_PARENT", permissions });

const submission = (id: string, overrides: Row = {}): Row => ({
  id,
  formId: FORM,
  formVersion: 1,
  parentId: OTHER_PARENT,
  patientId: OTHER_COMPANION,
  appointmentId: null,
  submittedBy: OTHER_PARENT,
  answers: { q: id },
  submittedAt: new Date("2026-09-01T00:00:00.000Z"),
  ...overrides,
});

// A form the caller filled in themselves.
const ownRow = (id = "own") =>
  submission(id, {
    parentId: CALLER,
    submittedBy: CALLER,
    patientId: COMPANION,
  });

// A row the practice wrote for the caller's companion: the practice stores its
// client as the parent and its own user as the submitter.
const practiceRowForCaller = (id = "practice-for-caller") =>
  submission(id, {
    parentId: CALLER,
    submittedBy: STAFF,
    patientId: COMPANION,
  });

// A form another parent (the primary) filled in for the caller's companion.
const otherParentsFormForCompanion = (id = "form-by-other-parent") =>
  submission(id, { patientId: COMPANION });

// A row the practice wrote for the other parent, about the caller's companion.
const practiceRowForCompanion = (id = "practice-for-companion") =>
  submission(id, { submittedBy: STAFF, patientId: COMPANION });

// Every row a caller must never see, whatever its links: another parent's
// submission for another companion, on this form and on another
// organisation's form.
const foreignRows = [
  submission("other-parent-same-form"),
  submission("other-parent-other-org", { formId: OTHER_ORG_FORM }),
];

const listIds = async (formId = FORM) =>
  ((await FormService.listSubmissions(formId, CALLER)) as unknown as Row[]).map(
    (row) => row._id,
  );

const hiddenAs404 = (error: { statusCode?: number; message?: string }) => {
  if (error.statusCode === 404 && error.message === "Submission not found") {
    return false;
  }
  throw error;
};

// Reads one submission id through every pet parent read path, so a path that
// drifts from the others fails the assertion.
const visibleThrough = async (id: string) => {
  const formId = (submissionRows.find((row) => row.id === id)?.formId ??
    FORM) as string;
  return {
    get: await FormService.getSubmission(id, CALLER).then(
      () => true,
      hiddenAs404,
    ),
    list: (await listIds(formId)).includes(id),
    pdf: await FormService.generatePDFForSubmission(id, CALLER).then(
      () => true,
      hiddenAs404,
    ),
  };
};

const SHOWN = { get: true, list: true, pdf: true };
const HIDDEN = { get: false, list: false, pdf: false };

beforeEach(() => {
  jest.clearAllMocks();
  mockedPrisma.formVersion.findFirst.mockImplementation(
    async ({ where }) => VERSIONS.find((row) => matches(row, where)) ?? null,
  );
  mockedPrisma.formVersion.findMany.mockImplementation(async ({ where }) =>
    VERSIONS.filter((row) => matches(row, where)),
  );
});

describe("FormService submission reads for a pet parent", () => {
  it("shows the caller's own submission", async () => {
    useTables({ links: [], submissions: [ownRow(), ...foreignRows] });

    await expect(visibleThrough("own")).resolves.toEqual(SHOWN);
    await expect(listIds()).resolves.toEqual(["own"]);
  });

  it("keeps the caller's own submission after their link is revoked", async () => {
    useTables({
      links: [link({ status: "REVOKED" })],
      submissions: [ownRow()],
    });

    await expect(visibleThrough("own")).resolves.toEqual(SHOWN);
  });

  it("returns 404 for a practice-written row naming the caller once the link is revoked", async () => {
    useTables({
      links: [link({ status: "REVOKED" })],
      submissions: [practiceRowForCaller(), ownRow()],
    });

    await expect(visibleThrough("practice-for-caller")).resolves.toEqual(
      HIDDEN,
    );
    await expect(listIds()).resolves.toEqual(["own"]);
  });

  it.each([
    ["a PENDING link", link({ status: "PENDING" })],
    ["no link at all", link({ parentId: OTHER_PARENT })],
  ])(
    "returns 404 for a practice-written row naming the caller through %s",
    async (_label, companionLink) => {
      useTables({
        links: [companionLink],
        submissions: [practiceRowForCaller()],
      });

      await expect(visibleThrough("practice-for-caller")).resolves.toEqual(
        HIDDEN,
      );
    },
  );

  it("shows a practice-written row to the primary parent of its companion", async () => {
    useTables({ links: [link()], submissions: [practiceRowForCaller()] });

    await expect(visibleThrough("practice-for-caller")).resolves.toEqual(SHOWN);
  });

  it("shows a practice-written row with no parent or submitter recorded to the primary parent", async () => {
    useTables({
      links: [link()],
      submissions: [
        submission("unattributed", {
          parentId: null,
          submittedBy: null,
          patientId: COMPANION,
        }),
      ],
    });

    await expect(visibleThrough("unattributed")).resolves.toEqual(SHOWN);
    await expect(
      FormService.getSubmission("unattributed", CALLER),
    ).resolves.toMatchObject({ parentId: undefined, submittedBy: undefined });
  });

  it("shows a submission for a companion the caller is the primary parent of", async () => {
    useTables({
      links: [link()],
      submissions: [otherParentsFormForCompanion(), ...foreignRows],
    });

    await expect(visibleThrough("form-by-other-parent")).resolves.toEqual(
      SHOWN,
    );
    await expect(listIds()).resolves.toEqual(["form-by-other-parent"]);
  });

  describe("for a co-parent", () => {
    it("shows a form a parent filled in with the appointments permission", async () => {
      useTables({
        links: [coParent({ appointments: true })],
        submissions: [otherParentsFormForCompanion()],
      });

      await expect(visibleThrough("form-by-other-parent")).resolves.toEqual(
        SHOWN,
      );
    });

    it("returns 404 for a form a parent filled in with only the medical records permission", async () => {
      useTables({
        links: [coParent({ medicalRecords: true })],
        submissions: [otherParentsFormForCompanion()],
      });

      await expect(visibleThrough("form-by-other-parent")).resolves.toEqual(
        HIDDEN,
      );
    });

    it("shows a practice-written row with the medical records permission", async () => {
      useTables({
        links: [coParent({ medicalRecords: true })],
        submissions: [practiceRowForCompanion()],
      });

      await expect(visibleThrough("practice-for-companion")).resolves.toEqual(
        SHOWN,
      );
    });

    it("returns 404 for a practice-written row with only the appointments permission", async () => {
      useTables({
        links: [coParent({ appointments: true })],
        submissions: [practiceRowForCompanion()],
      });

      await expect(visibleThrough("practice-for-companion")).resolves.toEqual(
        HIDDEN,
      );
    });

    it("treats a row with no recorded submitter as practice-written", async () => {
      const row = practiceRowForCompanion("no-submitter");
      row.submittedBy = null;
      useTables({
        links: [coParent({ appointments: true })],
        submissions: [row],
      });

      await expect(visibleThrough("no-submitter")).resolves.toEqual(HIDDEN);
    });
  });

  it("returns 404 for another parent's submission for another companion", async () => {
    useTables({ links: [link()], submissions: foreignRows });

    await expect(visibleThrough("other-parent-same-form")).resolves.toEqual(
      HIDDEN,
    );
    await expect(listIds()).resolves.toEqual([]);
  });

  it("returns 404 for a submission on another organisation's form", async () => {
    useTables({ links: [link()], submissions: foreignRows });

    await expect(visibleThrough("other-parent-other-org")).resolves.toEqual(
      HIDDEN,
    );
  });

  it("keeps the list to the requested form", async () => {
    useTables({
      links: [link()],
      submissions: [
        otherParentsFormForCompanion("this-form"),
        submission("other-form", {
          formId: OTHER_ORG_FORM,
          patientId: COMPANION,
        }),
      ],
    });

    await expect(listIds()).resolves.toEqual(["this-form"]);
  });

  it("returns 404 for a submission with no companion that the caller did not make", async () => {
    useTables({
      links: [link()],
      submissions: [submission("no-companion", { patientId: null })],
    });

    await expect(visibleThrough("no-companion")).resolves.toEqual(HIDDEN);
  });

  it.each([
    ["a PENDING link", link({ status: "PENDING" })],
    ["a REVOKED link", link({ status: "REVOKED" })],
    [
      "a co-parent without the appointments permission",
      coParent({ appointments: false }),
    ],
    ["a co-parent with no permissions recorded", coParent(null)],
    ["an ACTIVE link held by another parent", link({ parentId: OTHER_PARENT })],
  ])("returns 404 through %s", async (_label, companionLink) => {
    useTables({
      links: [companionLink],
      submissions: [otherParentsFormForCompanion("companion-row")],
    });

    await expect(visibleThrough("companion-row")).resolves.toEqual(HIDDEN);
  });

  it("returns 404 for an id that does not exist", async () => {
    useTables({ links: [link()], submissions: [] });

    await expect(visibleThrough("missing")).resolves.toEqual(HIDDEN);
    expect(mockedPrisma.formVersion.findFirst).not.toHaveBeenCalled();
  });

  it("reads no form version for a hidden submission", async () => {
    useTables({ links: [], submissions: foreignRows });

    await expect(
      FormService.getSubmission("other-parent-same-form", CALLER),
    ).rejects.toMatchObject({ statusCode: 404 });
    await expect(
      FormService.generatePDFForSubmission("other-parent-same-form", CALLER),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(mockedPrisma.formVersion.findFirst).not.toHaveBeenCalled();
  });

  it("rejects a blank parent id before reading anything", async () => {
    useTables({ links: [link()], submissions: foreignRows });

    await expect(
      FormService.getSubmission("other-parent-same-form", " "),
    ).rejects.toMatchObject({ statusCode: 400 });
    await expect(FormService.listSubmissions(FORM, "")).rejects.toMatchObject({
      statusCode: 400,
    });
    await expect(
      FormService.generatePDFForSubmission("other-parent-same-form", ""),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(mockedPrisma.formSubmission.findUnique).not.toHaveBeenCalled();
    expect(mockedPrisma.formSubmission.findMany).not.toHaveBeenCalled();
  });

  describe("list response", () => {
    it("maps each row like the single read, with its own version's schema and no signing data", async () => {
      useTables({
        links: [link()],
        submissions: [
          { ...ownRow("v1-row"), signing: { signers: [{ email: "x" }] } },
          {
            ...otherParentsFormForCompanion("v2-row"),
            formVersion: 2,
            signing: { status: "SIGNED" },
          },
        ],
      });

      const list = await FormService.listSubmissions(FORM, CALLER);

      expect(list).toEqual([
        await FormService.getSubmission("v1-row", CALLER),
        await FormService.getSubmission("v2-row", CALLER),
      ]);
      expect(list).toEqual([
        expect.objectContaining({ _id: "v1-row", schema: [{ id: "q-v1" }] }),
        expect.objectContaining({ _id: "v2-row", schema: [{ id: "q-v2" }] }),
      ]);
      for (const item of list as unknown as Row[]) {
        expect(item).not.toHaveProperty("signing");
        expect(item).not.toHaveProperty("id");
      }
    });

    it("reads no versions when nothing is visible", async () => {
      useTables({ links: [], submissions: foreignRows });

      await expect(listIds()).resolves.toEqual([]);
      expect(mockedPrisma.formVersion.findMany).not.toHaveBeenCalled();
    });
  });
});

describe("FormService SOAP notes for a pet parent", () => {
  const appointmentRow = (patient: unknown) => ({
    organisationId: "org-hospital",
    formIds: [],
    patient,
  });

  // The appointment still names the caller as the companion's parent, the
  // way it did when it was booked.
  const bookedForCaller = appointmentRow({
    id: COMPANION,
    parent: { id: CALLER },
  });

  const soapRow = submission("soap-subjective", {
    formId: SOAP_FORM,
    appointmentId: APPOINTMENT,
    parentId: CALLER,
    patientId: COMPANION,
    submittedBy: STAFF,
  });

  const readSoap = () =>
    FormService.getSOAPNotesByAppointment(APPOINTMENT, {
      requesterParentId: CALLER,
    });

  const expectHiddenSoap = async () => {
    await expect(readSoap()).rejects.toMatchObject({
      statusCode: 404,
      message: "Appointment not found",
    });
    expect(mockedPrisma.formSubmission.findMany).not.toHaveBeenCalled();
  };

  beforeEach(() => {
    mockedPrisma.appointment.findUnique.mockResolvedValue(bookedForCaller);
    mockedPrisma.organization.findUnique.mockResolvedValue({
      type: "HOSPITAL",
    });
    mockedPrisma.form.findMany.mockResolvedValue([
      { id: SOAP_FORM, category: "SOAP-Subjective" },
    ]);
  });

  it.each([
    ["the primary parent", link()],
    [
      "a co-parent with the medical records permission",
      coParent({ medicalRecords: true }),
    ],
  ])("returns the notes to %s", async (_label, companionLink) => {
    useTables({ links: [companionLink], submissions: [soapRow] });

    const result = await readSoap();

    expect(result.soapNotes).toMatchObject({
      Subjective: [
        expect.objectContaining({ submissionId: "soap-subjective" }),
      ],
    });
  });

  it.each([
    ["a REVOKED link", link({ status: "REVOKED" })],
    ["a PENDING link", link({ status: "PENDING" })],
    [
      "a co-parent without the medical records permission",
      coParent({ appointments: true, medicalRecords: false }),
    ],
    ["a co-parent with no permissions recorded", coParent(null)],
    ["another parent's link", link({ parentId: OTHER_PARENT })],
  ])("returns 404 through %s", async (_label, companionLink) => {
    useTables({ links: [companionLink], submissions: [soapRow] });

    await expectHiddenSoap();
  });

  it("returns 404 for an appointment with no companion", async () => {
    useTables({ links: [link()], submissions: [soapRow] });
    mockedPrisma.appointment.findUnique.mockResolvedValue(
      appointmentRow({ parent: { id: CALLER } }),
    );

    await expectHiddenSoap();
    expect(mockedPrisma.parentPatient.findFirst).not.toHaveBeenCalled();
  });
});
