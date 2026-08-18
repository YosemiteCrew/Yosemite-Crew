import {
  PatientConsentService,
  PatientConsentError,
} from "src/services/patient-consent.service";
import { prisma } from "src/config/prisma";
import { AuditTrailService } from "src/services/audit-trail.service";

jest.mock("src/config/prisma", () => ({
  prisma: {
    patientConsent: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock("src/services/audit-trail.service", () => ({
  AuditTrailService: { recordSafely: jest.fn().mockResolvedValue(undefined) },
}));

const pm = prisma as unknown as {
  patientConsent: {
    create: jest.Mock;
    findFirst: jest.Mock;
    findMany: jest.Mock;
    update: jest.Mock;
  };
};

const makeConsent = (over: Record<string, unknown> = {}) => ({
  id: "consent-1",
  organisationId: "org-1",
  patientId: "pat-1",
  consentType: "SURGICAL",
  status: "ACTIVE",
  procedureDesc: "Splenectomy",
  consentedBy: "owner-1",
  consentedByName: "Jane Owner",
  consentedAt: new Date("2026-06-30T08:00:00Z"),
  expiresAt: null,
  witnessedBy: null,
  revokedAt: null,
  revokedReason: null,
  documentId: null,
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  (AuditTrailService.recordSafely as jest.Mock).mockResolvedValue(undefined);
  pm.patientConsent.findFirst.mockResolvedValue(makeConsent());
  pm.patientConsent.create.mockResolvedValue(makeConsent());
  pm.patientConsent.update.mockImplementation(
    (args: { data: Record<string, unknown> }) =>
      Promise.resolve(makeConsent({ ...args.data })),
  );
  pm.patientConsent.findMany.mockResolvedValue([makeConsent()]);
});

// ---------------------------------------------------------------------------
// grant
// ---------------------------------------------------------------------------

describe("PatientConsentService.grant", () => {
  it("creates an ACTIVE consent and emits audit", async () => {
    const result = await PatientConsentService.grant({
      organisationId: "org-1",
      patientId: "pat-1",
      consentType: "SURGICAL",
      procedureDesc: "Splenectomy",
      consentedBy: "owner-1",
      consentedByName: "Jane Owner",
    });
    expect(pm.patientConsent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "ACTIVE",
          consentType: "SURGICAL",
        }),
      }),
    );
    expect(AuditTrailService.recordSafely).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "CONSENT_GRANTED",
        actorId: "owner-1",
      }),
    );
    expect(result.status).toBe("ACTIVE");
  });

  it("supports all consent types", async () => {
    for (const consentType of ["ANESTHESIA", "DIAGNOSTIC", "DNR"] as const) {
      pm.patientConsent.create.mockResolvedValue(makeConsent({ consentType }));
      await PatientConsentService.grant({
        organisationId: "org-1",
        patientId: "pat-1",
        consentType,
      });
      expect(pm.patientConsent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ consentType }),
        }),
      );
    }
  });
});

// ---------------------------------------------------------------------------
// get / list
// ---------------------------------------------------------------------------

describe("PatientConsentService.get", () => {
  it("returns a consent by id and org", async () => {
    const result = await PatientConsentService.get("consent-1", "org-1");
    expect(result.id).toBe("consent-1");
  });

  it("404s an unknown consent", async () => {
    pm.patientConsent.findFirst.mockResolvedValue(null);
    await expect(
      PatientConsentService.get("bad", "org-1"),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("PatientConsentService.list", () => {
  it("lists consents for the org", async () => {
    const result = await PatientConsentService.list({
      organisationId: "org-1",
    });
    expect(result).toHaveLength(1);
  });

  it("filters by patientId, status, and consentType", async () => {
    await PatientConsentService.list({
      organisationId: "org-1",
      patientId: "pat-1",
      status: "ACTIVE",
      consentType: "SURGICAL",
    });
    expect(pm.patientConsent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          patientId: "pat-1",
          status: "ACTIVE",
          consentType: "SURGICAL",
        }),
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// revoke
// ---------------------------------------------------------------------------

describe("PatientConsentService.revoke", () => {
  it("revokes an ACTIVE consent and emits audit", async () => {
    await PatientConsentService.revoke(
      "consent-1",
      "org-1",
      "Owner changed mind",
      "vet-1",
    );
    expect(pm.patientConsent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "REVOKED",
          revokedReason: "Owner changed mind",
        }),
      }),
    );
    expect(AuditTrailService.recordSafely).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "CONSENT_REVOKED",
        actorId: "vet-1",
      }),
    );
  });

  it("rejects revoking an already-revoked consent", async () => {
    pm.patientConsent.findFirst.mockResolvedValue(
      makeConsent({ status: "REVOKED" }),
    );
    await expect(
      PatientConsentService.revoke("consent-1", "org-1", undefined),
    ).rejects.toMatchObject({ statusCode: 409 });
  });
});
