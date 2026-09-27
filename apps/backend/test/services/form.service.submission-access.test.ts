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
//
// Appointment forms (getFormsForAppointment): each form's latest submission
// the caller may see by the submission rule above. Signing details and the
// signed copy are shown only to the parent a submission names when they filled
// it in or signed it; any other submission shows only its signing state.

jest.mock("../../src/services/documenso.service", () => ({
  DocumensoService: { downloadSignedDocument: jest.fn() },
}));
jest.mock("../../src/utils/logger", () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
jest.mock("../../src/services/audit-trail.service", () => ({
  AuditTrailService: { recordSafely: jest.fn() },
}));
jest.mock("../../src/services/template.service", () => ({
  TemplateService: { getById: jest.fn() },
}));
jest.mock("../../src/services/form-assignment.service", () => ({
  FormAssignmentService: {
    markViewedForAppointment: jest.fn(),
    syncLinkedTemplateAssignmentsForAppointment: jest.fn(),
    listForAppointment: jest.fn(async () => []),
  },
}));
jest.mock("../../src/services/fhir-template.mapper", () => ({
  templateMapper: {
    templateToQuestionnaire: jest.fn((template) => ({ id: template.id })),
    templateInstanceToQuestionnaireResponse: jest.fn((instance) => ({
      ...instance,
    })),
  },
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
    form: { findMany: jest.fn(), findUnique: jest.fn() },
    templateInstance: { findMany: jest.fn() },
    parent: { findMany: jest.fn() },
  },
}));
jest.mock("@yosemite-crew/types", () => ({
  toFHIRQuestionnaireResponse: jest.fn((submission, schema) => ({
    ...submission,
    schema,
  })),
  toFHIRQuestionnaire: jest.fn((form) => ({ id: form._id })),
}));

import { FormService } from "../../src/services/form.service";
import { DocumensoService } from "../../src/services/documenso.service";
import { FormAssignmentService } from "../../src/services/form-assignment.service";
import { TemplateService } from "../../src/services/template.service";
import { prisma } from "src/config/prisma";

const mockedPrisma = prisma as unknown as {
  formSubmission: { findUnique: jest.Mock; findMany: jest.Mock };
  formVersion: { findFirst: jest.Mock; findMany: jest.Mock };
  parentPatient: { findMany: jest.Mock; findFirst: jest.Mock };
  appointment: { findUnique: jest.Mock };
  organization: { findUnique: jest.Mock };
  form: { findMany: jest.Mock; findUnique: jest.Mock };
  templateInstance: { findMany: jest.Mock };
  parent: { findMany: jest.Mock };
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
const INTERNAL_FORM = "internal-form";

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
  { formId: SOAP_FORM, version: 1, schemaSnapshot: [{ id: "q-soap" }] },
  { formId: INTERNAL_FORM, version: 1, schemaSnapshot: [{ id: "q-int" }] },
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
  mockedPrisma.form.findUnique.mockResolvedValue({
    visibilityType: "External",
  });
});

describe("FormService submission reads for a pet parent", () => {
  it("shows the caller's own submission", async () => {
    useTables({ links: [link()], submissions: [ownRow(), ...foreignRows] });

    await expect(visibleThrough("own")).resolves.toEqual(SHOWN);
    await expect(listIds()).resolves.toEqual(["own"]);
    await expect(
      FormService.getSubmission("own", CALLER),
    ).resolves.toMatchObject({ parentId: CALLER, submittedBy: CALLER });
  });

  it.each([
    ["a REVOKED link", link({ status: "REVOKED" })],
    ["a PENDING link", link({ status: "PENDING" })],
    ["no link at all", link({ parentId: OTHER_PARENT })],
  ])(
    "returns 404 for the caller's own submission through %s",
    async (_label, companionLink) => {
      useTables({ links: [companionLink], submissions: [ownRow()] });

      await expect(visibleThrough("own")).resolves.toEqual(HIDDEN);
    },
  );

  it("returns 404 for the caller's own submission on an internal form", async () => {
    useTables({ links: [link()], submissions: [ownRow()] });
    mockedPrisma.form.findUnique.mockResolvedValue({
      visibilityType: "Internal",
    });

    await expect(visibleThrough("own")).resolves.toEqual(HIDDEN);
    expect(mockedPrisma.form.findUnique).toHaveBeenCalledWith({
      where: { id: FORM },
      select: { visibilityType: true },
    });
  });

  it.each([
    ["the appointments permission", { appointments: true }, SHOWN],
    ["no appointments permission", { medicalRecords: true }, HIDDEN],
  ])(
    "reads a co-parent's own submission with %s",
    async (_label, permissions, expected) => {
      useTables({ links: [coParent(permissions)], submissions: [ownRow()] });

      await expect(visibleThrough("own")).resolves.toEqual(expected);
    },
  );

  it("returns 404 for a practice-written row naming the caller once the link is revoked", async () => {
    useTables({
      links: [link({ status: "REVOKED" })],
      submissions: [practiceRowForCaller(), ownRow()],
    });

    await expect(visibleThrough("practice-for-caller")).resolves.toEqual(
      HIDDEN,
    );
    await expect(listIds()).resolves.toEqual([]);
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

  it("shows a practice-written row to the primary parent of its companion, without the practice user", async () => {
    useTables({ links: [link()], submissions: [practiceRowForCaller()] });

    await expect(visibleThrough("practice-for-caller")).resolves.toEqual(SHOWN);
    await expect(
      FormService.getSubmission("practice-for-caller", CALLER),
    ).resolves.toMatchObject({ parentId: CALLER, submittedBy: undefined });
    await expect(listIds()).resolves.toEqual(["practice-for-caller"]);
    const [listed] = (await FormService.listSubmissions(
      FORM,
      CALLER,
    )) as unknown as Row[];
    expect(listed.submittedBy).toBeUndefined();
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
        expect.objectContaining({
          submissionId: "soap-subjective",
          submittedBy: undefined,
        }),
      ],
    });
  });

  it("keeps the submitter on a note the caller submitted", async () => {
    useTables({
      links: [link()],
      submissions: [{ ...soapRow, submittedBy: CALLER }],
    });

    const result = await readSoap();

    expect(result.soapNotes).toMatchObject({
      Subjective: [expect.objectContaining({ submittedBy: CALLER })],
    });
  });

  it("keeps the submitter on the practice view", async () => {
    useTables({ links: [], submissions: [soapRow] });

    const result = await FormService.getSOAPNotesByAppointment(APPOINTMENT, {
      requesterOrgId: "org-hospital",
    });

    expect(result.soapNotes).toMatchObject({
      Subjective: [expect.objectContaining({ submittedBy: STAFF })],
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

describe("FormService appointment forms for a pet parent", () => {
  const ORG = "org-hospital";

  const formRow = (id: string, category: string): Row => ({
    id,
    orgId: ORG,
    businessType: null,
    name: id,
    category,
    description: null,
    visibilityType: null,
    serviceId: [],
    speciesFilter: null,
    requiredSigner: null,
    status: "published",
    schema: [],
    createdBy: STAFF,
    updatedBy: STAFF,
    createdAt: new Date("2026-08-01T00:00:00.000Z"),
    updatedAt: new Date("2026-08-01T00:00:00.000Z"),
  });

  const FORM_ROWS = [
    formRow(FORM, "Consent"),
    formRow(SOAP_FORM, "SOAP-Subjective"),
    { ...formRow(INTERNAL_FORM, "Custom"), visibilityType: "Internal" },
  ];

  const signed = (
    documentId: string,
    email: string,
    role: "CLIENT" | "VET" = "CLIENT",
  ) => ({
    required: true,
    status: "SIGNED",
    provider: "DOCUMENSO",
    documentId,
    signer: { email, role },
  });

  // All a parent sees of the signing on a submission they neither filled in
  // nor signed.
  const SIGNING_STATE = {
    required: true,
    status: "SIGNED",
    provider: "DOCUMENSO",
  };

  const onAppointment = (id: string, overrides: Row): Row =>
    submission(id, {
      appointmentId: APPOINTMENT,
      patientId: COMPANION,
      ...overrides,
    });

  // The caller's own signed consent for this appointment.
  const ownConsent = onAppointment("own-consent", {
    parentId: CALLER,
    submittedBy: CALLER,
    signing: signed("77", "caller@example.com"),
  });

  // A note the practice wrote and signed on this appointment.
  const practiceNote = onAppointment("practice-note", {
    formId: SOAP_FORM,
    parentId: CALLER,
    submittedBy: STAFF,
    signing: signed("88", "vet@example.com", "VET"),
  });

  // A consent the practice filled in and sent to the caller, who signed it.
  const consentSentToCaller = onAppointment("consent-sent-to-caller", {
    parentId: CALLER,
    submittedBy: STAFF,
    signing: signed("66", "caller@example.com"),
  });

  const readForms = async (
    params: { viewerParentId?: string; requesterOrgId?: string } = {
      viewerParentId: CALLER,
    },
  ) => {
    const result = (await FormService.getFormsForAppointment({
      appointmentId: APPOINTMENT,
      ...params,
    })) as unknown as { items: Row[] };
    return new Map(
      result.items.map((item) => [
        (item.questionnaire as Row).id as string,
        item,
      ]),
    );
  };

  const responseOf = (forms: Map<string, Row>, formId: string) =>
    forms.get(formId)?.questionnaireResponse as Row | undefined;

  beforeEach(() => {
    mockedPrisma.appointment.findUnique.mockResolvedValue({
      organisationId: ORG,
      formIds: [FORM, INTERNAL_FORM],
      patient: { id: COMPANION },
    });
    mockedPrisma.organization.findUnique.mockResolvedValue({
      type: "HOSPITAL",
      documensoApiKey: "documenso-key",
    });
    mockedPrisma.form.findMany.mockImplementation(async ({ where }) =>
      FORM_ROWS.filter((row) => matches(row, where)),
    );
    (DocumensoService.downloadSignedDocument as jest.Mock).mockImplementation(
      async ({ documentId }) => ({
        downloadUrl: `https://signed.example/${documentId}`,
      }),
    );
  });

  it("shows the primary parent the practice's note with only its signing state and no submitter", async () => {
    useTables({ links: [link()], submissions: [practiceNote, ownConsent] });

    const note = responseOf(await readForms(), SOAP_FORM);

    expect(note).toMatchObject({
      _id: "practice-note",
      answers: { q: "practice-note" },
      parentId: CALLER,
      submittedBy: undefined,
    });
    expect(note?.signing).toEqual(SIGNING_STATE);
    expect(DocumensoService.downloadSignedDocument).not.toHaveBeenCalledWith(
      expect.objectContaining({ documentId: 88 }),
    );
  });

  it("keeps the signing state and signed copy of a practice form the caller signed, without the practice user", async () => {
    useTables({ links: [link()], submissions: [consentSentToCaller] });

    const consent = responseOf(await readForms(), FORM);

    expect(consent).toMatchObject({
      _id: "consent-sent-to-caller",
      parentId: CALLER,
      submittedBy: undefined,
      signing: {
        status: "SIGNED",
        signer: { email: "caller@example.com", role: "CLIENT" },
        pdf: { url: "https://signed.example/66" },
      },
    });
  });

  it("lists a practice form the caller signed only as answered once they may not read it", async () => {
    useTables({
      links: [coParent({ appointments: true })],
      submissions: [consentSentToCaller],
    });

    const consent = responseOf(await readForms(), FORM);

    expect(consent).toMatchObject({ _id: "consent-sent-to-caller" });
    expect(consent?.answers).toEqual({});
    expect(consent?.signing).toEqual(SIGNING_STATE);
    expect(DocumensoService.downloadSignedDocument).not.toHaveBeenCalled();
  });

  it("keeps the signing state and signed copy of the caller's own form", async () => {
    useTables({ links: [link()], submissions: [practiceNote, ownConsent] });

    const consent = responseOf(await readForms(), FORM);

    expect(consent).toMatchObject({
      _id: "own-consent",
      submittedBy: CALLER,
      signing: {
        status: "SIGNED",
        pdf: { url: "https://signed.example/77" },
      },
    });
  });

  it.each([
    [
      "medical records switched off",
      coParent({ appointments: true, medicalRecords: false }),
    ],
    [
      "no medical records permission recorded",
      coParent({ appointments: true }),
    ],
  ])(
    "leaves the practice's note out for a co-parent with %s",
    async (_label, companionLink) => {
      useTables({
        links: [companionLink],
        submissions: [practiceNote, ownConsent],
      });

      const forms = await readForms();

      expect(forms.has(SOAP_FORM)).toBe(false);
      expect(responseOf(forms, FORM)).toMatchObject({ _id: "own-consent" });
    },
  );

  it("leaves out practice-only forms with nothing on them, and lists the rest as pending", async () => {
    useTables({ links: [link()], submissions: [] });

    const forms = await readForms();

    expect([...forms.keys()]).toEqual([FORM]);
    expect(forms.get(FORM)).toMatchObject({ status: "pending" });
  });

  it("never lists an internal form to a parent, even with an answer they may read", async () => {
    useTables({
      links: [link()],
      submissions: [
        onAppointment("internal-row", {
          formId: INTERNAL_FORM,
          parentId: CALLER,
          submittedBy: CALLER,
        }),
      ],
    });

    const forms = await readForms();

    expect(forms.has(INTERNAL_FORM)).toBe(false);
    expect(forms.has(FORM)).toBe(true);
  });

  it("lists every form to the practice, practice-only ones included", async () => {
    useTables({ links: [], submissions: [] });

    const forms = await readForms({ requesterOrgId: ORG });

    expect([...forms.keys()].sort()).toEqual(
      [FORM, INTERNAL_FORM, SOAP_FORM].sort(),
    );
  });

  it("lists a practice row a co-parent may not read as answered, without its answers", async () => {
    useTables({
      links: [coParent({ appointments: true })],
      submissions: [
        onAppointment("practice-consent", {
          parentId: CALLER,
          submittedBy: STAFF,
          signing: signed("55", "vet@example.com", "VET"),
        }),
      ],
    });

    const forms = await readForms();
    const consent = responseOf(forms, FORM);

    expect(forms.get(FORM)).toMatchObject({ status: "completed" });
    expect(consent).toMatchObject({
      _id: "practice-consent",
      parentId: undefined,
      submittedBy: undefined,
    });
    expect(consent?.answers).toEqual({});
    expect(consent?.signing).toEqual(SIGNING_STATE);
    expect(DocumensoService.downloadSignedDocument).not.toHaveBeenCalled();
  });

  it("shows the practice's note to a co-parent with the medical records permission", async () => {
    useTables({
      links: [coParent({ appointments: true, medicalRecords: true })],
      submissions: [practiceNote],
    });

    const note = responseOf(await readForms(), SOAP_FORM);

    expect(note).toMatchObject({
      _id: "practice-note",
      submittedBy: undefined,
    });
    expect(note?.signing).toEqual(SIGNING_STATE);
  });

  it("shows another parent's signed form with only its signing state", async () => {
    useTables({
      links: [coParent({ appointments: true })],
      submissions: [
        onAppointment("other-parents-consent", {
          signing: signed("99", "other@example.com"),
        }),
      ],
    });

    const consent = responseOf(await readForms(), FORM);

    expect(consent).toMatchObject({
      _id: "other-parents-consent",
      submittedBy: OTHER_PARENT,
    });
    expect(consent?.signing).toEqual(SIGNING_STATE);
    expect(DocumensoService.downloadSignedDocument).not.toHaveBeenCalled();
  });

  it("shows a form with no signing recorded without a signing state", async () => {
    useTables({
      links: [link()],
      submissions: [
        onAppointment("practice-row-unsigned", {
          parentId: CALLER,
          submittedBy: STAFF,
        }),
      ],
    });

    const row = responseOf(await readForms(), FORM);

    expect(row).toMatchObject({ _id: "practice-row-unsigned" });
    expect(row).not.toHaveProperty("signing");
  });

  it("shows the latest submission the caller may see when a newer one is hidden", async () => {
    useTables({
      links: [coParent({ appointments: true })],
      submissions: [
        onAppointment("newer-practice-row", {
          parentId: CALLER,
          submittedBy: STAFF,
          submittedAt: new Date("2026-09-02T00:00:00.000Z"),
        }),
        ownConsent,
      ],
    });

    const consent = responseOf(await readForms(), FORM);

    expect(consent).toMatchObject({ _id: "own-consent" });
  });

  it("keeps signing details and the submitter on the practice view", async () => {
    useTables({ links: [], submissions: [practiceNote] });

    const note = responseOf(
      await readForms({ requesterOrgId: ORG }),
      SOAP_FORM,
    );

    expect(note).toMatchObject({
      _id: "practice-note",
      submittedBy: STAFF,
      signing: { status: "SIGNED", pdf: { url: "https://signed.example/88" } },
    });
    expect(mockedPrisma.parentPatient.findMany).not.toHaveBeenCalled();
  });
});

describe("FormService template-backed appointment forms for a pet parent", () => {
  const ORG = "org-clinic";

  const assignment = (templateId: string, overrides: Row = {}): Row => ({
    id: `assignment-${templateId}`,
    templateId,
    templateVersion: 1,
    mobileVisible: true,
    signerUserId: CALLER,
    signerName: "Caller Parent",
    signerEmail: "caller@example.com",
    signerRole: "CLIENT",
    signerIdentity: { userId: CALLER, email: "caller@example.com" },
    encounterId: "encounter-1",
    createdBy: STAFF,
    updatedBy: STAFF,
    status: "sent",
    ...overrides,
  });

  const instance = (templateId: string, overrides: Row = {}): Row => ({
    id: `instance-${templateId}`,
    templateId,
    templateVersion: 1,
    organisationId: ORG,
    appointmentId: APPOINTMENT,
    caseId: "case-1",
    encounterId: "encounter-1",
    status: "COMPLETED",
    data: { q: templateId },
    signedBy: null,
    signedAt: null,
    generatedPdfUrl: `https://pdf.example/${templateId}`,
    generatedPdf: { key: templateId },
    ...overrides,
  });

  // A form another parent (the primary) filled in, and one the practice did.
  const INSTANCES = [
    instance("tpl-parent", { authorId: OTHER_PARENT }),
    instance("tpl-practice", { authorId: STAFF }),
  ];

  const useTemplates = (tables: {
    links: Row[];
    instances?: Row[];
    assignments?: Row[];
  }) => {
    useTables({ links: tables.links, submissions: [] });
    (FormAssignmentService.listForAppointment as jest.Mock).mockResolvedValue(
      tables.assignments ?? [
        assignment("tpl-parent"),
        assignment("tpl-practice"),
        assignment("tpl-not-sent", { mobileVisible: false }),
      ],
    );
    mockedPrisma.templateInstance.findMany.mockResolvedValue(
      tables.instances ?? INSTANCES,
    );
  };

  const readTemplateForms = async (
    params: { viewerParentId?: string; requesterOrgId?: string } = {
      viewerParentId: CALLER,
    },
  ) => {
    const result = (await FormService.getFormsForAppointment({
      appointmentId: APPOINTMENT,
      ...params,
    })) as unknown as { items: Row[] };
    return new Map(
      result.items.map((item) => [item.templateId as string, item]),
    );
  };

  const responseOf = (items: Map<string, Row>, templateId: string) =>
    items.get(templateId)?.questionnaireResponse as Row | undefined;

  beforeEach(() => {
    mockedPrisma.appointment.findUnique.mockResolvedValue({
      organisationId: ORG,
      formIds: [],
      patient: { id: COMPANION },
    });
    (TemplateService.getById as jest.Mock).mockImplementation(
      async (templateId: string) => ({ id: templateId }),
    );
    mockedPrisma.parent.findMany.mockImplementation(async ({ where }) =>
      [{ id: CALLER }, { id: OTHER_PARENT }].filter((row) =>
        matches(row, where),
      ),
    );
  });

  afterEach(() => {
    (FormAssignmentService.listForAppointment as jest.Mock).mockResolvedValue(
      [],
    );
  });

  it("lists only what was sent to the app, without who created or signs it", async () => {
    useTemplates({ links: [link()] });

    const items = await readTemplateForms();

    expect([...items.keys()]).toEqual(["tpl-parent", "tpl-practice"]);
    for (const item of items.values()) {
      for (const field of [
        "signerUserId",
        "signerName",
        "signerEmail",
        "signerRole",
        "signerIdentity",
        "encounterId",
        "createdBy",
        "updatedBy",
      ]) {
        expect(item[field]).toBeUndefined();
      }
    }
  });

  it("lists nothing to a parent when nothing was sent to the app", async () => {
    useTemplates({
      links: [link()],
      assignments: [assignment("tpl-not-sent", { mobileVisible: false })],
    });

    await expect(readTemplateForms()).resolves.toEqual(new Map());
  });

  it("shows the primary parent every answer, without the submitter or the generated PDF", async () => {
    useTemplates({ links: [link()] });

    const items = await readTemplateForms();

    for (const templateId of ["tpl-parent", "tpl-practice"]) {
      expect(responseOf(items, templateId)).toMatchObject({
        data: { q: templateId },
        authorId: null,
        generatedPdfUrl: null,
        generatedPdf: null,
      });
    }
  });

  it("shows a co-parent without medical records the parent's answers and only that the practice's form is answered", async () => {
    useTemplates({ links: [coParent({ appointments: true })] });

    const items = await readTemplateForms();

    expect(responseOf(items, "tpl-parent")).toMatchObject({
      data: { q: "tpl-parent" },
      authorId: null,
      generatedPdfUrl: null,
    });
    expect(items.get("tpl-practice")).toMatchObject({ status: "completed" });
    expect(responseOf(items, "tpl-practice")?.data).toEqual({});
    expect(responseOf(items, "tpl-practice")).toMatchObject({
      id: "instance-tpl-practice",
      status: "COMPLETED",
      authorId: null,
      caseId: null,
      encounterId: null,
      generatedPdfUrl: null,
      generatedPdf: null,
    });
  });

  it("treats a form with no author recorded as the practice's", async () => {
    useTemplates({
      links: [coParent({ appointments: true })],
      instances: [instance("tpl-practice", { authorId: null })],
    });

    const items = await readTemplateForms();

    expect(responseOf(items, "tpl-practice")?.data).toEqual({});
    expect(mockedPrisma.parent.findMany).not.toHaveBeenCalled();
  });

  it("shows a co-parent with medical records the practice's answers", async () => {
    useTemplates({
      links: [coParent({ appointments: true, medicalRecords: true })],
    });

    const items = await readTemplateForms();

    expect(responseOf(items, "tpl-practice")).toMatchObject({
      data: { q: "tpl-practice" },
      authorId: null,
      generatedPdfUrl: null,
    });
  });

  it.each([
    ["filled in", { authorId: CALLER }, coParent({ appointments: true })],
    ["signed", { authorId: STAFF, signedBy: CALLER }, link()],
  ])(
    "keeps the submitter and the generated PDF on a form the caller %s",
    async (_label, overrides, companionLink) => {
      const own = instance("tpl-practice", overrides);
      useTemplates({ links: [companionLink], instances: [own] });

      const items = await readTemplateForms();

      expect(responseOf(items, "tpl-practice")).toEqual(own);
    },
  );

  it("shows a signer who may not read the practice's form only that it is answered", async () => {
    useTemplates({
      links: [coParent({ appointments: true })],
      instances: [
        instance("tpl-practice", { authorId: STAFF, signedBy: CALLER }),
      ],
    });

    const items = await readTemplateForms();

    expect(responseOf(items, "tpl-practice")?.data).toEqual({});
    expect(responseOf(items, "tpl-practice")).toMatchObject({
      generatedPdfUrl: null,
    });
  });

  it("leaves the practice view unchanged", async () => {
    useTemplates({ links: [] });

    const items = await readTemplateForms({ requesterOrgId: ORG });

    expect([...items.keys()]).toEqual([
      "tpl-parent",
      "tpl-practice",
      "tpl-not-sent",
    ]);
    expect(items.get("tpl-parent")).toMatchObject({
      signerEmail: "caller@example.com",
      signerRole: "CLIENT",
      encounterId: "encounter-1",
      createdBy: STAFF,
    });
    expect(responseOf(items, "tpl-practice")).toEqual(INSTANCES[1]);
    expect(mockedPrisma.parent.findMany).not.toHaveBeenCalled();
  });
});
