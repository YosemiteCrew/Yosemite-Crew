import { AdverseEventService } from "src/services/adverse-event.service";

jest.mock("src/config/prisma", () => ({
  prisma: {
    adverseEventReport: {
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    patientOrganisation: {
      findFirst: jest.fn(),
    },
    appointment: {
      findFirst: jest.fn(),
    },
    organization: {
      findUnique: jest.fn(),
    },
    regulatoryAuthority: {
      findFirst: jest.fn(),
    },
  },
}));

jest.mock("src/utils/email", () => ({
  sendEmailTemplate: jest.fn(),
}));

jest.mock("src/utils/logger", () => ({
  __esModule: true,
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

const { prisma } = jest.requireMock("src/config/prisma");
const { sendEmailTemplate } = jest.requireMock("src/utils/email");
const logger = jest.requireMock("src/utils/logger").default;

const VALID_INPUT = {
  organisationId: "org-1",
  reporter: {
    firstName: "Ada",
    lastName: "Lovelace",
    email: "ada@example.com",
    phoneNumber: "+44 20 7946 0000",
  },
  patient: { name: "Poppy", companionId: "pat-1" },
  product: {
    productName: "Vaccine X",
    brandName: "BrandCo",
    batchNumber: "LOT-42",
    quantityUsed: "2",
    quantityUnit: "ml",
    administrationMethod: "Subcutaneous",
    petConditionBefore: "Bright",
    petConditionAfter: "Lethargic",
    manufacturingCountry: { name: "United Kingdom" },
  },
  destinations: { sendToManufacturer: true, sendToHospital: false },
  consent: { agreedToContact: true },
} as never;

const storedRow = {
  id: "report-1",
  organisationId: "org-1",
  appointmentId: null,
  reporter: {},
  patient: {},
  product: {},
  destinations: {},
  consent: {},
  status: "SUBMITTED",
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
};

type Row = Record<string, unknown>;

/**
 * Every named field, the way Prisma reads a flat `where`: a value matches by
 * equality and a `{ not }` object as a filter.
 */
const matching = (rows: Row[]) =>
  jest.fn(async ({ where }: { where: Row }) => {
    const found = rows.find((row) =>
      Object.entries(where).every(([key, value]) =>
        value && typeof value === "object" && "not" in value
          ? row[key] !== (value as { not: unknown }).not
          : row[key] === value,
      ),
    );
    return found ?? null;
  });

const PRACTICE_LINKS: Row[] = [
  {
    id: "link-1",
    patientId: "pat-1",
    organisationId: "org-1",
    status: "ACTIVE",
  },
  {
    id: "link-2",
    patientId: "pat-1",
    organisationId: "org-2",
    status: "REVOKED",
  },
  {
    id: "link-3",
    patientId: "pat-9",
    organisationId: "org-3",
    status: "ACTIVE",
  },
];

const APPOINTMENTS: Row[] = [
  { id: "appt-1", organisationId: "org-1", patient: { id: "pat-1" } },
  { id: "appt-9", organisationId: "org-1", patient: { id: "pat-9" } },
];

const REPORTS: Row[] = [
  { ...storedRow, id: "report-1", organisationId: "org-1" },
  { ...storedRow, id: "report-2", organisationId: "org-2" },
];

describe("AdverseEventService.createFromMobile", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.adverseEventReport.create.mockResolvedValue(storedRow);
    prisma.patientOrganisation.findFirst.mockImplementation(
      matching(PRACTICE_LINKS),
    );
    prisma.appointment.findFirst.mockImplementation(matching(APPOINTMENTS));
    prisma.organization.findUnique.mockResolvedValue({
      name: "Bramble Vets",
      email: "clinic@example.com",
      country: "United Kingdom",
    });
    prisma.regulatoryAuthority.findFirst.mockResolvedValue({
      authorityName: "Veterinary Medicines Directorate (VMD)",
      website: "https://www.gov.uk/report-veterinary-medicine-problem",
    });
  });

  it("emails the linked practice with the product and batch detail", async () => {
    await AdverseEventService.createFromMobile(VALID_INPUT, "par-1");

    expect(sendEmailTemplate).toHaveBeenCalledTimes(1);
    const call = sendEmailTemplate.mock.calls[0][0];
    expect(call.to).toBe("clinic@example.com");
    expect(call.templateId).toBe("adverseEventReported");
    expect(call.templateData).toMatchObject({
      organisationName: "Bramble Vets",
      reporterName: "Ada Lovelace",
      companionName: "Poppy",
      productName: "Vaccine X",
      brandName: "BrandCo",
      batchNumber: "LOT-42",
      quantityUsed: "2 ml",
      authorityName: "Veterinary Medicines Directorate (VMD)",
    });
  });

  /*
   * The whole point of the notification: apps/frontend has no adverse-event
   * screen, so if this mail is not sent the practice never learns the report
   * exists. A report with no organisation has nowhere to go, and must not
   * cause a spurious send.
   */
  it("sends nothing when the report is not linked to an organisation", async () => {
    await AdverseEventService.createFromMobile(
      {
        ...(VALID_INPUT as object),
        organisationId: undefined,
      } as never,
      "par-1",
    );

    expect(sendEmailTemplate).not.toHaveBeenCalled();
    expect(prisma.organization.findUnique).not.toHaveBeenCalled();
  });

  it("records that the practice has no email rather than failing", async () => {
    prisma.organization.findUnique.mockResolvedValue({
      name: "Bramble Vets",
      email: null,
      country: "United Kingdom",
    });

    await expect(
      AdverseEventService.createFromMobile(VALID_INPUT, "par-1"),
    ).resolves.toBeDefined();
    expect(sendEmailTemplate).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalled();
  });

  /*
   * A report that was accepted and stored must not be reported back to the
   * owner as failed because SES was unavailable - the same swallow-and-log
   * posture as appointment.service.ts and public-booking.service.ts.
   */
  it("still returns the stored report when the send fails", async () => {
    sendEmailTemplate.mockRejectedValue(new Error("SES unavailable"));

    const result = await AdverseEventService.createFromMobile(
      VALID_INPUT,
      "par-1",
    );

    expect(result).toBeDefined();
    expect(prisma.adverseEventReport.create).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalled();
  });

  it("omits the authority when the country has no entry", async () => {
    prisma.regulatoryAuthority.findFirst.mockResolvedValue(null);

    await AdverseEventService.createFromMobile(VALID_INPUT, "par-1");

    const call = sendEmailTemplate.mock.calls[0][0];
    expect(call.templateData.authorityName).toBeUndefined();
    expect(call.templateData.authorityUrl).toBeUndefined();
  });

  it.each([
    ["a missing product name", { product: {} }, "productName is required"],
    [
      "a missing companion name",
      { patient: { companionId: "pat-1" } },
      "companion name is required",
    ],
  ])("refuses %s", async (_label, override, message) => {
    await expect(
      AdverseEventService.createFromMobile(
        {
          ...(VALID_INPUT as object),
          ...override,
        } as never,
        "par-1",
      ),
    ).rejects.toThrow(message);

    expect(prisma.adverseEventReport.create).not.toHaveBeenCalled();
    expect(sendEmailTemplate).not.toHaveBeenCalled();
  });

  it("validates the report before storing or sending anything", async () => {
    await expect(
      AdverseEventService.createFromMobile(
        {
          ...(VALID_INPUT as object),
          reporter: { firstName: "Ada" },
        } as never,
        "par-1",
      ),
    ).rejects.toThrow("Reporter firstName and email are required");

    expect(prisma.adverseEventReport.create).not.toHaveBeenCalled();
    expect(sendEmailTemplate).not.toHaveBeenCalled();
  });
});

describe("AdverseEventService.createFromMobile - who and what a report names", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.adverseEventReport.create.mockResolvedValue(storedRow);
    prisma.patientOrganisation.findFirst.mockImplementation(
      matching(PRACTICE_LINKS),
    );
    prisma.appointment.findFirst.mockImplementation(matching(APPOINTMENTS));
    prisma.organization.findUnique.mockResolvedValue(null);
  });

  const report = (override: Row) =>
    ({ ...(VALID_INPUT as object), ...override }) as never;

  it("records the signed-in parent as the reporter and the checked companion", async () => {
    await AdverseEventService.createFromMobile(
      report({
        reporter: {
          firstName: "Ada",
          email: "ada@example.com",
          userId: "someone-else",
        },
        patient: { name: "Poppy", companionId: "pat-1", patientId: undefined },
      }),
      "par-1",
    );

    const { data } = prisma.adverseEventReport.create.mock.calls[0][0];
    expect(data.reporter.userId).toBe("par-1");
    expect(data.patient).toMatchObject({
      patientId: "pat-1",
      companionId: "pat-1",
    });
    expect(data.organisationId).toBe("org-1");
  });

  it("stores the companion named by patientId over a different companionId", async () => {
    await AdverseEventService.createFromMobile(
      report({
        patient: { name: "Poppy", patientId: "pat-1", companionId: "pat-9" },
      }),
      "par-1",
    );

    const { data } = prisma.adverseEventReport.create.mock.calls[0][0];
    expect(data.patient.companionId).toBe("pat-1");
  });

  it.each<[string, unknown]>([
    ["a practice the companion is not linked to", "org-3"],
    ["a practice whose link was revoked", "org-2"],
    ["a practice that does not exist", "org-missing"],
    ["a practice named by a filter instead of an id", { not: "" }],
  ])("refuses %s as not found", async (_label, organisationId) => {
    await expect(
      AdverseEventService.createFromMobile(report({ organisationId }), "par-1"),
    ).rejects.toMatchObject({ statusCode: 404 });

    expect(prisma.adverseEventReport.create).not.toHaveBeenCalled();
    expect(sendEmailTemplate).not.toHaveBeenCalled();
  });

  it("accepts an appointment booked for the companion at that practice", async () => {
    await AdverseEventService.createFromMobile(
      report({ appointmentId: "appt-1" }),
      "par-1",
    );

    const { data } = prisma.adverseEventReport.create.mock.calls[0][0];
    expect(data.appointmentId).toBe("appt-1");
  });

  it.each([
    ["booked for another companion", { appointmentId: "appt-9" }],
    [
      "at another practice",
      { appointmentId: "appt-1", organisationId: "org-3" },
    ],
    [
      "with no practice named",
      { appointmentId: "appt-1", organisationId: undefined },
    ],
    ["that does not exist", { appointmentId: "appt-missing" }],
    ["named by a filter instead of an id", { appointmentId: { not: "" } }],
  ])("refuses an appointment %s", async (_label, override) => {
    await expect(
      AdverseEventService.createFromMobile(report(override), "par-1"),
    ).rejects.toMatchObject({ statusCode: 404 });

    expect(prisma.adverseEventReport.create).not.toHaveBeenCalled();
  });

  it.each([
    ["no companion", { patient: { name: "Poppy" } }, "par-1"],
    ["no signed-in parent", {}, ""],
  ])("refuses a report with %s", async (_label, override, parentId) => {
    await expect(
      AdverseEventService.createFromMobile(report(override), parentId),
    ).rejects.toMatchObject({ statusCode: 404 });

    expect(prisma.adverseEventReport.create).not.toHaveBeenCalled();
  });
});

describe("AdverseEventService - practice reads and status changes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.adverseEventReport.findFirst.mockImplementation(matching(REPORTS));
    prisma.adverseEventReport.update.mockImplementation(
      async ({ where, data }: { where: Row; data: Row }) => ({
        ...REPORTS.find((row) => row.id === where.id),
        ...data,
      }),
    );
  });

  it("returns a report sent to the caller's organisation", async () => {
    const found = await AdverseEventService.getById("report-1", "org-1");
    expect(found?.id).toBe("report-1");
  });

  it.each([
    ["another organisation's report", "report-2", "org-1"],
    ["a report when no organisation is known", "report-1", ""],
  ])("does not return %s", async (_label, id, organisationId) => {
    await expect(
      AdverseEventService.getById(id, organisationId),
    ).resolves.toBeNull();
  });

  it("updates the status of a report sent to the caller's organisation", async () => {
    const updated = await AdverseEventService.updateStatus(
      "report-1",
      "REVIEWING",
      "org-1",
    );

    expect(updated.status).toBe("REVIEWING");
    expect(prisma.adverseEventReport.update).toHaveBeenCalledWith({
      where: { id: "report-1" },
      data: { status: "REVIEWING" },
    });
  });

  it.each([
    ["another organisation's report", "report-2", "org-1"],
    ["a report when no organisation is known", "report-1", ""],
  ])("refuses to change %s", async (_label, id, organisationId) => {
    await expect(
      AdverseEventService.updateStatus(id, "CLOSED", organisationId),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(prisma.adverseEventReport.update).not.toHaveBeenCalled();
  });
});
