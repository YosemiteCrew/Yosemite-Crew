// Writes to a concrete form (a submission, publish, unpublish, archive,
// update) stay inside the caller's scope: practice staff act on their own
// organisation's forms, appointments and companions; a parent submits for a
// companion they may act for (an ACTIVE PRIMARY or CO_PARENT link, and the
// appointments permission for a co-parent).

jest.mock("../../src/services/documenso.service", () => ({
  DocumensoService: {},
}));
jest.mock("../../src/services/audit-trail.service", () => ({
  AuditTrailService: { recordSafely: jest.fn() },
}));
jest.mock("../../src/services/template.service", () => ({
  TemplateService: { getById: jest.fn() },
}));
jest.mock("../../src/services/form-assignment.service", () => ({
  FormAssignmentService: { markSubmittedFromSubmission: jest.fn() },
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
    form: { findUnique: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
    formVersion: { findFirst: jest.fn(), create: jest.fn() },
    formField: { deleteMany: jest.fn(), createMany: jest.fn() },
    formSubmission: { create: jest.fn() },
    appointment: { findFirst: jest.fn(), updateMany: jest.fn() },
    parentPatient: { findFirst: jest.fn() },
    patientOrganisation: { findFirst: jest.fn() },
    user: { findMany: jest.fn() },
  },
}));
jest.mock("@yosemite-crew/types", () => ({
  fromFormRequestDTO: jest.fn((form) => form),
  fromFormSubmissionRequestDTO: jest.fn((submission) => submission),
}));

import { FormService } from "../../src/services/form.service";
import { prisma } from "src/config/prisma";

type Row = Record<string, unknown>;
type Mocked = Record<string, Record<string, jest.Mock>>;
const db = prisma as unknown as Mocked;

const ORG = "org-a";
const OTHER_ORG = "org-b";
const FORM = "form-a";
const OTHER_ORG_FORM = "form-b";
const PARENT = "parent-caller";
const COMPANION = "companion-caller";
const OTHER_COMPANION = "companion-other";
const APPOINTMENT = "appt-caller";

// Applies a Prisma `where` the way Prisma does - an omitted field matches
// everything - so a loosened filter lets the wrong row through instead of
// passing unnoticed.
const matches = (row: Row, where: Row): boolean =>
  Object.entries(where).every(([key, filter]) => {
    if (filter === undefined) return true;
    if (filter && typeof filter === "object" && "in" in filter) {
      return (filter as { in: unknown[] }).in.includes(row[key]);
    }
    return row[key] === filter;
  });

const tables = {
  forms: [] as Row[],
  appointments: [] as Row[],
  links: [] as Row[],
  memberships: [] as Row[],
};

const findIn = (rows: () => Row[]) =>
  jest.fn(
    async ({ where }: { where: Row }) =>
      rows().find((row) => matches(row, where)) ?? null,
  );

const link = (overrides: Row = {}): Row => ({
  parentId: PARENT,
  patientId: COMPANION,
  role: "PRIMARY",
  status: "ACTIVE",
  permissions: {},
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  tables.forms = [
    { id: FORM, orgId: ORG, name: "Intake", schema: [] },
    { id: OTHER_ORG_FORM, orgId: OTHER_ORG, name: "Intake", schema: [] },
  ];
  tables.appointments = [
    { id: APPOINTMENT, organisationId: ORG, patient: { id: COMPANION } },
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
  tables.links = [link()];
  tables.memberships = [
    { patientId: COMPANION, organisationId: ORG, status: "ACTIVE" },
    { patientId: "companion-pending", organisationId: ORG, status: "PENDING" },
  ];

  db.form.findUnique.mockImplementation(findIn(() => tables.forms));
  db.form.findFirst.mockImplementation(findIn(() => tables.forms));
  db.appointment.findFirst.mockImplementation(
    findIn(() => tables.appointments),
  );
  db.parentPatient.findFirst.mockImplementation(findIn(() => tables.links));
  db.patientOrganisation.findFirst.mockImplementation(
    findIn(() => tables.memberships),
  );
  db.formSubmission.create.mockResolvedValue({ id: "submission-1" });
  db.form.update.mockImplementation(async ({ data }: { data: Row }) => ({
    ...tables.forms[0],
    ...data,
  }));
  db.formVersion.findFirst.mockResolvedValue(null);
  db.user.findMany.mockResolvedValue([]);
});

const submit = (
  fields: Row,
  actor: { parentId: string } | { organisationId: string },
) =>
  FormService.submitFHIR(
    {
      formId: FORM,
      formVersion: 1,
      answers: {},
      submittedAt: new Date("2026-09-01T00:00:00.000Z"),
      ...fields,
    } as never,
    [],
    undefined,
    actor,
  );

const asParent = { parentId: PARENT };
const asPractice = { organisationId: ORG };

const expectRefused = async (
  pending: Promise<unknown>,
  statusCode = 403,
  message = "Forbidden",
) => {
  await expect(pending).rejects.toMatchObject({ statusCode, message });
  expect(db.formSubmission.create).not.toHaveBeenCalled();
  expect(db.appointment.updateMany).not.toHaveBeenCalled();
};

describe("FormService.submitFHIR from the mobile app (concrete form)", () => {
  it("records a submission for the caller's companion and appointment", async () => {
    await submit(
      { appointmentId: APPOINTMENT, patientId: COMPANION, parentId: PARENT },
      asParent,
    );

    expect(db.formSubmission.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          appointmentId: APPOINTMENT,
          patientId: COMPANION,
        }),
      }),
    );
  });

  it("records a submission that names no appointment or companion", async () => {
    await submit({ parentId: PARENT }, asParent);

    expect(db.formSubmission.create).toHaveBeenCalled();
  });

  it("returns 403 for another family's appointment", async () => {
    await expectRefused(
      submit({ appointmentId: "appt-other-family" }, asParent),
    );
  });

  it("returns 403 for an appointment at another organisation", async () => {
    await expectRefused(submit({ appointmentId: "appt-other-org" }, asParent));
  });

  it("returns 403 for an appointment that does not exist", async () => {
    await expectRefused(submit({ appointmentId: "appt-missing" }, asParent));
  });

  it("returns 403 for another parent's companion", async () => {
    await expectRefused(submit({ patientId: OTHER_COMPANION }, asParent));
  });

  it.each(["PENDING", "REVOKED"])(
    "returns 403 once the caller's link is %s",
    async (status) => {
      tables.links = [link({ status })];

      await expectRefused(submit({ patientId: COMPANION }, asParent));
      await expectRefused(submit({ appointmentId: APPOINTMENT }, asParent));
    },
  );

  it("returns 403 for a co-parent without the appointments permission", async () => {
    tables.links = [
      link({ role: "CO_PARENT", permissions: { appointments: false } }),
    ];

    await expectRefused(submit({ patientId: COMPANION }, asParent));
    await expectRefused(submit({ appointmentId: APPOINTMENT }, asParent));
  });

  it("records a submission for a co-parent with the appointments permission", async () => {
    tables.links = [
      link({ role: "CO_PARENT", permissions: { appointments: true } }),
    ];

    await submit(
      { appointmentId: APPOINTMENT, patientId: COMPANION },
      asParent,
    );

    expect(db.formSubmission.create).toHaveBeenCalled();
  });

  it("returns 403 for ids that are not plain strings", async () => {
    await expectRefused(submit({ appointmentId: { not: "" } }, asParent));
    await expectRefused(submit({ patientId: { not: "" } }, asParent));
    expect(db.appointment.findFirst).not.toHaveBeenCalled();
    expect(db.parentPatient.findFirst).not.toHaveBeenCalled();
  });
});

describe("FormService.submitFHIR from the PMS (concrete form)", () => {
  it("records a submission for the practice's own form, appointment and companion", async () => {
    await submit(
      { appointmentId: APPOINTMENT, patientId: COMPANION },
      asPractice,
    );

    expect(db.formSubmission.create).toHaveBeenCalled();
    expect(db.appointment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: APPOINTMENT, organisationId: ORG },
      }),
    );
  });

  it("returns 404 for another organisation's form", async () => {
    await expectRefused(
      submit({ formId: OTHER_ORG_FORM }, asPractice),
      404,
      "Form not found",
    );
  });

  it("returns 403 for another organisation's appointment", async () => {
    await expectRefused(
      submit({ appointmentId: "appt-other-org" }, asPractice),
    );
  });

  it("returns 403 for a companion that is not the organisation's", async () => {
    await expectRefused(submit({ patientId: OTHER_COMPANION }, asPractice));
    await expectRefused(submit({ patientId: "companion-pending" }, asPractice));
  });
});

describe("form changes from the PMS", () => {
  const changes = {
    publish: () => FormService.publish(OTHER_ORG_FORM, "user-1", ORG),
    unpublish: () => FormService.unpublish(OTHER_ORG_FORM, "user-1", ORG),
    archive: () => FormService.archive(OTHER_ORG_FORM, "user-1", ORG),
    update: () =>
      FormService.update(
        OTHER_ORG_FORM,
        { name: "Renamed", schema: [] } as never,
        "user-1",
        ORG,
      ),
  };

  it.each(Object.entries(changes))(
    "%s returns 404 for another organisation's form",
    async (_name, change) => {
      await expect(change()).rejects.toMatchObject({
        statusCode: 404,
        message: "Form not found",
      });
      expect(db.form.update).not.toHaveBeenCalled();
      expect(db.formVersion.create).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["publish", () => FormService.publish(FORM, "user-1", undefined)],
    ["unpublish", () => FormService.unpublish(FORM, "user-1", undefined)],
    ["archive", () => FormService.archive(FORM, "user-1", undefined)],
  ])("%s returns 400 without an organisation", async (_name, change) => {
    await expect(change()).rejects.toMatchObject({ statusCode: 400 });
    expect(db.form.findFirst).not.toHaveBeenCalled();
    expect(db.form.update).not.toHaveBeenCalled();
  });

  it.each([
    ["publish", "published"],
    ["unpublish", "draft"],
    ["archive", "archived"],
  ] as const)("%s changes the practice's own form", async (name, status) => {
    await FormService[name](FORM, "user-1", ORG);

    expect(db.form.update).toHaveBeenCalledWith({
      where: { id: FORM },
      data: { status, updatedBy: "user-1" },
    });
  });
});
