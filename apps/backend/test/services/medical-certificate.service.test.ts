jest.mock("src/config/prisma", () => ({
  prisma: {
    medicalCertificate: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
  },
}));
jest.mock("../../src/services/audit-trail.service", () => ({
  AuditTrailService: { recordSafely: jest.fn() },
}));

import { prisma } from "src/config/prisma";
import {
  MedicalCertificateService,
  MedicalCertificateError,
} from "../../src/services/medical-certificate.service";

const mockedPrisma = prisma as jest.Mocked<typeof prisma>;

const baseCert = {
  id: "cert-1",
  organisationId: "org-1",
  patientId: "patient-1",
  clientId: "client-1",
  encounterId: null,
  appointmentId: null,
  certificateType: "HEALTH_CERTIFICATE" as const,
  status: "DRAFT" as const,
  issueNumber: null,
  issuedAt: null,
  expiresAt: null,
  issuedBy: null,
  validForTravel: false,
  destinationCountry: null,
  clinicalFindings: null,
  restrictions: null,
  notes: null,
  revokedAt: null,
  revokedReason: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("MedicalCertificateService", () => {
  beforeEach(() => jest.clearAllMocks());

  describe("create", () => {
    it("creates a certificate in DRAFT status", async () => {
      (mockedPrisma.medicalCertificate.create as jest.Mock).mockResolvedValue(
        baseCert,
      );
      const result = await MedicalCertificateService.create({
        organisationId: "org-1",
        patientId: "patient-1",
        clientId: "client-1",
        certificateType: "HEALTH_CERTIFICATE",
      });
      expect(result.status).toBe("DRAFT");
      const data = (mockedPrisma.medicalCertificate.create as jest.Mock).mock
        .calls[0][0].data;
      expect(data.status).toBe("DRAFT");
    });
  });

  describe("get", () => {
    it("returns certificate when found", async () => {
      (
        mockedPrisma.medicalCertificate.findFirst as jest.Mock
      ).mockResolvedValue(baseCert);
      const result = await MedicalCertificateService.get("cert-1", "org-1");
      expect(result.id).toBe("cert-1");
    });

    it("throws 404 when not found", async () => {
      (
        mockedPrisma.medicalCertificate.findFirst as jest.Mock
      ).mockResolvedValue(null);
      await expect(MedicalCertificateService.get("x", "org-1")).rejects.toThrow(
        MedicalCertificateError,
      );
    });
  });

  describe("list", () => {
    it("lists certificates for organisation", async () => {
      (mockedPrisma.medicalCertificate.findMany as jest.Mock).mockResolvedValue(
        [baseCert],
      );
      const result = await MedicalCertificateService.list({
        organisationId: "org-1",
      });
      expect(result).toHaveLength(1);
    });

    it("filters by status and certificateType", async () => {
      (mockedPrisma.medicalCertificate.findMany as jest.Mock).mockResolvedValue(
        [],
      );
      await MedicalCertificateService.list({
        organisationId: "org-1",
        status: "DRAFT",
        certificateType: "FIT_FOR_TRAVEL",
      });
      const where = (mockedPrisma.medicalCertificate.findMany as jest.Mock).mock
        .calls[0][0].where;
      expect(where.status).toBe("DRAFT");
      expect(where.certificateType).toBe("FIT_FOR_TRAVEL");
    });
  });

  describe("issue", () => {
    it("transitions DRAFT to ISSUED and assigns issueNumber", async () => {
      (
        mockedPrisma.medicalCertificate.findFirst as jest.Mock
      ).mockResolvedValue(baseCert);
      const issued = {
        ...baseCert,
        status: "ISSUED" as const,
        issueNumber: "CERT-ORG-1-ABC",
        issuedAt: new Date(),
        issuedBy: "vet-1",
      };
      (mockedPrisma.medicalCertificate.update as jest.Mock).mockResolvedValue(
        issued,
      );
      const result = await MedicalCertificateService.issue("cert-1", "org-1", {
        issuedBy: "vet-1",
      });
      expect(result.status).toBe("ISSUED");
    });

    it("throws 409 when already issued", async () => {
      (
        mockedPrisma.medicalCertificate.findFirst as jest.Mock
      ).mockResolvedValue({
        ...baseCert,
        status: "ISSUED",
      });
      await expect(
        MedicalCertificateService.issue("cert-1", "org-1", {
          issuedBy: "vet-1",
        }),
      ).rejects.toThrow(MedicalCertificateError);
    });

    it("throws 409 for terminal REVOKED", async () => {
      (
        mockedPrisma.medicalCertificate.findFirst as jest.Mock
      ).mockResolvedValue({
        ...baseCert,
        status: "REVOKED",
      });
      await expect(
        MedicalCertificateService.issue("cert-1", "org-1", {
          issuedBy: "vet-1",
        }),
      ).rejects.toThrow(MedicalCertificateError);
    });
  });

  describe("revoke", () => {
    it("revokes an issued certificate", async () => {
      (
        mockedPrisma.medicalCertificate.findFirst as jest.Mock
      ).mockResolvedValue({
        ...baseCert,
        status: "ISSUED",
        issueNumber: "CERT-ORG-1-XYZ",
      });
      const revoked = {
        ...baseCert,
        status: "REVOKED" as const,
        revokedAt: new Date(),
      };
      (mockedPrisma.medicalCertificate.update as jest.Mock).mockResolvedValue(
        revoked,
      );
      const result = await MedicalCertificateService.revoke(
        "cert-1",
        "org-1",
        "admin-1",
        "Incorrect information",
      );
      expect(result.status).toBe("REVOKED");
    });

    it("throws 409 when already revoked", async () => {
      (
        mockedPrisma.medicalCertificate.findFirst as jest.Mock
      ).mockResolvedValue({
        ...baseCert,
        status: "REVOKED",
      });
      await expect(
        MedicalCertificateService.revoke("cert-1", "org-1", "admin-1"),
      ).rejects.toThrow(MedicalCertificateError);
    });
  });

  describe("expire", () => {
    it("marks an issued certificate as expired", async () => {
      (
        mockedPrisma.medicalCertificate.findFirst as jest.Mock
      ).mockResolvedValue({
        ...baseCert,
        status: "ISSUED",
      });
      const expired = { ...baseCert, status: "EXPIRED" as const };
      (mockedPrisma.medicalCertificate.update as jest.Mock).mockResolvedValue(
        expired,
      );
      const result = await MedicalCertificateService.expire("cert-1", "org-1");
      expect(result.status).toBe("EXPIRED");
    });

    it("throws 409 for terminal REVOKED", async () => {
      (
        mockedPrisma.medicalCertificate.findFirst as jest.Mock
      ).mockResolvedValue({
        ...baseCert,
        status: "REVOKED",
      });
      await expect(
        MedicalCertificateService.expire("cert-1", "org-1"),
      ).rejects.toThrow(MedicalCertificateError);
    });
  });
});
