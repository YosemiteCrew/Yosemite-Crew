import {
  CompanionCardService,
  CompanionCardServiceError,
} from "src/services/companion-card.service";
import { prisma } from "src/config/prisma";
import { AuditTrailService } from "src/services/audit-trail.service";
import { NotificationService } from "src/services/notification.service";
import { AppointmentService } from "src/services/appointment.service";

jest.mock("src/config/prisma", () => ({
  prisma: {
    patient: { findUnique: jest.fn() },
    parent: { findUnique: jest.fn() },
    parentPatient: { findFirst: jest.fn() },
    patientOrganisation: { findFirst: jest.fn() },
    companionShareToken: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  },
}));

jest.mock("src/services/audit-trail.service", () => ({
  AuditTrailService: { recordSafely: jest.fn() },
}));
jest.mock("src/services/notification.service", () => ({
  NotificationService: { sendToUser: jest.fn() },
}));
jest.mock("src/services/appointment.service", () => ({
  AppointmentService: { getAppointmentsForCompanionByOrganisation: jest.fn() },
}));
jest.mock("src/utils/logger", () => ({
  __esModule: true,
  default: { warn: jest.fn(), info: jest.fn(), error: jest.fn() },
}));

const prismaMock = prisma as unknown as {
  patient: { findUnique: jest.Mock };
  parent: { findUnique: jest.Mock };
  parentPatient: { findFirst: jest.Mock };
  patientOrganisation: { findFirst: jest.Mock };
  companionShareToken: Record<string, jest.Mock>;
};
const auditMock = AuditTrailService.recordSafely as jest.Mock;
const notifyMock = NotificationService.sendToUser as jest.Mock;
const apptMock =
  AppointmentService.getAppointmentsForCompanionByOrganisation as jest.Mock;

const PATIENT = {
  id: "pat-1",
  name: "Doggy",
  type: "dog",
  breed: "Rottweiler",
  colour: "black",
  photoUrl: "https://img/doggy.png",
  microchipNumber: "1234",
  passportNumber: "PP-9",
  dateOfBirth: new Date("2024-01-10T00:00:00.000Z"),
  currentWeight: 6.8,
  allergy: "pollen",
  bloodGroup: "DEA 1.1 Positive",
  isNeutered: true,
  isInsured: true,
  insurance: { companyName: "PetCo", policyNumber: "SECRET-123" },
  alerts: [
    { title: "Aggressive", severity: "critical" },
    { title: "Diet note", severity: "low" },
  ],
};

const PARENT = {
  firstName: "Jane",
  lastName: "Doe",
  phoneNumber: "+15550001",
  email: "jane@example.com",
  linkedUserId: "user-9",
};

const tokenRow = (overrides: Record<string, unknown> = {}) => ({
  id: "tok-1",
  patientId: "pat-1",
  organisationId: "org-1",
  audience: "PUBLIC",
  showOwnerPhone: false,
  expiresAt: null,
  revokedAt: null,
  lastViewedAt: null,
  viewCount: 0,
  createdAt: new Date("2026-06-25T00:00:00.000Z"),
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  prismaMock.patient.findUnique.mockResolvedValue(PATIENT);
  prismaMock.parent.findUnique.mockResolvedValue(PARENT);
  prismaMock.parentPatient.findFirst.mockResolvedValue({
    parentId: "parent-1",
  });
  prismaMock.patientOrganisation.findFirst.mockResolvedValue({ id: "po-1" });
  prismaMock.companionShareToken.create.mockImplementation(
    ({ data }: { data: Record<string, unknown> }) =>
      tokenRow({ id: "tok-new", ...data }),
  );
  prismaMock.companionShareToken.update.mockResolvedValue(tokenRow());
  prismaMock.companionShareToken.updateMany.mockResolvedValue({ count: 1 });
  prismaMock.companionShareToken.findFirst.mockResolvedValue(tokenRow());
  prismaMock.companionShareToken.findMany.mockResolvedValue([tokenRow()]);
  apptMock.mockResolvedValue([
    { status: "fulfilled", start: "2026-06-20T10:00:00.000Z" },
  ]);
});

const resolveAs = (audience: string, showOwnerPhone = false) => {
  prismaMock.companionShareToken.findUnique.mockResolvedValue(
    tokenRow({ audience, showOwnerPhone }),
  );
  return CompanionCardService.resolveByRawToken("raw-token");
};

describe("CompanionCardService audience redaction", () => {
  it("STAFF card exposes identity, medical, insurance summary, owner and latest visit", async () => {
    const card = await resolveAs("STAFF");
    expect(card.identity).toMatchObject({
      name: "Doggy",
      microchipNumber: "1234",
    });
    expect(card.passportNumber).toBe("PP-9");
    expect(card.dateOfBirth).toBe("2024-01-10T00:00:00.000Z");
    expect(card.medical).toMatchObject({
      currentWeight: 6.8,
      isNeutered: true,
    });
    expect(card.insurance).toEqual({ isInsured: true, companyName: "PetCo" });
    expect(card.insurance).not.toHaveProperty("policyNumber");
    expect(card.ownerContact).toMatchObject({ email: "jane@example.com" });
    expect(card.latestVisit).toEqual({
      status: "fulfilled",
      occurredAt: "2026-06-20T10:00:00.000Z",
    });
    expect(card.alerts).toHaveLength(2);
  });

  it("PUBLIC card omits DOB/passport/insurance/visit and hides owner phone by default", async () => {
    const card = await resolveAs("PUBLIC", false);
    expect(card.passportNumber).toBeUndefined();
    expect(card.dateOfBirth).toBeUndefined();
    expect(card.insurance).toBeUndefined();
    expect(card.latestVisit).toBeUndefined();
    expect(card.ownerContact).toBeUndefined();
    expect(card.identity.microchipNumber).toBeUndefined();
    expect(card.identity.name).toBe("Doggy");
    // safety-only alerts: the low-severity "Diet note" is dropped.
    expect(card.alerts).toEqual([
      { title: "Aggressive", severity: "critical" },
    ]);
    // medical reduced to allergy + blood group.
    expect(card.medical).toEqual({
      allergy: "pollen",
      bloodGroup: "DEA 1.1 Positive",
    });
  });

  it("PUBLIC card surfaces only the owner phone when the issuer opted in", async () => {
    const card = await resolveAs("PUBLIC", true);
    expect(card.ownerContact).toEqual({
      firstName: "Jane",
      phoneNumber: "+15550001",
    });
    expect(card.ownerContact).not.toHaveProperty("email");
  });

  it("REFERRAL_CLINIC gets insurance status and status-only latest visit, no policy number", async () => {
    const card = await resolveAs("REFERRAL_CLINIC");
    expect(card.insurance).toEqual({ isInsured: true, companyName: "PetCo" });
    expect(card.insurance).not.toHaveProperty("policyNumber");
    expect(card.identity.microchipNumber).toBe("1234");
    expect(card.latestVisit).toEqual({ status: "fulfilled" });
    expect(card.ownerContact).toMatchObject({ phoneNumber: "+15550001" });
    expect(card.ownerContact).not.toHaveProperty("email");
  });

  it("rejects issuing a share for a companion not linked to the caller's org", async () => {
    prismaMock.patientOrganisation.findFirst.mockResolvedValue(null);
    await expect(
      CompanionCardService.issueShareToken({
        patientId: "pat-1",
        organisationId: "org-1",
        audience: "PUBLIC",
        actor: { type: "PMS_USER", id: "user-1" },
      }),
    ).rejects.toThrow(CompanionCardServiceError);
  });
});

describe("CompanionCardService token lifecycle", () => {
  it("issues a token returning the raw value (never the stored hash) and a QR payload", async () => {
    const result = await CompanionCardService.issueShareToken({
      patientId: "pat-1",
      organisationId: "org-1",
      audience: "PUBLIC",
      actor: { type: "PMS_USER", id: "user-1" },
    });
    const created = prismaMock.companionShareToken.create.mock.calls[0][0].data;
    expect(result.token).toBeTruthy();
    expect(result.token).not.toBe(created.tokenHash);
    expect(result.qrPayload).toContain(result.token);
    expect(result.qrPayload).toContain("/card/");
    expect(result.share).not.toHaveProperty("tokenHash");
  });

  it("revokes the prior active PUBLIC token before issuing a new one", async () => {
    await CompanionCardService.issueShareToken({
      patientId: "pat-1",
      organisationId: "org-1",
      audience: "PUBLIC",
      actor: { type: "PMS_USER", id: "user-1" },
    });
    expect(prismaMock.companionShareToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { patientId: "pat-1", audience: "PUBLIC", revokedAt: null },
      }),
    );
  });

  it("caps a REFERRAL ttl above the 30-day maximum", async () => {
    const oneYear = 365 * 24 * 60 * 60;
    await CompanionCardService.issueShareToken({
      patientId: "pat-1",
      organisationId: "org-1",
      audience: "REFERRAL_CLINIC",
      ttlSeconds: oneYear,
      actor: { type: "PMS_USER", id: "user-1" },
    });
    const data = prismaMock.companionShareToken.create.mock.calls[0][0].data;
    const ttlMs = (data.expiresAt as Date).getTime() - Date.now();
    expect(ttlMs).toBeLessThanOrEqual(30 * 24 * 60 * 60 * 1000 + 1000);
  });

  it("audits share issuance with the token id and no secret in metadata", async () => {
    await CompanionCardService.issueShareToken({
      patientId: "pat-1",
      organisationId: "org-1",
      audience: "PUBLIC",
      showOwnerPhone: true,
      actor: { type: "PMS_USER", id: "user-1" },
    });
    expect(auditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "COMPANION_CARD_SHARE_ISSUED",
        entityId: "tok-new",
        metadata: { audience: "PUBLIC", showOwnerPhone: true },
      }),
    );
    const audited = auditMock.mock.calls[0][0];
    expect(JSON.stringify(audited.metadata)).not.toContain("tokenHash");
  });

  it("notifies the owner when a card is shared", async () => {
    await CompanionCardService.issueShareToken({
      patientId: "pat-1",
      organisationId: "org-1",
      audience: "PUBLIC",
      actor: { type: "PMS_USER", id: "user-1" },
    });
    expect(notifyMock).toHaveBeenCalledWith(
      "user-9",
      expect.objectContaining({ title: expect.any(String) }),
    );
  });

  it.each([
    ["revoked", { revokedAt: new Date() }],
    ["expired", { expiresAt: new Date("2000-01-01T00:00:00.000Z") }],
  ])(
    "resolves a %s token to a uniform not-found",
    async (_label, overrides) => {
      prismaMock.companionShareToken.findUnique.mockResolvedValue(
        tokenRow(overrides),
      );
      await expect(
        CompanionCardService.resolveByRawToken("raw"),
      ).rejects.toThrow("Card not found.");
    },
  );

  it("rejects a missing token without leaking data", async () => {
    prismaMock.companionShareToken.findUnique.mockResolvedValue(null);
    await expect(CompanionCardService.resolveByRawToken("raw")).rejects.toThrow(
      "Card not found.",
    );
  });

  it("increments view count and audits a successful public resolve", async () => {
    await resolveAs("PUBLIC");
    expect(prismaMock.companionShareToken.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { viewCount: { increment: 1 }, lastViewedAt: expect.any(Date) },
      }),
    );
    expect(auditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "COMPANION_CARD_VIEWED",
        actorType: "SYSTEM",
      }),
    );
  });

  it("lists tokens for a companion mapped to safe DTOs", async () => {
    const list = await CompanionCardService.listTokens("pat-1", "org-1");
    expect(list).toHaveLength(1);
    expect(list[0]).not.toHaveProperty("tokenHash");
  });

  it("revokes a token, audits and notifies the owner", async () => {
    const result = await CompanionCardService.revokeToken("tok-1", "org-1", {
      type: "PMS_USER",
      id: "user-1",
    });
    expect(prismaMock.companionShareToken.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ revokedById: "user-1" }),
      }),
    );
    expect(auditMock).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "COMPANION_CARD_SHARE_REVOKED" }),
    );
    expect(notifyMock).toHaveBeenCalled();
    expect(result).not.toHaveProperty("tokenHash");
  });

  it("throws when revoking a token from another org", async () => {
    prismaMock.companionShareToken.findFirst.mockResolvedValue(null);
    await expect(
      CompanionCardService.revokeToken("tok-1", "org-1", {
        type: "PMS_USER",
        id: "user-1",
      }),
    ).rejects.toThrow(CompanionCardServiceError);
  });

  it("is idempotent when revoking an already-revoked token", async () => {
    prismaMock.companionShareToken.findFirst.mockResolvedValue(
      tokenRow({ revokedAt: new Date() }),
    );
    await CompanionCardService.revokeToken("tok-1", "org-1", {
      type: "PMS_USER",
      id: "user-1",
    });
    expect(prismaMock.companionShareToken.update).not.toHaveBeenCalled();
  });
});

describe("CompanionCardService resilience and edge cases", () => {
  it("omits latest visit when the appointment lookup fails", async () => {
    apptMock.mockRejectedValue(new Error("boom"));
    const card = await resolveAs("STAFF");
    expect(card.latestVisit).toBeUndefined();
  });

  it("omits latest visit when the companion has no appointments", async () => {
    apptMock.mockResolvedValue([]);
    const card = await resolveAs("STAFF");
    expect(card.latestVisit).toBeUndefined();
  });

  it("omits owner contact when there is no primary owner link", async () => {
    prismaMock.parentPatient.findFirst.mockResolvedValue(null);
    const card = await resolveAs("STAFF");
    expect(card.ownerContact).toBeUndefined();
  });

  it("does not notify when the owner has no linked user account", async () => {
    prismaMock.parent.findUnique.mockResolvedValue({
      ...PARENT,
      linkedUserId: null,
    });
    await CompanionCardService.issueShareToken({
      patientId: "pat-1",
      organisationId: "org-1",
      audience: "PUBLIC",
      actor: { type: "PMS_USER", id: "user-1" },
    });
    expect(notifyMock).not.toHaveBeenCalled();
  });

  it("rejects an empty raw token as not found", async () => {
    await expect(CompanionCardService.resolveByRawToken("")).rejects.toThrow(
      "Card not found.",
    );
  });

  it("omits the medical block for PUBLIC when no allergy or blood group is recorded", async () => {
    prismaMock.patient.findUnique.mockResolvedValue({
      ...PATIENT,
      allergy: null,
      bloodGroup: null,
    });
    const card = await resolveAs("PUBLIC");
    expect(card.medical).toBeUndefined();
  });

  it("reports an unknown insurance company as undefined while keeping the insured flag", async () => {
    prismaMock.patient.findUnique.mockResolvedValue({
      ...PATIENT,
      insurance: null,
    });
    const card = await resolveAs("STAFF");
    expect(card.insurance).toEqual({ isInsured: true, companyName: undefined });
  });

  it("resolves to not found when the token's companion no longer exists", async () => {
    prismaMock.companionShareToken.findUnique.mockResolvedValue(
      tokenRow({ audience: "PUBLIC" }),
    );
    prismaMock.patient.findUnique.mockResolvedValue(null);
    await expect(CompanionCardService.resolveByRawToken("raw")).rejects.toThrow(
      "Companion not found.",
    );
  });

  it("still succeeds when the owner notification throws", async () => {
    notifyMock.mockRejectedValue(new Error("push down"));
    await expect(
      CompanionCardService.issueShareToken({
        patientId: "pat-1",
        organisationId: "org-1",
        audience: "PUBLIC",
        actor: { type: "PMS_USER", id: "user-1" },
      }),
    ).resolves.toHaveProperty("token");
  });

  it("builds a minimal card when optional fields are absent", async () => {
    prismaMock.patient.findUnique.mockResolvedValue({
      id: "pat-2",
      name: "Min",
      type: "cat",
      breed: "DSH",
      colour: null,
      photoUrl: null,
      microchipNumber: null,
      passportNumber: null,
      dateOfBirth: null,
      currentWeight: null,
      allergy: null,
      bloodGroup: null,
      isNeutered: null,
      isInsured: false,
      insurance: null,
      alerts: null,
    });
    prismaMock.parent.findUnique.mockResolvedValue({
      firstName: "Sam",
      lastName: null,
      phoneNumber: null,
      email: "sam@example.com",
      linkedUserId: null,
    });
    const card = await resolveAs("STAFF");
    expect(card.identity).toEqual({
      id: "pat-2",
      name: "Min",
      type: "cat",
      breed: "DSH",
    });
    expect(card.passportNumber).toBeUndefined();
    expect(card.dateOfBirth).toBeUndefined();
    expect(card.alerts).toBeUndefined();
    expect(card.insurance).toEqual({ isInsured: false });
    expect(card.ownerContact).toMatchObject({
      firstName: "Sam",
      email: "sam@example.com",
    });
  });

  it("ignores malformed alert entries when parsing", async () => {
    prismaMock.patient.findUnique.mockResolvedValue({
      ...PATIENT,
      alerts: [
        "not-an-object",
        null,
        { severity: "high" },
        { title: "Bites", severity: "weird" },
        { title: "Allergy", severity: "critical" },
      ],
    });
    const card = await resolveAs("PUBLIC", false);
    expect(card.alerts).toEqual([{ title: "Allergy", severity: "critical" }]);
  });

  it("hides owner contact on a PUBLIC opt-in card when no phone is on file", async () => {
    prismaMock.parent.findUnique.mockResolvedValue({
      ...PARENT,
      phoneNumber: null,
    });
    const card = await resolveAs("PUBLIC", true);
    expect(card.ownerContact).toBeUndefined();
  });

  it("treats a non-string insurance company as unknown", async () => {
    prismaMock.patient.findUnique.mockResolvedValue({
      ...PATIENT,
      insurance: { companyName: 123 },
    });
    const card = await resolveAs("STAFF");
    expect(card.insurance).toEqual({ isInsured: true });
  });
});
