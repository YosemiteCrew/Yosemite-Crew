const prismaMock = {
  organization: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  organizationBilling: {
    findUnique: jest.fn(),
  },
};

jest.mock("@yosemite-crew/database", () => ({
  prisma: prismaMock,
  Prisma: {},
}));

import {
  hasComplianceCertificate,
  computeIsVerified,
  recomputeOrganizationVerification,
} from "src/services/organization-verification.service";

type Org = {
  verificationOverride: boolean | null;
  healthAndSafetyCertNo: string | null;
  animalWelfareComplianceCertNo: string | null;
  fireAndEmergencyCertNo: string | null;
};

const makeOrg = (overrides: Partial<Org> = {}): Org => ({
  verificationOverride: null,
  healthAndSafetyCertNo: null,
  animalWelfareComplianceCertNo: null,
  fireAndEmergencyCertNo: null,
  ...overrides,
});

describe("organization-verification.service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("hasComplianceCertificate", () => {
    it("is true when a health & safety certificate is present", () => {
      expect(
        hasComplianceCertificate(makeOrg({ healthAndSafetyCertNo: "HS-1" })),
      ).toBe(true);
    });

    it("is true when an animal welfare certificate is present", () => {
      expect(
        hasComplianceCertificate(
          makeOrg({ animalWelfareComplianceCertNo: "AW-1" }),
        ),
      ).toBe(true);
    });

    it("is true when a fire & emergency certificate is present", () => {
      expect(
        hasComplianceCertificate(makeOrg({ fireAndEmergencyCertNo: "FE-1" })),
      ).toBe(true);
    });

    it("is false when no certificate is present", () => {
      expect(hasComplianceCertificate(makeOrg())).toBe(false);
    });
  });

  describe("computeIsVerified", () => {
    it("returns the override (true) even without certs or payments", () => {
      expect(
        computeIsVerified(makeOrg({ verificationOverride: true }), false),
      ).toBe(true);
    });

    it("returns the override (false) even with certs and payments", () => {
      expect(
        computeIsVerified(
          makeOrg({
            verificationOverride: false,
            healthAndSafetyCertNo: "HS-1",
          }),
          true,
        ),
      ).toBe(false);
    });

    it("is true when payments are accepted and a cert exists (override null)", () => {
      expect(
        computeIsVerified(makeOrg({ healthAndSafetyCertNo: "HS-1" }), true),
      ).toBe(true);
    });

    it("is false when payments are accepted but no cert exists", () => {
      expect(computeIsVerified(makeOrg(), true)).toBe(false);
    });

    it("is false when a cert exists but payments are not accepted", () => {
      expect(
        computeIsVerified(makeOrg({ healthAndSafetyCertNo: "HS-1" }), false),
      ).toBe(false);
    });

    it("is false when neither payments nor certs are present", () => {
      expect(computeIsVerified(makeOrg(), false)).toBe(false);
    });
  });

  describe("recomputeOrganizationVerification", () => {
    it("returns null and writes nothing when the organisation does not exist", async () => {
      prismaMock.organization.findUnique.mockResolvedValueOnce(null);

      const result = await recomputeOrganizationVerification("missing-org");

      expect(result).toBeNull();
      expect(prismaMock.organizationBilling.findUnique).not.toHaveBeenCalled();
      expect(prismaMock.organization.update).not.toHaveBeenCalled();
    });

    it("treats missing billing as canAcceptPayments=false", async () => {
      prismaMock.organization.findUnique.mockResolvedValueOnce(
        makeOrg({ healthAndSafetyCertNo: "HS-1" }),
      );
      prismaMock.organizationBilling.findUnique.mockResolvedValueOnce(null);
      prismaMock.organization.update.mockResolvedValueOnce({});

      const result = await recomputeOrganizationVerification("org-1");

      expect(result).toBe(false);
      expect(prismaMock.organization.update).toHaveBeenCalledWith({
        where: { id: "org-1" },
        data: { isVerified: false },
      });
    });

    it("honours a manual override regardless of billing/certs", async () => {
      prismaMock.organization.findUnique.mockResolvedValueOnce(
        makeOrg({ verificationOverride: true }),
      );
      prismaMock.organizationBilling.findUnique.mockResolvedValueOnce({
        canAcceptPayments: false,
      });
      prismaMock.organization.update.mockResolvedValueOnce({});

      const result = await recomputeOrganizationVerification("org-1");

      expect(result).toBe(true);
      expect(prismaMock.organization.update).toHaveBeenCalledWith({
        where: { id: "org-1" },
        data: { isVerified: true },
      });
    });

    it("computes verified=true from accepted payments plus a certificate", async () => {
      prismaMock.organization.findUnique.mockResolvedValueOnce(
        makeOrg({ fireAndEmergencyCertNo: "FE-1" }),
      );
      prismaMock.organizationBilling.findUnique.mockResolvedValueOnce({
        canAcceptPayments: true,
      });
      prismaMock.organization.update.mockResolvedValueOnce({});

      const result = await recomputeOrganizationVerification("org-1");

      expect(result).toBe(true);
      expect(prismaMock.organization.findUnique).toHaveBeenCalledWith({
        where: { id: "org-1" },
        select: {
          verificationOverride: true,
          healthAndSafetyCertNo: true,
          animalWelfareComplianceCertNo: true,
          fireAndEmergencyCertNo: true,
        },
      });
      expect(prismaMock.organizationBilling.findUnique).toHaveBeenCalledWith({
        where: { orgId: "org-1" },
        select: { canAcceptPayments: true },
      });
      expect(prismaMock.organization.update).toHaveBeenCalledWith({
        where: { id: "org-1" },
        data: { isVerified: true },
      });
    });
  });
});
