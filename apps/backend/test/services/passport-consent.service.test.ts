import {
  PassportConsentService,
  PassportConsentError,
} from "src/services/passport-consent.service";
import { prisma } from "src/config/prisma";
import { AuditTrailService } from "src/services/audit-trail.service";
import { NotificationService } from "src/services/notification.service";
import { sendEmail } from "src/utils/email";
import { storedRows } from "../helpers/stored-rows";

jest.mock("src/config/prisma", () => ({
  prisma: {
    patientOrganisation: { findFirst: jest.fn() },
    patient: { findUnique: jest.fn() },
    passportShareConsent: {
      upsert: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
    parentPatient: { findFirst: jest.fn(), findMany: jest.fn() },
    parent: { findUnique: jest.fn() },
    authUserMobile: { findFirst: jest.fn() },
  },
}));

jest.mock("src/services/audit-trail.service", () => ({
  AuditTrailService: { recordSafely: jest.fn().mockResolvedValue(undefined) },
}));

jest.mock("src/services/notification.service", () => ({
  NotificationService: {
    sendToUser: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock("src/utils/email", () => ({
  sendEmail: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("src/utils/logger", () => ({
  __esModule: true,
  default: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

const mockRecordSafely = AuditTrailService.recordSafely as jest.Mock;
const mockSendToUser = NotificationService.sendToUser as jest.Mock;
const mockSendEmail = sendEmail as jest.Mock;

const prismaMock = prisma as unknown as {
  patientOrganisation: { findFirst: jest.Mock };
  patient: { findUnique: jest.Mock };
  passportShareConsent: {
    upsert: jest.Mock;
    findUnique: jest.Mock;
    findFirst: jest.Mock;
    update: jest.Mock;
    findMany: jest.Mock;
  };
  parentPatient: { findFirst: jest.Mock; findMany: jest.Mock };
  parent: { findUnique: jest.Mock };
  authUserMobile: { findFirst: jest.Mock };
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
  mockRecordSafely.mockResolvedValue(undefined);
  mockSendToUser.mockResolvedValue(undefined);
  mockSendEmail.mockResolvedValue(undefined);
  prismaMock.patientOrganisation.findFirst.mockResolvedValue({ id: "link-1" });
  prismaMock.parentPatient.findFirst.mockResolvedValue(null);
  prismaMock.parent.findUnique.mockResolvedValue(null);
  prismaMock.authUserMobile.findFirst.mockResolvedValue(null);
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

  it.each(["PENDING", "REVOKED"])(
    "404s a companion whose link to the caller org is %s",
    async (status) => {
      prismaMock.patientOrganisation.findFirst.mockImplementation(
        storedRows([{ patientId: "pat-1", organisationId: "org-1", status }])
          .findFirst,
      );
      await expect(
        PassportConsentService.requestConsent(base),
      ).rejects.toMatchObject({
        message: "Companion not found.",
        statusCode: 404,
      });
      expect(prismaMock.passportShareConsent.upsert).not.toHaveBeenCalled();
    },
  );

  it("records a consent request for an actively linked companion", async () => {
    prismaMock.patientOrganisation.findFirst.mockImplementation(
      storedRows([
        { patientId: "pat-1", organisationId: "org-1", status: "ACTIVE" },
      ]).findFirst,
    );
    await PassportConsentService.requestConsent(base);
    expect(prismaMock.passportShareConsent.upsert).toHaveBeenCalled();
  });

  it("400s a companion with no microchip", async () => {
    prismaMock.patient.findUnique.mockResolvedValue({ microchipNumber: null });
    await expect(
      PassportConsentService.requestConsent(base),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("emits PASSPORT_CONSENT_REQUESTED audit event", async () => {
    await PassportConsentService.requestConsent(base);
    expect(mockRecordSafely).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "PASSPORT_CONSENT_REQUESTED",
        patientId: "pat-1",
        organisationId: "org-1",
        actorType: "PMS_USER",
        actorId: "vet-1",
        entityType: "COMPANION",
      }),
    );
  });

  it("sends push notification to owner when linkedUserId is present", async () => {
    prismaMock.parentPatient.findFirst.mockResolvedValue({
      parentId: "par-1",
    });
    prismaMock.parent.findUnique.mockResolvedValue({
      linkedUserId: "user-1",
      email: null,
    });
    prismaMock.patient.findUnique
      .mockResolvedValueOnce({ microchipNumber: "985141000123456" })
      .mockResolvedValueOnce({ name: "Buddy" });
    await PassportConsentService.requestConsent(base);
    // flush the detached fire-and-forget promise chain
    await new Promise((r) => setImmediate(r));
    expect(mockSendToUser).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ title: "Passport sharing request" }),
    );
  });

  it("sends email to owner when email is present and no linkedUserId", async () => {
    prismaMock.parentPatient.findFirst.mockResolvedValue({
      parentId: "par-2",
    });
    prismaMock.parent.findUnique.mockResolvedValue({
      linkedUserId: null,
      email: "owner@example.com",
    });
    prismaMock.patient.findUnique
      .mockResolvedValueOnce({ microchipNumber: "985141000123456" })
      .mockResolvedValueOnce({ name: "Max" });
    await PassportConsentService.requestConsent(base);
    await new Promise((r) => setImmediate(r));
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "owner@example.com",
        subject: expect.stringContaining("Max"),
      }),
    );
  });

  it("does not throw if notification lookup finds no owner", async () => {
    prismaMock.parentPatient.findFirst.mockResolvedValue(null);
    await expect(
      PassportConsentService.requestConsent(base),
    ).resolves.toBeDefined();
    await new Promise((r) => setImmediate(r));
    expect(mockSendToUser).not.toHaveBeenCalled();
  });
});

describe("PassportConsentService.grantConsent", () => {
  // Consent to share clinical records across practices belongs to the pet's
  // owner, so every granted case must be authenticated AS that owner. The
  // caller presents an auth PROVIDER id, resolved to a parent through AuthUser.
  //
  // Stored rows: user-1 is par-1, the ACTIVE primary parent of pat-1.
  // user-2 is par-2, who owns pat-2 only. con-1 is for pat-1 between org-1
  // and org-2; con-revoked is also for pat-1, already revoked.
  const CONSENTS = [
    consentRow(),
    consentRow({ id: "con-revoked", status: "REVOKED" }),
  ];
  const PRIMARY_LINKS = [
    {
      parentId: "par-1",
      patientId: "pat-1",
      role: "PRIMARY",
      status: "ACTIVE",
    },
    {
      parentId: "par-2",
      patientId: "pat-2",
      role: "PRIMARY",
      status: "ACTIVE",
    },
    {
      parentId: "par-3",
      patientId: "pat-1",
      role: "PRIMARY",
      status: "REVOKED",
    },
  ];
  const USERS: Record<string, string> = {
    "user-1": "par-1",
    "user-2": "par-2",
    "user-3": "par-3",
  };

  beforeEach(() => {
    prismaMock.authUserMobile.findFirst.mockImplementation(
      async ({ where }: { where: { providerUserId: string } }) =>
        USERS[where.providerUserId]
          ? { parentId: USERS[where.providerUserId] }
          : null,
    );
    prismaMock.parentPatient.findMany.mockImplementation(
      async ({ where }: { where: Record<string, unknown> }) =>
        PRIMARY_LINKS.filter(
          (link) =>
            link.parentId === where.parentId &&
            link.role === where.role &&
            link.status === where.status,
        ),
    );
    prismaMock.passportShareConsent.findFirst.mockImplementation(
      async ({
        where,
      }: {
        where: {
          id: string;
          patientId: { in: string[] };
          OR: Array<Record<string, string>>;
        };
      }) =>
        CONSENTS.find(
          (row) =>
            row.id === where.id &&
            where.patientId.in.includes(row.patientId) &&
            where.OR.some((option) =>
              Object.entries(option).every(
                ([key, value]) =>
                  (row as Record<string, unknown>)[key] === value,
              ),
            ),
        ) ?? null,
    );
  });

  const grant = (over: Record<string, unknown> = {}) =>
    PassportConsentService.grantConsent({
      consentId: "con-1",
      organisationId: "org-1",
      method: "MOBILE",
      grantingUserId: "user-1",
      ...over,
    } as never);

  it("grants when the caller is the pet's primary parent", async () => {
    const dto = await grant({ method: "EMAIL" });
    expect(dto.status).toBe("GRANTED");
    expect(dto.consentMethod).toBe("EMAIL");
  });

  it("grants from the recipient practice too", async () => {
    await expect(grant({ organisationId: "org-2" })).resolves.toMatchObject({
      status: "GRANTED",
    });
  });

  it("derives parentId from the parent link, never from the caller", async () => {
    await grant();
    const data =
      prismaMock.passportShareConsent.update.mock.calls.at(-1)[0].data;
    expect(data.parentId).toBe("par-1");
  });

  it.each([
    ["a consent that does not exist", { consentId: "con-missing" }],
    ["a consent at another practice", { organisationId: "org-9" }],
    ["another owner's consent", { grantingUserId: "user-2" }],
    ["a parent whose primary link was revoked", { grantingUserId: "user-3" }],
    ["a caller with no parent account", { grantingUserId: "staff-9" }],
    ["an unauthenticated grant", { grantingUserId: null }],
    [
      "someone else's consent that was already revoked",
      { consentId: "con-revoked", grantingUserId: "user-2" },
    ],
  ])("answers %s as not found", async (_label, over) => {
    await expect(grant(over)).rejects.toMatchObject({
      statusCode: 404,
      message: "Consent not found.",
    });
    expect(prismaMock.passportShareConsent.update).not.toHaveBeenCalled();
  });

  it("will not resurrect the owner's revoked consent", async () => {
    await expect(grant({ consentId: "con-revoked" })).rejects.toMatchObject({
      statusCode: 409,
    });
    expect(prismaMock.passportShareConsent.update).not.toHaveBeenCalled();
  });

  it("emits PASSPORT_CONSENT_GRANTED with the parent actor", async () => {
    await grant({ method: "EMAIL", actor: { type: "PARENT", id: "user-1" } });
    expect(mockRecordSafely).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "PASSPORT_CONSENT_GRANTED",
        actorType: "PARENT",
        actorId: "user-1",
        entityType: "COMPANION",
      }),
    );
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

  it("emits PASSPORT_CONSENT_REVOKED with actor when provided", async () => {
    prismaMock.passportShareConsent.findUnique.mockResolvedValue(
      consentRow({ status: "GRANTED" }),
    );
    await PassportConsentService.revokeConsent({
      consentId: "con-1",
      organisationId: "org-1",
      reason: "done",
      actor: { type: "PMS_USER", id: "vet-3" },
    });
    expect(mockRecordSafely).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "PASSPORT_CONSENT_REVOKED",
        actorType: "PMS_USER",
        actorId: "vet-3",
        entityType: "COMPANION",
      }),
    );
  });

  it("emits PASSPORT_CONSENT_REVOKED with default actor when none provided", async () => {
    prismaMock.passportShareConsent.findUnique.mockResolvedValue(
      consentRow({ status: "GRANTED" }),
    );
    await PassportConsentService.revokeConsent({
      consentId: "con-1",
      organisationId: "org-1",
    });
    expect(mockRecordSafely).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "PASSPORT_CONSENT_REVOKED",
        actorType: "PMS_USER",
        actorId: null,
      }),
    );
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
