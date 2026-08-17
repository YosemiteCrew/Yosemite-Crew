import { prisma } from "src/config/prisma";
import { NotificationService } from "src/services/notification.service";
import {
  notifyPatientOwner,
  passportLinkEmail,
  publicPassportUrl,
  resolvePatientOwnerContact,
} from "src/services/shared/owner-notification";
import { sendEmail } from "src/utils/email";
import logger from "src/utils/logger";

jest.mock("src/config/prisma", () => ({
  prisma: {
    parentPatient: { findFirst: jest.fn() },
    parent: { findUnique: jest.fn() },
    patient: { findUnique: jest.fn() },
  },
}));

jest.mock("src/services/notification.service", () => ({
  NotificationService: { sendToUser: jest.fn() },
}));

jest.mock("src/utils/email", () => ({ sendEmail: jest.fn() }));

jest.mock("src/utils/logger", () => ({
  __esModule: true,
  default: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

const prismaMock = prisma as unknown as {
  parentPatient: { findFirst: jest.Mock };
  parent: { findUnique: jest.Mock };
  patient: { findUnique: jest.Mock };
};
const sendToUserMock = NotificationService.sendToUser as jest.Mock;
const sendEmailMock = sendEmail as jest.Mock;
const loggerErrorMock = logger.error as jest.Mock;

const payload = { title: "Passport updated", body: "A new record was added." };
const buildPayload = jest.fn(() => payload);

// Wires the happy-path lookup chain: pet -> primary active parent -> contact.
const wireOwner = (
  parent: { linkedUserId: string | null; email: string | null } | null,
) => {
  prismaMock.parentPatient.findFirst.mockResolvedValue({ parentId: "par-1" });
  prismaMock.parent.findUnique.mockResolvedValue(parent);
  prismaMock.patient.findUnique.mockResolvedValue({ name: "Biscuit" });
};

beforeEach(() => {
  jest.clearAllMocks();
  buildPayload.mockReturnValue(payload);
  sendToUserMock.mockResolvedValue(undefined);
  sendEmailMock.mockResolvedValue(undefined);
  delete process.env.PUBLIC_PASSPORT_BASE_URL;
  delete process.env.PUBLIC_CARD_BASE_URL;
});

describe("resolvePatientOwnerContact", () => {
  it("resolves the primary active parent together with the pet name", async () => {
    wireOwner({ linkedUserId: "user-1", email: "owner@test.com" });

    await expect(resolvePatientOwnerContact("pat-1")).resolves.toEqual({
      linkedUserId: "user-1",
      email: "owner@test.com",
      patientName: "Biscuit",
    });
    expect(prismaMock.parentPatient.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { patientId: "pat-1", role: "PRIMARY", status: "ACTIVE" },
      }),
    );
  });

  it("returns null when the pet has no primary active owner link", async () => {
    prismaMock.parentPatient.findFirst.mockResolvedValue(null);

    await expect(resolvePatientOwnerContact("pat-1")).resolves.toBeNull();
    expect(prismaMock.parent.findUnique).not.toHaveBeenCalled();
  });

  it("returns null when the parent row is gone", async () => {
    wireOwner(null);

    await expect(resolvePatientOwnerContact("pat-1")).resolves.toBeNull();
  });

  it("returns null when the patient row is gone", async () => {
    wireOwner({ linkedUserId: "user-1", email: "owner@test.com" });
    prismaMock.patient.findUnique.mockResolvedValue(null);

    await expect(resolvePatientOwnerContact("pat-1")).resolves.toBeNull();
  });
});

describe("notifyPatientOwner", () => {
  it("pushes and emails, defaulting the email to the push copy", async () => {
    wireOwner({ linkedUserId: "user-1", email: "owner@test.com" });

    await notifyPatientOwner({
      patientId: "pat-1",
      label: "Test-flow",
      buildPayload,
    });

    expect(buildPayload).toHaveBeenCalledWith("Biscuit");
    expect(sendToUserMock).toHaveBeenCalledWith("user-1", payload);
    expect(sendEmailMock).toHaveBeenCalledWith({
      to: "owner@test.com",
      subject: "Passport updated",
      htmlBody: "<p>A new record was added.</p>",
    });
  });

  it("uses a caller-supplied email over the default", async () => {
    wireOwner({ linkedUserId: null, email: "owner@test.com" });

    await notifyPatientOwner({
      patientId: "pat-1",
      label: "Test-flow",
      buildPayload,
      buildEmail: ({ patientId, patientName }) => ({
        subject: `Hello about ${patientName}`,
        htmlBody: `<p>${patientId}</p>`,
      }),
    });

    expect(sendEmailMock).toHaveBeenCalledWith({
      to: "owner@test.com",
      subject: "Hello about Biscuit",
      htmlBody: "<p>pat-1</p>",
    });
  });

  it("pushes only when the owner has no email on file", async () => {
    wireOwner({ linkedUserId: "user-1", email: null });

    await notifyPatientOwner({
      patientId: "pat-1",
      label: "Test-flow",
      buildPayload,
    });

    expect(sendToUserMock).toHaveBeenCalled();
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("emails only when the owner has no linked app account", async () => {
    wireOwner({ linkedUserId: null, email: "owner@test.com" });

    await notifyPatientOwner({
      patientId: "pat-1",
      label: "Test-flow",
      buildPayload,
    });

    expect(sendToUserMock).not.toHaveBeenCalled();
    expect(sendEmailMock).toHaveBeenCalled();
  });

  it("no-ops without building a payload when there is no owner", async () => {
    prismaMock.parentPatient.findFirst.mockResolvedValue(null);

    await notifyPatientOwner({
      patientId: "pat-1",
      label: "Test-flow",
      buildPayload,
    });

    expect(buildPayload).not.toHaveBeenCalled();
    expect(sendToUserMock).not.toHaveBeenCalled();
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("logs and swallows a push failure, still sending the email", async () => {
    wireOwner({ linkedUserId: "user-1", email: "owner@test.com" });
    sendToUserMock.mockRejectedValueOnce(new Error("push down"));

    await expect(
      notifyPatientOwner({
        patientId: "pat-1",
        label: "Test-flow",
        buildPayload,
      }),
    ).resolves.toBeUndefined();

    expect(loggerErrorMock).toHaveBeenCalledWith(
      "Test-flow push failed for patient pat-1",
      expect.any(Error),
    );
    expect(sendEmailMock).toHaveBeenCalled();
  });

  it("logs and swallows an email failure", async () => {
    wireOwner({ linkedUserId: null, email: "owner@test.com" });
    sendEmailMock.mockRejectedValueOnce(new Error("ses down"));

    await expect(
      notifyPatientOwner({
        patientId: "pat-1",
        label: "Test-flow",
        buildPayload,
      }),
    ).resolves.toBeUndefined();

    expect(loggerErrorMock).toHaveBeenCalledWith(
      "Test-flow email failed for patient pat-1",
      expect.any(Error),
    );
  });

  it("logs and swallows a lookup failure", async () => {
    prismaMock.parentPatient.findFirst.mockRejectedValue(new Error("db down"));

    await expect(
      notifyPatientOwner({
        patientId: "pat-1",
        label: "Test-flow",
        buildPayload,
      }),
    ).resolves.toBeUndefined();

    expect(loggerErrorMock).toHaveBeenCalledWith(
      "Test-flow owner notification failed",
      expect.objectContaining({ patientId: "pat-1" }),
    );
  });
});

describe("publicPassportUrl", () => {
  it("builds the link from the passport base URL", () => {
    process.env.PUBLIC_PASSPORT_BASE_URL = "https://app.test";

    expect(publicPassportUrl("pat-1")).toBe("https://app.test/passport/pat-1");
  });

  it("strips trailing slashes from the configured base", () => {
    process.env.PUBLIC_PASSPORT_BASE_URL = "https://app.test///";

    expect(publicPassportUrl("pat-1")).toBe("https://app.test/passport/pat-1");
  });

  it("falls back to the card base URL", () => {
    process.env.PUBLIC_CARD_BASE_URL = "https://card.test/";

    expect(publicPassportUrl("pat-1")).toBe("https://card.test/passport/pat-1");
  });

  it("yields a relative link when neither base is configured", () => {
    expect(publicPassportUrl("pat-1")).toBe("/passport/pat-1");
  });
});

describe("passportLinkEmail", () => {
  it("renders the push copy plus a link into the pet's passport", () => {
    process.env.PUBLIC_PASSPORT_BASE_URL = "https://app.test";

    const email = passportLinkEmail(
      (patientName) => `${patientName}'s passport was updated`,
    )({ patientId: "pat-1", patientName: "Biscuit", payload });

    expect(email.subject).toBe("Biscuit's passport was updated");
    expect(email.htmlBody).toBe(
      "<p>A new record was added.</p>" +
        '<p><a href="https://app.test/passport/pat-1">View Biscuit\'s passport</a></p>',
    );
  });
});
