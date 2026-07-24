import {
  AuditTrailService,
  AuditTrailServiceError,
} from "../../src/services/audit-trail.service";
import logger from "../../src/utils/logger";
import { prisma } from "src/config/prisma";

// --- Mocks ---
jest.mock("../../src/utils/logger");

jest.mock("src/config/prisma", () => ({
  prisma: {
    auditTrail: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    parent: {
      findFirst: jest.fn(),
    },
    user: {
      findFirst: jest.fn(),
    },
  },
}));

describe("AuditTrailService", () => {
  const validRecordInput: any = {
    organisationId: "org-1",
    patientId: "comp-1",
    eventType: "APPOINTMENT_BOOKED",
    actorType: "PARENT",
    actorId: "parent-1",
    entityType: "APPOINTMENT",
    entityId: "appt-1",
  };

  beforeEach(() => {
    jest.clearAllMocks();

    (prisma.auditTrail.create as jest.Mock).mockResolvedValue({
      id: "audit_1",
      ...validRecordInput,
    });
    (prisma.auditTrail.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.parent.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.user.findFirst as jest.Mock).mockResolvedValue(null);
  });

  describe("Validation (ensureSafeString)", () => {
    it("should throw if required string is empty", async () => {
      await expect(
        AuditTrailService.record({ ...validRecordInput, organisationId: "" }),
      ).rejects.toThrow("organisationId is required");

      await expect(
        AuditTrailService.record({
          ...validRecordInput,
          organisationId: "   ",
        }),
      ).rejects.toThrow("organisationId is required");
    });

    it("should throw if string contains unsafe characters ($)", async () => {
      await expect(
        AuditTrailService.record({
          ...validRecordInput,
          organisationId: "bad$id",
        }),
      ).rejects.toThrow("Invalid organisationId");
    });

    it("should throw if string contains unsafe characters (.)", async () => {
      await expect(
        AuditTrailService.record({
          ...validRecordInput,
          organisationId: "bad.id",
        }),
      ).rejects.toThrow("Invalid organisationId");
    });
  });

  describe("record", () => {
    it("should create audit record and return the prisma row", async () => {
      const res = await AuditTrailService.record(validRecordInput);

      expect(res).toEqual(
        expect.objectContaining({ id: "audit_1", organisationId: "org-1" }),
      );
      expect(prisma.auditTrail.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          organisationId: "org-1",
          patientId: "comp-1",
          eventType: "APPOINTMENT_BOOKED",
        }),
      });
    });

    it("should create audit record with direct actor name", async () => {
      const input = { ...validRecordInput, actorName: "John Doe" };
      await AuditTrailService.record(input);

      expect(prisma.parent.findFirst).not.toHaveBeenCalled();
      expect(prisma.auditTrail.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ actorName: "John Doe" }),
      });
    });

    it("should resolve actor name for PARENT", async () => {
      (prisma.parent.findFirst as jest.Mock).mockResolvedValueOnce({
        firstName: "Jane",
        lastName: "Doe",
      });

      await AuditTrailService.record({
        ...validRecordInput,
        actorName: null,
        actorType: "PARENT",
        actorId: "p1",
      });

      expect(prisma.parent.findFirst).toHaveBeenCalledWith({
        where: { id: "p1" },
        select: { firstName: true, lastName: true },
      });
      expect(prisma.auditTrail.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ actorName: "Jane Doe" }),
      });
    });

    it("should resolve actor name for PMS_USER", async () => {
      (prisma.user.findFirst as jest.Mock).mockResolvedValueOnce({
        firstName: "Admin",
        lastName: "User",
      });

      await AuditTrailService.record({
        ...validRecordInput,
        actorName: undefined,
        actorType: "PMS_USER",
        actorId: "u1",
      });

      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: { userId: "u1" },
        select: { firstName: true, lastName: true },
      });
      expect(prisma.auditTrail.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ actorName: "Admin User" }),
      });
    });

    it("should handle missing actor profile gracefully (null name)", async () => {
      (prisma.parent.findFirst as jest.Mock).mockResolvedValueOnce(null);

      await AuditTrailService.record({
        ...validRecordInput,
        actorName: undefined,
        actorType: "PARENT",
        actorId: "p1",
      });

      expect(prisma.auditTrail.create).toHaveBeenCalledWith({
        data: expect.not.objectContaining({ actorName: expect.anything() }),
      });
    });

    it("should skip resolution if actorType/Id missing", async () => {
      const input = { ...validRecordInput, actorType: undefined };
      await AuditTrailService.record(input);

      expect(prisma.parent.findFirst).not.toHaveBeenCalled();
      expect(prisma.user.findFirst).not.toHaveBeenCalled();
    });

    it("should use provided occurredAt or default to now", async () => {
      const date = new Date("2023-01-01");
      await AuditTrailService.record({ ...validRecordInput, occurredAt: date });
      expect(prisma.auditTrail.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ occurredAt: date }),
      });

      await AuditTrailService.record({
        ...validRecordInput,
        occurredAt: undefined,
      });
      expect(prisma.auditTrail.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ occurredAt: expect.any(Date) }),
      });
    });
  });

  describe("recordSafely", () => {
    it("should succeed silently", async () => {
      await AuditTrailService.recordSafely(validRecordInput);
      expect(prisma.auditTrail.create).toHaveBeenCalled();
    });

    it("should catch and log error on failure", async () => {
      (prisma.auditTrail.create as jest.Mock).mockRejectedValue(
        new Error("DB Error"),
      );

      await AuditTrailService.recordSafely(validRecordInput);

      expect(logger.warn).toHaveBeenCalledWith(
        "Audit trail record failed",
        expect.any(Error),
      );
    });
  });

  describe("listForOrganisation", () => {
    it("should map filters and return cursor", async () => {
      const occurredAt = new Date();
      (prisma.auditTrail.findMany as jest.Mock).mockResolvedValueOnce([
        { id: "a1", occurredAt },
      ]);

      const res = await AuditTrailService.listForOrganisation({
        organisationId: "org-1",
        patientId: "comp-1",
        eventTypes: ["APPOINTMENT_BOOKED"] as any,
        entityTypes: ["APPOINTMENT"] as any,
        limit: 10,
        before: occurredAt,
      });

      expect(prisma.auditTrail.findMany).toHaveBeenCalledWith({
        where: {
          organisationId: "org-1",
          patientId: "comp-1",
          eventType: { in: ["APPOINTMENT_BOOKED"] },
          entityType: { in: ["APPOINTMENT"] },
          occurredAt: { lt: occurredAt },
        },
        orderBy: { occurredAt: "desc" },
        take: 10,
      });
      expect(res.entries).toHaveLength(1);
      expect(res.nextCursor).toBe(occurredAt.toISOString());
    });

    it("should return null cursor when empty", async () => {
      (prisma.auditTrail.findMany as jest.Mock).mockResolvedValueOnce([]);
      const res = await AuditTrailService.listForOrganisation({
        organisationId: "org-1",
      });
      expect(res.nextCursor).toBeNull();
    });

    it("should clamp limit", async () => {
      await AuditTrailService.listForOrganisation({
        organisationId: "org-1",
        limit: 500,
      });
      expect(prisma.auditTrail.findMany).toHaveBeenLastCalledWith(
        expect.objectContaining({ take: 200 }), // Max 200
      );

      await AuditTrailService.listForOrganisation({
        organisationId: "org-1",
        limit: -5,
      });
      expect(prisma.auditTrail.findMany).toHaveBeenLastCalledWith(
        expect.objectContaining({ take: 1 }), // Min 1
      );
    });
  });

  describe("listForAppointment", () => {
    it("should build prisma query and return cursor", async () => {
      const occurredAt = new Date();
      (prisma.auditTrail.findMany as jest.Mock).mockResolvedValueOnce([
        { id: "a1", occurredAt },
      ]);

      const res = await AuditTrailService.listForAppointment({
        organisationId: "org-1",
        appointmentId: "appt-1",
        before: occurredAt,
        limit: 5,
      });

      expect(prisma.auditTrail.findMany).toHaveBeenCalledWith({
        where: {
          organisationId: "org-1",
          OR: [
            { entityType: "APPOINTMENT", entityId: "appt-1" },
            {
              metadata: { path: ["appointmentId"], equals: "appt-1" },
            },
          ],
          occurredAt: { lt: occurredAt },
        },
        orderBy: { occurredAt: "desc" },
        take: 5,
      });
      expect(res.nextCursor).toBe(occurredAt.toISOString());
    });

    it("should handle null cursor for empty results", async () => {
      (prisma.auditTrail.findMany as jest.Mock).mockResolvedValueOnce([]);
      const res = await AuditTrailService.listForAppointment({
        organisationId: "org-1",
        appointmentId: "a1",
      });
      expect(res.nextCursor).toBeNull();
    });
  });

  describe("Error Class", () => {
    it("should instantiate AuditTrailServiceError correctly", () => {
      const err = new AuditTrailServiceError("Test Error", 418);
      expect(err).toBeInstanceOf(Error);
      expect(err.name).toBe("AuditTrailServiceError");
      expect(err.statusCode).toBe(418);
      expect(err.message).toBe("Test Error");
    });
  });

  describe("recordAlertMutation", () => {
    let recordSafelySpy: jest.SpyInstance;

    beforeEach(() => {
      recordSafelySpy = jest
        .spyOn(AuditTrailService, "recordSafely")
        .mockResolvedValue(undefined);
    });

    afterEach(() => {
      recordSafelySpy.mockRestore();
    });

    it("records CREATED when alerts go from empty to present", async () => {
      await AuditTrailService.recordAlertMutation({
        entity: "COMPANION",
        organisationId: "org-1",
        patientId: "comp-1",
        actorId: "user-1",
        previousAlerts: [],
        nextAlerts: [{ text: "Diabetic" }],
      });
      expect(recordSafelySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          organisationId: "org-1",
          patientId: "comp-1",
          eventType: "COMPANION_ALERT_CREATED",
          entityType: "COMPANION",
          actorType: "PMS_USER",
          actorId: "user-1",
        }),
      );
    });

    it("records UPDATED when the alert set changes", async () => {
      await AuditTrailService.recordAlertMutation({
        entity: "PARENT",
        organisationId: "org-1",
        patientId: "parent-1",
        previousAlerts: [{ text: "A" }],
        nextAlerts: [{ text: "B" }],
      });
      expect(recordSafelySpy).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: "PARENT_ALERT_UPDATED" }),
      );
    });

    it("records DELETED when alerts are cleared", async () => {
      await AuditTrailService.recordAlertMutation({
        entity: "PARENT",
        organisationId: "org-1",
        patientId: "parent-1",
        previousAlerts: [{ text: "A" }],
        nextAlerts: [],
      });
      expect(recordSafelySpy).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: "PARENT_ALERT_DELETED" }),
      );
    });

    it("no-ops when the alert set is unchanged", async () => {
      await AuditTrailService.recordAlertMutation({
        entity: "COMPANION",
        organisationId: "org-1",
        patientId: "comp-1",
        previousAlerts: [{ text: "A" }],
        nextAlerts: [{ text: "A" }],
      });
      expect(recordSafelySpy).not.toHaveBeenCalled();
    });

    it("no-ops when no organisation context is available", async () => {
      await AuditTrailService.recordAlertMutation({
        entity: "COMPANION",
        patientId: "comp-1",
        previousAlerts: [],
        nextAlerts: [{ text: "A" }],
      });
      expect(recordSafelySpy).not.toHaveBeenCalled();
    });
  });
});
