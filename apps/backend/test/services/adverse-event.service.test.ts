import { AdverseEventService } from "src/services/adverse-event.service";

jest.mock("src/config/prisma", () => ({
  prisma: {
    adverseEventReport: {
      create: jest.fn(),
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
  patient: { name: "Poppy" },
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

describe("AdverseEventService.createFromMobile", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.adverseEventReport.create.mockResolvedValue(storedRow);
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
    await AdverseEventService.createFromMobile(VALID_INPUT);

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
    await AdverseEventService.createFromMobile({
      ...(VALID_INPUT as object),
      organisationId: undefined,
    } as never);

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
      AdverseEventService.createFromMobile(VALID_INPUT),
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

    const result = await AdverseEventService.createFromMobile(VALID_INPUT);

    expect(result).toBeDefined();
    expect(prisma.adverseEventReport.create).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalled();
  });

  it("omits the authority when the country has no entry", async () => {
    prisma.regulatoryAuthority.findFirst.mockResolvedValue(null);

    await AdverseEventService.createFromMobile(VALID_INPUT);

    const call = sendEmailTemplate.mock.calls[0][0];
    expect(call.templateData.authorityName).toBeUndefined();
    expect(call.templateData.authorityUrl).toBeUndefined();
  });

  it.each([
    ["a missing product name", { product: {} }, "productName is required"],
    ["a missing companion name", { patient: {} }, "companion name is required"],
  ])("refuses %s", async (_label, override, message) => {
    await expect(
      AdverseEventService.createFromMobile({
        ...(VALID_INPUT as object),
        ...override,
      } as never),
    ).rejects.toThrow(message);

    expect(prisma.adverseEventReport.create).not.toHaveBeenCalled();
    expect(sendEmailTemplate).not.toHaveBeenCalled();
  });

  it("validates the report before storing or sending anything", async () => {
    await expect(
      AdverseEventService.createFromMobile({
        ...(VALID_INPUT as object),
        reporter: { firstName: "Ada" },
      } as never),
    ).rejects.toThrow("Reporter firstName and email are required");

    expect(prisma.adverseEventReport.create).not.toHaveBeenCalled();
    expect(sendEmailTemplate).not.toHaveBeenCalled();
  });
});
