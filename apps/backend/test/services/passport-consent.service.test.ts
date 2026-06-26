import {
  PassportConsentService,
  PassportConsentError,
} from "src/services/passport-consent.service";
import { prisma } from "src/config/prisma";

jest.mock("src/config/prisma", () => ({
  prisma: {
    patientOrganisation: { findFirst: jest.fn() },
    patient: { findUnique: jest.fn() },
    passportShareConsent: {
      upsert: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));

const prismaMock = prisma as unknown as {
  patientOrganisation: { findFirst: jest.Mock };
  patient: { findUnique: jest.Mock };
  passportShareConsent: {
    upsert: jest.Mock;
    findUnique: jest.Mock;
    update: jest.Mock;
    findMany: jest.Mock;
  };
};

const consentRow = (over: Record<string, unknown> = {}) => ({
  id: "con-1",
  microchipNumber: "985141000123456",
  patientId: "pat-1",
  ownerOrganisationId: "org-1",
  recipientOrganisationId: "org-2",
  status: "PENDING",
  purpose: null,
  parentId: null,
  consentMethod: null,
  consentedAt: null,
  createdAt: new Date("2024-06-24T00:00:00.000Z"),
  ...over,
});

const ACTOR = { type: "PMS_USER" as const, id: "vet-1" };

beforeEach(() => {
  jest.clearAllMocks();
  prismaMock.patientOrganisation.findFirst.mockResolvedValue({ id: "link-1" });
  prismaMock.patient.findUnique.mockResolvedValue({
    microchipNumber: "985141000123456",
  });
  prismaMock.passportShareConsent.upsert.mockImplementation((args) =>
    Promise.resolve(consentRow({ ...args.create })),
  );
  prismaMock.passportShareConsent.findUnique.mockResolvedValue(consentRow());
  prismaMock.passportShareConsent.update.mockImplementation((args) =>
    Promise.resolve(consentRow({ ...args.data })),
  );
  prismaMock.passportShareConsent.findMany.mockResolvedValue([]);
});

describe("PassportConsentService.requestConsent", () => {
  const base = {
    patientId: "pat-1",
    organisationId: "org-1",
    recipientOrganisationId: "org-2",
    actor: ACTOR,
  };

  it("records a PENDING consent keyed to the microchip", async () => {
    const dto = await PassportConsentService.requestConsent({
      ...base,
      purpose: "referral",
    });
    expect(dto).toMatchObject({
      status: "PENDING",
      microchipNumber: "985141000123456",
      recipientOrganisationId: "org-2",
      purpose: "referral",
    });
  });

  it("defaults purpose and handles a null actor id", async () => {
    const dto = await PassportConsentService.requestConsent({
      patientId: "pat-1",
      organisationId: "org-1",
      recipientOrganisationId: "org-2",
      actor: { type: "PMS_USER", id: null },
    });
    expect(dto.purpose).toBeUndefined();
  });

  it("rejects sharing with the owning practice", async () => {
    await expect(
      PassportConsentService.requestConsent({
        ...base,
        recipientOrganisationId: "org-1",
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("404s a companion outside the caller org", async () => {
    prismaMock.patientOrganisation.findFirst.mockResolvedValue(null);
    await expect(
      PassportConsentService.requestConsent(base),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("400s a companion with no microchip", async () => {
    prismaMock.patient.findUnique.mockResolvedValue({ microchipNumber: null });
    await expect(
      PassportConsentService.requestConsent(base),
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe("PassportConsentService.grantConsent", () => {
  it("grants with the parent consent method", async () => {
    const dto = await PassportConsentService.grantConsent({
      consentId: "con-1",
      organisationId: "org-1",
      method: "EMAIL",
      parentId: "par-1",
    });
    expect(dto.status).toBe("GRANTED");
    expect(dto.consentMethod).toBe("EMAIL");
  });

  it("keeps the existing parent when none is supplied", async () => {
    prismaMock.passportShareConsent.findUnique.mockResolvedValue(
      consentRow({ parentId: "par-0" }),
    );
    const dto = await PassportConsentService.grantConsent({
      consentId: "con-1",
      organisationId: "org-1",
      method: "MOBILE",
    });
    expect(dto.status).toBe("GRANTED");
  });

  it("404s an unknown or out-of-org consent", async () => {
    prismaMock.passportShareConsent.findUnique.mockResolvedValue(null);
    await expect(
      PassportConsentService.grantConsent({
        consentId: "con-1",
        organisationId: "org-1",
        method: "MOBILE",
      }),
    ).rejects.toMatchObject({ statusCode: 404 });

    prismaMock.passportShareConsent.findUnique.mockResolvedValue(consentRow());
    await expect(
      PassportConsentService.grantConsent({
        consentId: "con-1",
        organisationId: "org-9",
        method: "MOBILE",
      }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("PassportConsentService.revokeConsent", () => {
  it("revokes a consent (owner or recipient org)", async () => {
    prismaMock.passportShareConsent.findUnique.mockResolvedValue(
      consentRow({ status: "GRANTED" }),
    );
    const dto = await PassportConsentService.revokeConsent({
      consentId: "con-1",
      organisationId: "org-2",
      reason: "withdrawn",
    });
    expect(dto.status).toBe("REVOKED");
  });

  it("revokes without a reason", async () => {
    prismaMock.passportShareConsent.findUnique.mockResolvedValue(
      consentRow({ status: "GRANTED" }),
    );
    const dto = await PassportConsentService.revokeConsent({
      consentId: "con-1",
      organisationId: "org-1",
    });
    expect(dto.status).toBe("REVOKED");
  });

  it("404s an unknown consent", async () => {
    prismaMock.passportShareConsent.findUnique.mockResolvedValue(null);
    await expect(
      PassportConsentService.revokeConsent({
        consentId: "con-1",
        organisationId: "org-1",
      }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("PassportConsentService reads", () => {
  it("lists outgoing and incoming consents", async () => {
    prismaMock.passportShareConsent.findMany
      .mockResolvedValueOnce([consentRow()])
      .mockResolvedValueOnce([consentRow({ id: "con-2" })]);
    const result = await PassportConsentService.listConsents("org-1");
    expect(result.outgoing).toHaveLength(1);
    expect(result.incoming).toHaveLength(1);
  });

  it("returns the owner orgs a recipient may read", async () => {
    prismaMock.passportShareConsent.findMany.mockResolvedValue([
      { ownerOrganisationId: "org-1" },
      { ownerOrganisationId: "org-3" },
    ]);
    const orgs = await PassportConsentService.grantedOwnerOrgs("985", "org-2");
    expect(orgs).toEqual(["org-1", "org-3"]);
  });

  it("exposes a typed error", () => {
    expect(new PassportConsentError("x", 400)).toBeInstanceOf(Error);
  });
});
