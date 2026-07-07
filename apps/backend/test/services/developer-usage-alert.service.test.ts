import {
  DeveloperUsageAlertService,
  resolveOrgOwnerContact,
} from "../../src/services/developer-usage-alert.service";
import { prisma } from "../../src/config/prisma";
import { sendEmail } from "../../src/utils/email";
import logger from "../../src/utils/logger";

jest.mock("../../src/config/prisma", () => ({
  prisma: {
    developerUsageAlert: { create: jest.fn() },
    organization: { findFirst: jest.fn() },
    userOrganization: { findFirst: jest.fn() },
    user: { findFirst: jest.fn() },
  },
}));

jest.mock("../../src/utils/email", () => ({
  sendEmail: jest.fn(),
}));

jest.mock("../../src/utils/logger", () => ({
  __esModule: true,
  default: { error: jest.fn(), info: jest.fn() },
}));

const mockPrisma = prisma as unknown as {
  developerUsageAlert: { create: jest.Mock };
  organization: { findFirst: jest.Mock };
  userOrganization: { findFirst: jest.Mock };
  user: { findFirst: jest.Mock };
};

const sendEmailMock = sendEmail as jest.Mock;
const loggerErrorMock = logger.error as jest.Mock;

const uniqueViolation = () =>
  Object.assign(new Error("unique"), { code: "P2002" });

const primeOwner = () => {
  mockPrisma.organization.findFirst.mockResolvedValue({
    id: "org-1",
    name: "Sunny Paws",
    fhirId: "fhir-org-1",
  });
  mockPrisma.userOrganization.findFirst.mockResolvedValue({
    practitionerReference: "Practitioner/user-7",
  });
  mockPrisma.user.findFirst.mockResolvedValue({
    email: "owner@example.com",
    firstName: "Ada",
    lastName: "Vet",
  });
};

// setImmediate fires only after every pending promise job has drained, so this
// flushes the whole fire-and-forget chain regardless of how many awaits it has.
const flush = async () => {
  await new Promise((resolve) => {
    setImmediate(resolve);
  });
};

describe("resolveOrgOwnerContact", () => {
  beforeEach(() => jest.clearAllMocks());

  it("resolves the owner via org -> owner mapping -> user", async () => {
    primeOwner();
    const owner = await resolveOrgOwnerContact("org-1");
    expect(owner).toEqual({
      email: "owner@example.com",
      name: "Ada Vet",
      organisationName: "Sunny Paws",
    });
    expect(
      mockPrisma.userOrganization.findFirst.mock.calls[0][0].where,
    ).toMatchObject({ roleCode: "OWNER", active: true });
  });

  it("returns null when the organisation is unknown", async () => {
    mockPrisma.organization.findFirst.mockResolvedValue(null);
    expect(await resolveOrgOwnerContact("org-x")).toBeNull();
  });

  it("returns null when there is no active OWNER mapping", async () => {
    mockPrisma.organization.findFirst.mockResolvedValue({
      id: "org-1",
      name: "Sunny Paws",
      fhirId: null,
    });
    mockPrisma.userOrganization.findFirst.mockResolvedValue(null);
    expect(await resolveOrgOwnerContact("org-1")).toBeNull();
  });

  it("returns null when the owner user has no email", async () => {
    primeOwner();
    mockPrisma.user.findFirst.mockResolvedValue({
      email: null,
      firstName: "A",
      lastName: "B",
    });
    expect(await resolveOrgOwnerContact("org-1")).toBeNull();
  });

  it("omits the name when the owner has no name parts", async () => {
    primeOwner();
    mockPrisma.user.findFirst.mockResolvedValue({
      email: "owner@example.com",
      firstName: null,
      lastName: null,
    });
    const owner = await resolveOrgOwnerContact("org-1");
    expect(owner?.name).toBeUndefined();
  });
});

describe("DeveloperUsageAlertService.sendThresholdAlert", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.developerUsageAlert.create.mockResolvedValue({});
    sendEmailMock.mockResolvedValue({});
    primeOwner();
  });

  const input = {
    organisationId: "org-1",
    billingPeriod: "2026-07",
    threshold: 80,
    callCount: 800,
    limit: 1000,
  };

  it("claims the dedupe row BEFORE emailing, then emails the owner", async () => {
    await DeveloperUsageAlertService.sendThresholdAlert(input);

    expect(mockPrisma.developerUsageAlert.create).toHaveBeenCalledWith({
      data: {
        organisationId: "org-1",
        billingPeriod: "2026-07",
        threshold: 80,
      },
    });
    expect(sendEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "owner@example.com",
        subject: expect.stringContaining("80%"),
      }),
    );
    const createOrder =
      mockPrisma.developerUsageAlert.create.mock.invocationCallOrder[0];
    const emailOrder = sendEmailMock.mock.invocationCallOrder[0];
    expect(createOrder).toBeLessThan(emailOrder);
  });

  it("returns silently on a duplicate claim (already alerted this month)", async () => {
    mockPrisma.developerUsageAlert.create.mockRejectedValue(uniqueViolation());
    await expect(
      DeveloperUsageAlertService.sendThresholdAlert(input),
    ).resolves.toBeUndefined();
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("rethrows non-unique-violation claim failures", async () => {
    mockPrisma.developerUsageAlert.create.mockRejectedValue(
      new Error("db down"),
    );
    await expect(
      DeveloperUsageAlertService.sendThresholdAlert(input),
    ).rejects.toThrow("db down");
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("logs and returns when no owner contact can be resolved", async () => {
    mockPrisma.organization.findFirst.mockResolvedValue(null);
    await DeveloperUsageAlertService.sendThresholdAlert(input);
    expect(sendEmailMock).not.toHaveBeenCalled();
    expect(loggerErrorMock).toHaveBeenCalledWith(
      "Usage alert: no owner contact for organisation",
      expect.objectContaining({ organisationId: "org-1", threshold: 80 }),
    );
  });

  it("words the 100% alert as quota exhausted", async () => {
    await DeveloperUsageAlertService.sendThresholdAlert({
      ...input,
      threshold: 100,
      callCount: 1000,
    });
    expect(sendEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: expect.stringContaining("100%"),
        textBody: expect.stringContaining("1000 of 1000"),
      }),
    );
  });
});

describe("DeveloperUsageAlertService.notifyThresholds", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.developerUsageAlert.create.mockResolvedValue({});
    sendEmailMock.mockResolvedValue({});
    primeOwner();
  });

  it("fires the 80% alert exactly when the counter hits 800/1000", async () => {
    DeveloperUsageAlertService.notifyThresholds("org-1", "2026-07", 800, 1000);
    await flush();
    expect(mockPrisma.developerUsageAlert.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ threshold: 80 }),
      }),
    );
  });

  it("fires the 100% alert exactly when the counter hits 1000/1000", async () => {
    DeveloperUsageAlertService.notifyThresholds("org-1", "2026-07", 1000, 1000);
    await flush();
    expect(mockPrisma.developerUsageAlert.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ threshold: 100 }),
      }),
    );
    expect(mockPrisma.developerUsageAlert.create).toHaveBeenCalledTimes(1);
  });

  it.each([799, 801, 999, 1001, 1])(
    "does nothing at a non-crossing count (%s)",
    async (count) => {
      DeveloperUsageAlertService.notifyThresholds(
        "org-1",
        "2026-07",
        count,
        1000,
      );
      await flush();
      expect(mockPrisma.developerUsageAlert.create).not.toHaveBeenCalled();
      expect(sendEmailMock).not.toHaveBeenCalled();
    },
  );

  it("never throws to the hot path: dispatch failures are logged", async () => {
    mockPrisma.developerUsageAlert.create.mockRejectedValue(
      new Error("db down"),
    );
    expect(() =>
      DeveloperUsageAlertService.notifyThresholds(
        "org-1",
        "2026-07",
        800,
        1000,
      ),
    ).not.toThrow();
    await flush();
    expect(loggerErrorMock).toHaveBeenCalledWith(
      "Failed to send developer usage alert",
      expect.objectContaining({ threshold: 80 }),
    );
  });

  it("an email failure after the claim is logged, not retried", async () => {
    sendEmailMock.mockRejectedValue(new Error("ses down"));
    DeveloperUsageAlertService.notifyThresholds("org-1", "2026-07", 800, 1000);
    await flush();
    expect(loggerErrorMock).toHaveBeenCalledWith(
      "Failed to send developer usage alert",
      expect.objectContaining({ threshold: 80 }),
    );
  });
});
