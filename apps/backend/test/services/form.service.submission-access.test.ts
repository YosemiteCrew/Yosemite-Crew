// The pet parent's submission reads (getSubmission, listSubmissions) show the
// caller's own submissions and those for a companion the caller may read
// submissions for: an ACTIVE PRIMARY or CO_PARENT link, and the appointments
// permission for a co-parent. Everything else is hidden.

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
  buildPdfViewModel: jest.fn(),
  renderPdf: jest.fn(),
}));
jest.mock("src/config/prisma", () => ({
  prisma: {
    formSubmission: { findUnique: jest.fn(), findMany: jest.fn() },
    formVersion: { findFirst: jest.fn() },
    parentPatient: { findMany: jest.fn() },
  },
}));
jest.mock("@yosemite-crew/types", () => ({
  toFHIRQuestionnaireResponse: jest.fn((submission) => submission),
}));

import { FormService } from "../../src/services/form.service";
import { prisma } from "src/config/prisma";

const mockedPrisma = prisma as unknown as {
  formSubmission: { findUnique: jest.Mock; findMany: jest.Mock };
  formVersion: { findFirst: jest.Mock };
  parentPatient: { findMany: jest.Mock };
};

const CALLER = "parent-caller";
const OTHER_PARENT = "parent-other";
const COMPANION = "companion-caller";
const OTHER_COMPANION = "companion-other";
const FORM = "form-org-a";
const OTHER_ORG_FORM = "form-org-b";

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

const useTables = (tables: { links: Row[]; submissions: Row[] }) => {
  mockedPrisma.parentPatient.findMany.mockImplementation(async ({ where }) =>
    tables.links.filter((row) => matches(row, where)),
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

// Every row a caller must never see, whatever its links: another parent's
// submission for another companion, on this form and on another
// organisation's form.
const foreignRows = [
  submission("other-parent-same-form"),
  submission("other-parent-other-org", { formId: OTHER_ORG_FORM }),
];

const listIds = async (formId = FORM) =>
  (await FormService.listSubmissions(formId, CALLER)).map((row) => row.id);

const expectHidden = async (id: string) => {
  await expect(FormService.getSubmission(id, CALLER)).rejects.toMatchObject({
    statusCode: 404,
    message: "Submission not found",
  });
  expect(mockedPrisma.formVersion.findFirst).not.toHaveBeenCalled();
};

beforeEach(() => {
  jest.clearAllMocks();
  mockedPrisma.formVersion.findFirst.mockResolvedValue({ schemaSnapshot: [] });
});

describe("FormService submission reads for a pet parent", () => {
  it("shows the caller's own submission", async () => {
    useTables({
      links: [],
      submissions: [
        submission("own", { parentId: CALLER, patientId: COMPANION }),
        ...foreignRows,
      ],
    });

    await expect(FormService.getSubmission("own", CALLER)).resolves.toEqual(
      expect.objectContaining({ _id: "own", answers: { q: "own" } }),
    );
    await expect(listIds()).resolves.toEqual(["own"]);
  });

  it("shows a submission for a companion the caller is the primary parent of", async () => {
    useTables({
      links: [link()],
      submissions: [
        submission("by-co-parent", { patientId: COMPANION }),
        ...foreignRows,
      ],
    });

    await expect(
      FormService.getSubmission("by-co-parent", CALLER),
    ).resolves.toEqual(expect.objectContaining({ _id: "by-co-parent" }));
    await expect(listIds()).resolves.toEqual(["by-co-parent"]);
  });

  it("shows a companion's submission to a co-parent holding the appointments permission", async () => {
    useTables({
      links: [link({ role: "CO_PARENT", permissions: { appointments: true } })],
      submissions: [
        submission("by-primary", { patientId: COMPANION }),
        ...foreignRows,
      ],
    });

    await expect(
      FormService.getSubmission("by-primary", CALLER),
    ).resolves.toEqual(expect.objectContaining({ _id: "by-primary" }));
    await expect(listIds()).resolves.toEqual(["by-primary"]);
  });

  it("returns 404 for another parent's submission for another companion", async () => {
    useTables({ links: [link()], submissions: foreignRows });

    await expectHidden("other-parent-same-form");
    await expect(listIds()).resolves.toEqual([]);
  });

  it("returns 404 for a submission on another organisation's form", async () => {
    useTables({ links: [link()], submissions: foreignRows });

    await expectHidden("other-parent-other-org");
    await expect(listIds(OTHER_ORG_FORM)).resolves.toEqual([]);
  });

  it("keeps the list to the requested form", async () => {
    useTables({
      links: [link()],
      submissions: [
        submission("this-form", { patientId: COMPANION }),
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

    await expectHidden("no-companion");
    await expect(listIds()).resolves.toEqual([]);
  });

  it.each([
    ["a PENDING link", link({ status: "PENDING" })],
    ["a REVOKED link", link({ status: "REVOKED" })],
    [
      "a co-parent without the appointments permission",
      link({ role: "CO_PARENT", permissions: { appointments: false } }),
    ],
    [
      "a co-parent with no permissions recorded",
      link({ role: "CO_PARENT", permissions: null }),
    ],
    ["an ACTIVE link held by another parent", link({ parentId: OTHER_PARENT })],
  ])("returns 404 through %s", async (_label, companionLink) => {
    useTables({
      links: [companionLink],
      submissions: [submission("companion-row", { patientId: COMPANION })],
    });

    await expectHidden("companion-row");
    await expect(listIds()).resolves.toEqual([]);
  });

  it("returns 404 for an id that does not exist", async () => {
    useTables({ links: [link()], submissions: [] });

    await expectHidden("missing");
  });

  it("rejects a blank parent id before reading anything", async () => {
    useTables({ links: [link()], submissions: foreignRows });

    await expect(
      FormService.getSubmission("other-parent-same-form", " "),
    ).rejects.toMatchObject({ statusCode: 400 });
    await expect(FormService.listSubmissions(FORM, "")).rejects.toMatchObject({
      statusCode: 400,
    });
    expect(mockedPrisma.formSubmission.findUnique).not.toHaveBeenCalled();
    expect(mockedPrisma.formSubmission.findMany).not.toHaveBeenCalled();
  });
});
