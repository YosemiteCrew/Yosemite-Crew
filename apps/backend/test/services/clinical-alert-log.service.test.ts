jest.mock("src/config/prisma", () => ({
  prisma: {
    clinicalAlertLog: {
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
  ClinicalAlertLogService,
  ClinicalAlertLogError,
} from "../../src/services/clinical-alert-log.service";

const mockedPrisma = prisma as jest.Mocked<typeof prisma>;

const baseAlert = {
  id: "alert-1",
  organisationId: "org-1",
  patientId: "patient-1",
  encounterId: null,
  alertType: "DRUG_INTERACTION" as const,
  severity: "WARNING" as const,
  title: "Penicillin allergy conflict",
  body: "Patient is allergic to penicillin",
  triggeredBy: "prescribe-check",
  acknowledgedAt: null,
  acknowledgedBy: null,
  acknowledgedNote: null,
  dismissed: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("ClinicalAlertLogService", () => {
  beforeEach(() => jest.clearAllMocks());

  describe("trigger", () => {
    it("creates alert and emits audit event", async () => {
      (mockedPrisma.clinicalAlertLog.create as jest.Mock).mockResolvedValue(
        baseAlert,
      );
      const result = await ClinicalAlertLogService.trigger({
        organisationId: "org-1",
        patientId: "patient-1",
        alertType: "DRUG_INTERACTION",
        title: "Penicillin allergy conflict",
      });
      expect(result.id).toBe("alert-1");
      expect(result.dismissed).toBe(false);
    });

    it("defaults severity to WARNING", async () => {
      (mockedPrisma.clinicalAlertLog.create as jest.Mock).mockResolvedValue(
        baseAlert,
      );
      await ClinicalAlertLogService.trigger({
        organisationId: "org-1",
        patientId: "patient-1",
        alertType: "CRITICAL_LAB_VALUE",
        title: "K+ critically low",
      });
      const callData = (mockedPrisma.clinicalAlertLog.create as jest.Mock).mock
        .calls[0][0].data;
      expect(callData.severity).toBe("WARNING");
    });
  });

  describe("get", () => {
    it("returns alert when found", async () => {
      (mockedPrisma.clinicalAlertLog.findFirst as jest.Mock).mockResolvedValue(
        baseAlert,
      );
      const result = await ClinicalAlertLogService.get("alert-1", "org-1");
      expect(result.alertType).toBe("DRUG_INTERACTION");
    });

    it("throws 404 when not found", async () => {
      (mockedPrisma.clinicalAlertLog.findFirst as jest.Mock).mockResolvedValue(
        null,
      );
      await expect(
        ClinicalAlertLogService.get("alert-x", "org-1"),
      ).rejects.toThrow(ClinicalAlertLogError);
    });
  });

  describe("list", () => {
    it("lists all alerts for organisation", async () => {
      (mockedPrisma.clinicalAlertLog.findMany as jest.Mock).mockResolvedValue([
        baseAlert,
      ]);
      const result = await ClinicalAlertLogService.list({
        organisationId: "org-1",
      });
      expect(result).toHaveLength(1);
    });

    it("filters dismissed=false", async () => {
      (mockedPrisma.clinicalAlertLog.findMany as jest.Mock).mockResolvedValue(
        [],
      );
      await ClinicalAlertLogService.list({
        organisationId: "org-1",
        dismissed: false,
      });
      const where = (mockedPrisma.clinicalAlertLog.findMany as jest.Mock).mock
        .calls[0][0].where;
      expect(where.dismissed).toBe(false);
    });

    it("filters by severity and alertType", async () => {
      (mockedPrisma.clinicalAlertLog.findMany as jest.Mock).mockResolvedValue(
        [],
      );
      await ClinicalAlertLogService.list({
        organisationId: "org-1",
        severity: "CRITICAL",
        alertType: "DRUG_INTERACTION",
      });
      const where = (mockedPrisma.clinicalAlertLog.findMany as jest.Mock).mock
        .calls[0][0].where;
      expect(where.severity).toBe("CRITICAL");
      expect(where.alertType).toBe("DRUG_INTERACTION");
    });
  });

  describe("acknowledge", () => {
    it("acknowledges an unacknowledged alert", async () => {
      (mockedPrisma.clinicalAlertLog.findFirst as jest.Mock).mockResolvedValue(
        baseAlert,
      );
      const acknowledged = {
        ...baseAlert,
        acknowledgedAt: new Date(),
        acknowledgedBy: "dr-jones",
      };
      (mockedPrisma.clinicalAlertLog.update as jest.Mock).mockResolvedValue(
        acknowledged,
      );
      const result = await ClinicalAlertLogService.acknowledge(
        "alert-1",
        "org-1",
        "dr-jones",
        "Reviewed",
      );
      expect(result.acknowledgedBy).toBe("dr-jones");
    });

    it("throws 409 when already acknowledged", async () => {
      (mockedPrisma.clinicalAlertLog.findFirst as jest.Mock).mockResolvedValue({
        ...baseAlert,
        acknowledgedAt: new Date(),
      });
      await expect(
        ClinicalAlertLogService.acknowledge("alert-1", "org-1", "dr-jones"),
      ).rejects.toThrow(ClinicalAlertLogError);
    });

    it("throws 404 when not found", async () => {
      (mockedPrisma.clinicalAlertLog.findFirst as jest.Mock).mockResolvedValue(
        null,
      );
      await expect(
        ClinicalAlertLogService.acknowledge("alert-x", "org-1", "dr-jones"),
      ).rejects.toThrow(ClinicalAlertLogError);
    });
  });

  describe("dismiss", () => {
    it("dismisses an active alert", async () => {
      (mockedPrisma.clinicalAlertLog.findFirst as jest.Mock).mockResolvedValue(
        baseAlert,
      );
      const dismissed = { ...baseAlert, dismissed: true };
      (mockedPrisma.clinicalAlertLog.update as jest.Mock).mockResolvedValue(
        dismissed,
      );
      const result = await ClinicalAlertLogService.dismiss("alert-1", "org-1");
      expect(result.dismissed).toBe(true);
    });

    it("throws 409 when already dismissed", async () => {
      (mockedPrisma.clinicalAlertLog.findFirst as jest.Mock).mockResolvedValue({
        ...baseAlert,
        dismissed: true,
      });
      await expect(
        ClinicalAlertLogService.dismiss("alert-1", "org-1"),
      ).rejects.toThrow(ClinicalAlertLogError);
    });
  });
});
