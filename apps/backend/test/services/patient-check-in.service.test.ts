jest.mock("src/config/prisma", () => ({
  prisma: {
    patientCheckIn: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    organisationRoom: {
      findFirst: jest.fn(),
    },
  },
}));
jest.mock("../../src/services/audit-trail.service", () => ({
  AuditTrailService: { recordSafely: jest.fn() },
}));
jest.mock("../../src/services/appointment.prisma.service", () => {
  class AppointmentPrismaServiceError extends Error {
    constructor(
      message: string,
      public readonly statusCode: number,
    ) {
      super(message);
      this.name = "AppointmentPrismaServiceError";
    }
  }
  return {
    AppointmentPrismaService: {
      checkInAppointment: jest.fn(),
      updateAppointmentRoom: jest.fn(),
      completeAppointment: jest.fn(),
      cancelAppointment: jest.fn(),
      markAppointmentNoShow: jest.fn(),
    },
    AppointmentPrismaServiceError,
  };
});

import { prisma } from "src/config/prisma";
import {
  PatientCheckInService,
  PatientCheckInError,
} from "../../src/services/patient-check-in.service";
import {
  AppointmentPrismaService,
  AppointmentPrismaServiceError,
} from "../../src/services/appointment.prisma.service";

const mockedPrisma = prisma as jest.Mocked<typeof prisma>;
const mockedCheckInAppointment =
  AppointmentPrismaService.checkInAppointment as jest.Mock;
const mockedUpdateAppointmentRoom =
  AppointmentPrismaService.updateAppointmentRoom as jest.Mock;
const mockedCompleteAppointment =
  AppointmentPrismaService.completeAppointment as jest.Mock;
const mockedCancelAppointment =
  AppointmentPrismaService.cancelAppointment as jest.Mock;
const mockedMarkAppointmentNoShow =
  AppointmentPrismaService.markAppointmentNoShow as jest.Mock;

const arrivedAt = new Date("2026-06-30T09:00:00Z");
const baseCheckIn = {
  id: "checkin-1",
  organisationId: "org-1",
  patientId: "patient-1",
  clientId: "client-1",
  appointmentId: null,
  arrivedAt,
  triagePriority: "NON_URGENT" as const,
  triageNote: null,
  assignedRoomId: null,
  checkedInBy: "receptionist-1",
  waitStartedAt: new Date("2026-06-30T09:00:00Z"),
  seenAt: null,
  waitMinutes: null,
  status: "WAITING" as const,
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("PatientCheckInService", () => {
  beforeEach(() => jest.clearAllMocks());

  describe("create", () => {
    it("creates a check-in in WAITING status with waitStartedAt", async () => {
      (mockedPrisma.patientCheckIn.create as jest.Mock).mockResolvedValue(
        baseCheckIn,
      );
      const result = await PatientCheckInService.create({
        organisationId: "org-1",
        patientId: "patient-1",
        clientId: "client-1",
        arrivedAt,
        checkedInBy: "receptionist-1",
      });
      expect(result.status).toBe("WAITING");
      const callData = (mockedPrisma.patientCheckIn.create as jest.Mock).mock
        .calls[0][0].data;
      expect(callData.status).toBe("WAITING");
      expect(callData.waitStartedAt).toBeInstanceOf(Date);
    });

    it("defaults triagePriority to NON_URGENT", async () => {
      (mockedPrisma.patientCheckIn.create as jest.Mock).mockResolvedValue(
        baseCheckIn,
      );
      await PatientCheckInService.create({
        organisationId: "org-1",
        patientId: "patient-1",
        clientId: "client-1",
        arrivedAt,
      });
      const callData = (mockedPrisma.patientCheckIn.create as jest.Mock).mock
        .calls[0][0].data;
      expect(callData.triagePriority).toBe("NON_URGENT");
    });

    it("checks the linked appointment in so the Board reflects the arrival", async () => {
      (mockedPrisma.patientCheckIn.create as jest.Mock).mockResolvedValue({
        ...baseCheckIn,
        appointmentId: "appt-1",
      });
      mockedCheckInAppointment.mockResolvedValue(undefined);
      await PatientCheckInService.create({
        organisationId: "org-1",
        patientId: "patient-1",
        clientId: "client-1",
        appointmentId: "appt-1",
        arrivedAt,
      });
      expect(mockedCheckInAppointment).toHaveBeenCalledWith("appt-1", "org-1");
    });

    it("does not touch the appointment when the check-in is not linked to one", async () => {
      (mockedPrisma.patientCheckIn.create as jest.Mock).mockResolvedValue(
        baseCheckIn,
      );
      await PatientCheckInService.create({
        organisationId: "org-1",
        patientId: "patient-1",
        clientId: "client-1",
        arrivedAt,
      });
      expect(mockedCheckInAppointment).not.toHaveBeenCalled();
    });

    it("still creates the check-in when the appointment cannot be transitioned (e.g. already CHECKED_IN)", async () => {
      (mockedPrisma.patientCheckIn.create as jest.Mock).mockResolvedValue({
        ...baseCheckIn,
        appointmentId: "appt-1",
      });
      mockedCheckInAppointment.mockRejectedValue(
        new AppointmentPrismaServiceError(
          "Appointment cannot transition from COMPLETED to CHECKED_IN in checkInAppointment.",
          409,
        ),
      );
      const result = await PatientCheckInService.create({
        organisationId: "org-1",
        patientId: "patient-1",
        clientId: "client-1",
        appointmentId: "appt-1",
        arrivedAt,
      });
      expect(result.status).toBe("WAITING");
    });

    it("still throws an unexpected non-appointment error rather than swallowing it", async () => {
      (mockedPrisma.patientCheckIn.create as jest.Mock).mockResolvedValue({
        ...baseCheckIn,
        appointmentId: "appt-1",
      });
      mockedCheckInAppointment.mockRejectedValue(new Error("db down"));
      await expect(
        PatientCheckInService.create({
          organisationId: "org-1",
          patientId: "patient-1",
          clientId: "client-1",
          appointmentId: "appt-1",
          arrivedAt,
        }),
      ).rejects.toThrow("db down");
    });
  });

  describe("get", () => {
    it("returns check-in when found", async () => {
      (mockedPrisma.patientCheckIn.findFirst as jest.Mock).mockResolvedValue(
        baseCheckIn,
      );
      const result = await PatientCheckInService.get("checkin-1", "org-1");
      expect(result.id).toBe("checkin-1");
    });

    it("throws 404 when not found", async () => {
      (mockedPrisma.patientCheckIn.findFirst as jest.Mock).mockResolvedValue(
        null,
      );
      await expect(
        PatientCheckInService.get("checkin-x", "org-1"),
      ).rejects.toThrow(PatientCheckInError);
    });
  });

  describe("list", () => {
    it("lists all check-ins for organisation", async () => {
      (mockedPrisma.patientCheckIn.findMany as jest.Mock).mockResolvedValue([
        baseCheckIn,
      ]);
      const result = await PatientCheckInService.list({
        organisationId: "org-1",
      });
      expect(result).toHaveLength(1);
    });

    it("filters by status", async () => {
      (mockedPrisma.patientCheckIn.findMany as jest.Mock).mockResolvedValue([]);
      await PatientCheckInService.list({
        organisationId: "org-1",
        status: "WAITING",
      });
      const where = (mockedPrisma.patientCheckIn.findMany as jest.Mock).mock
        .calls[0][0].where;
      expect(where.status).toBe("WAITING");
    });

    it("applies date filter as date range", async () => {
      (mockedPrisma.patientCheckIn.findMany as jest.Mock).mockResolvedValue([]);
      await PatientCheckInService.list({
        organisationId: "org-1",
        date: new Date("2026-06-30"),
      });
      const where = (mockedPrisma.patientCheckIn.findMany as jest.Mock).mock
        .calls[0][0].where;
      expect(where.arrivedAt).toBeDefined();
    });
  });

  describe("markSeen", () => {
    it("transitions to IN_CONSULTATION and computes waitMinutes", async () => {
      const waitStartedAt = new Date(Date.now() - 20 * 60 * 1000);
      (mockedPrisma.patientCheckIn.findFirst as jest.Mock).mockResolvedValue({
        ...baseCheckIn,
        waitStartedAt,
      });
      const seen = {
        ...baseCheckIn,
        status: "IN_CONSULTATION" as const,
        seenAt: new Date(),
        waitMinutes: 20,
      };
      (mockedPrisma.patientCheckIn.update as jest.Mock).mockResolvedValue(seen);
      const result = await PatientCheckInService.markSeen("checkin-1", "org-1");
      expect(result.status).toBe("IN_CONSULTATION");
    });

    it("throws 409 for terminal COMPLETED status", async () => {
      (mockedPrisma.patientCheckIn.findFirst as jest.Mock).mockResolvedValue({
        ...baseCheckIn,
        status: "COMPLETED",
      });
      await expect(
        PatientCheckInService.markSeen("checkin-1", "org-1"),
      ).rejects.toThrow(PatientCheckInError);
    });
  });

  describe("complete", () => {
    it("completes a WAITING check-in", async () => {
      (mockedPrisma.patientCheckIn.findFirst as jest.Mock).mockResolvedValue(
        baseCheckIn,
      );
      const completed = { ...baseCheckIn, status: "COMPLETED" as const };
      (mockedPrisma.patientCheckIn.update as jest.Mock).mockResolvedValue(
        completed,
      );
      const result = await PatientCheckInService.complete("checkin-1", "org-1");
      expect(result.status).toBe("COMPLETED");
    });

    it("throws 409 if already completed", async () => {
      (mockedPrisma.patientCheckIn.findFirst as jest.Mock).mockResolvedValue({
        ...baseCheckIn,
        status: "COMPLETED",
      });
      await expect(
        PatientCheckInService.complete("checkin-1", "org-1"),
      ).rejects.toThrow(PatientCheckInError);
    });

    it("does not touch the appointment when the check-in is not linked to one", async () => {
      (mockedPrisma.patientCheckIn.findFirst as jest.Mock).mockResolvedValue(
        baseCheckIn,
      );
      (mockedPrisma.patientCheckIn.update as jest.Mock).mockResolvedValue({
        ...baseCheckIn,
        status: "COMPLETED",
      });
      await PatientCheckInService.complete("checkin-1", "org-1");
      expect(mockedCompleteAppointment).not.toHaveBeenCalled();
    });

    it("completes the linked appointment so the Calendar reflects the visit closing", async () => {
      (mockedPrisma.patientCheckIn.findFirst as jest.Mock).mockResolvedValue({
        ...baseCheckIn,
        appointmentId: "appt-1",
      });
      (mockedPrisma.patientCheckIn.update as jest.Mock).mockResolvedValue({
        ...baseCheckIn,
        appointmentId: "appt-1",
        status: "COMPLETED",
      });
      mockedCompleteAppointment.mockResolvedValue(undefined);

      await PatientCheckInService.complete("checkin-1", "org-1");

      expect(mockedCompleteAppointment).toHaveBeenCalledWith("appt-1", "org-1");
    });

    it("still completes the check-in when the appointment cannot be transitioned", async () => {
      (mockedPrisma.patientCheckIn.findFirst as jest.Mock).mockResolvedValue({
        ...baseCheckIn,
        appointmentId: "appt-1",
      });
      (mockedPrisma.patientCheckIn.update as jest.Mock).mockResolvedValue({
        ...baseCheckIn,
        appointmentId: "appt-1",
        status: "COMPLETED",
      });
      mockedCompleteAppointment.mockRejectedValue(
        new AppointmentPrismaServiceError(
          "Appointment cannot transition from REQUESTED to COMPLETED in completeAppointment.",
          409,
        ),
      );

      const result = await PatientCheckInService.complete("checkin-1", "org-1");

      expect(result.status).toBe("COMPLETED");
    });

    it("still throws an unexpected non-appointment error rather than swallowing it", async () => {
      (mockedPrisma.patientCheckIn.findFirst as jest.Mock).mockResolvedValue({
        ...baseCheckIn,
        appointmentId: "appt-1",
      });
      (mockedPrisma.patientCheckIn.update as jest.Mock).mockResolvedValue({
        ...baseCheckIn,
        appointmentId: "appt-1",
        status: "COMPLETED",
      });
      mockedCompleteAppointment.mockRejectedValue(new Error("db down"));

      await expect(
        PatientCheckInService.complete("checkin-1", "org-1"),
      ).rejects.toThrow("db down");
    });
  });

  describe("cancel", () => {
    it("cancels a WAITING check-in", async () => {
      (mockedPrisma.patientCheckIn.findFirst as jest.Mock).mockResolvedValue(
        baseCheckIn,
      );
      const cancelled = { ...baseCheckIn, status: "CANCELLED" as const };
      (mockedPrisma.patientCheckIn.update as jest.Mock).mockResolvedValue(
        cancelled,
      );
      const result = await PatientCheckInService.cancel("checkin-1", "org-1");
      expect(result.status).toBe("CANCELLED");
    });

    it("does not touch the appointment when the check-in is not linked to one", async () => {
      (mockedPrisma.patientCheckIn.findFirst as jest.Mock).mockResolvedValue(
        baseCheckIn,
      );
      (mockedPrisma.patientCheckIn.update as jest.Mock).mockResolvedValue({
        ...baseCheckIn,
        status: "CANCELLED",
      });
      await PatientCheckInService.cancel("checkin-1", "org-1");
      expect(mockedCancelAppointment).not.toHaveBeenCalled();
    });

    it("cancels the linked appointment so the Calendar reflects the cancellation", async () => {
      (mockedPrisma.patientCheckIn.findFirst as jest.Mock).mockResolvedValue({
        ...baseCheckIn,
        appointmentId: "appt-1",
      });
      (mockedPrisma.patientCheckIn.update as jest.Mock).mockResolvedValue({
        ...baseCheckIn,
        appointmentId: "appt-1",
        status: "CANCELLED",
      });
      mockedCancelAppointment.mockResolvedValue(undefined);

      await PatientCheckInService.cancel("checkin-1", "org-1");

      expect(mockedCancelAppointment).toHaveBeenCalledWith("appt-1", "org-1");
    });

    it("still cancels the check-in when the appointment cannot be transitioned", async () => {
      (mockedPrisma.patientCheckIn.findFirst as jest.Mock).mockResolvedValue({
        ...baseCheckIn,
        appointmentId: "appt-1",
      });
      (mockedPrisma.patientCheckIn.update as jest.Mock).mockResolvedValue({
        ...baseCheckIn,
        appointmentId: "appt-1",
        status: "CANCELLED",
      });
      mockedCancelAppointment.mockRejectedValue(
        new AppointmentPrismaServiceError("Appointment not found", 404),
      );

      const result = await PatientCheckInService.cancel("checkin-1", "org-1");

      expect(result.status).toBe("CANCELLED");
    });

    it("still throws an unexpected non-appointment error rather than swallowing it", async () => {
      (mockedPrisma.patientCheckIn.findFirst as jest.Mock).mockResolvedValue({
        ...baseCheckIn,
        appointmentId: "appt-1",
      });
      (mockedPrisma.patientCheckIn.update as jest.Mock).mockResolvedValue({
        ...baseCheckIn,
        appointmentId: "appt-1",
        status: "CANCELLED",
      });
      mockedCancelAppointment.mockRejectedValue(new Error("db down"));

      await expect(
        PatientCheckInService.cancel("checkin-1", "org-1"),
      ).rejects.toThrow("db down");
    });
  });

  describe("markNoShow", () => {
    it("marks a WAITING check-in as NO_SHOW", async () => {
      (mockedPrisma.patientCheckIn.findFirst as jest.Mock).mockResolvedValue(
        baseCheckIn,
      );
      const noShow = { ...baseCheckIn, status: "NO_SHOW" as const };
      (mockedPrisma.patientCheckIn.update as jest.Mock).mockResolvedValue(
        noShow,
      );
      const result = await PatientCheckInService.markNoShow(
        "checkin-1",
        "org-1",
      );
      expect(result.status).toBe("NO_SHOW");
    });

    it("throws 409 for terminal NO_SHOW status", async () => {
      (mockedPrisma.patientCheckIn.findFirst as jest.Mock).mockResolvedValue({
        ...baseCheckIn,
        status: "NO_SHOW",
      });
      await expect(
        PatientCheckInService.markNoShow("checkin-1", "org-1"),
      ).rejects.toThrow(PatientCheckInError);
    });

    it("does not touch the appointment when the check-in is not linked to one", async () => {
      (mockedPrisma.patientCheckIn.findFirst as jest.Mock).mockResolvedValue(
        baseCheckIn,
      );
      (mockedPrisma.patientCheckIn.update as jest.Mock).mockResolvedValue({
        ...baseCheckIn,
        status: "NO_SHOW",
      });
      await PatientCheckInService.markNoShow("checkin-1", "org-1");
      expect(mockedMarkAppointmentNoShow).not.toHaveBeenCalled();
    });

    it("marks the linked appointment no-show so the Calendar reflects it", async () => {
      (mockedPrisma.patientCheckIn.findFirst as jest.Mock).mockResolvedValue({
        ...baseCheckIn,
        appointmentId: "appt-1",
      });
      (mockedPrisma.patientCheckIn.update as jest.Mock).mockResolvedValue({
        ...baseCheckIn,
        appointmentId: "appt-1",
        status: "NO_SHOW",
      });
      mockedMarkAppointmentNoShow.mockResolvedValue(undefined);

      await PatientCheckInService.markNoShow("checkin-1", "org-1");

      expect(mockedMarkAppointmentNoShow).toHaveBeenCalledWith(
        "appt-1",
        "org-1",
      );
    });

    it("still marks the check-in no-show when the appointment cannot be transitioned (e.g. already CHECKED_IN)", async () => {
      (mockedPrisma.patientCheckIn.findFirst as jest.Mock).mockResolvedValue({
        ...baseCheckIn,
        appointmentId: "appt-1",
      });
      (mockedPrisma.patientCheckIn.update as jest.Mock).mockResolvedValue({
        ...baseCheckIn,
        appointmentId: "appt-1",
        status: "NO_SHOW",
      });
      mockedMarkAppointmentNoShow.mockRejectedValue(
        new AppointmentPrismaServiceError(
          "Appointment cannot transition from CHECKED_IN to NO_SHOW in markAppointmentNoShow.",
          409,
        ),
      );

      const result = await PatientCheckInService.markNoShow(
        "checkin-1",
        "org-1",
      );

      expect(result.status).toBe("NO_SHOW");
    });

    it("still throws an unexpected non-appointment error rather than swallowing it", async () => {
      (mockedPrisma.patientCheckIn.findFirst as jest.Mock).mockResolvedValue({
        ...baseCheckIn,
        appointmentId: "appt-1",
      });
      (mockedPrisma.patientCheckIn.update as jest.Mock).mockResolvedValue({
        ...baseCheckIn,
        appointmentId: "appt-1",
        status: "NO_SHOW",
      });
      mockedMarkAppointmentNoShow.mockRejectedValue(new Error("db down"));

      await expect(
        PatientCheckInService.markNoShow("checkin-1", "org-1"),
      ).rejects.toThrow("db down");
    });
  });

  describe("assignRoom", () => {
    it("assigns a room to a waiting check-in", async () => {
      (mockedPrisma.patientCheckIn.findFirst as jest.Mock).mockResolvedValue(
        baseCheckIn,
      );
      const withRoom = { ...baseCheckIn, assignedRoomId: "room-3" };
      (mockedPrisma.patientCheckIn.update as jest.Mock).mockResolvedValue(
        withRoom,
      );
      const result = await PatientCheckInService.assignRoom(
        "checkin-1",
        "org-1",
        "room-3",
      );
      expect(result.assignedRoomId).toBe("room-3");
    });

    it("does not touch the appointment when the check-in is not linked to one", async () => {
      (mockedPrisma.patientCheckIn.findFirst as jest.Mock).mockResolvedValue(
        baseCheckIn,
      );
      (mockedPrisma.patientCheckIn.update as jest.Mock).mockResolvedValue({
        ...baseCheckIn,
        assignedRoomId: "room-3",
      });
      await PatientCheckInService.assignRoom("checkin-1", "org-1", "room-3");
      expect(mockedPrisma.organisationRoom.findFirst).not.toHaveBeenCalled();
      expect(mockedUpdateAppointmentRoom).not.toHaveBeenCalled();
    });

    it("syncs the linked appointment's room so the Board reflects the move", async () => {
      (mockedPrisma.patientCheckIn.findFirst as jest.Mock).mockResolvedValue({
        ...baseCheckIn,
        appointmentId: "appt-1",
      });
      (mockedPrisma.patientCheckIn.update as jest.Mock).mockResolvedValue({
        ...baseCheckIn,
        appointmentId: "appt-1",
        assignedRoomId: "room-3",
      });
      (mockedPrisma.organisationRoom.findFirst as jest.Mock).mockResolvedValue({
        id: "room-3",
        name: "Room 3",
      });
      mockedUpdateAppointmentRoom.mockResolvedValue(undefined);

      await PatientCheckInService.assignRoom("checkin-1", "org-1", "room-3");

      expect(mockedPrisma.organisationRoom.findFirst).toHaveBeenCalledWith({
        where: { id: "room-3", organisationId: "org-1" },
        select: { id: true, name: true },
      });
      expect(mockedUpdateAppointmentRoom).toHaveBeenCalledWith(
        "appt-1",
        "org-1",
        { id: "room-3", name: "Room 3" },
      );
    });

    it("skips the sync when the room cannot be found in this organisation", async () => {
      (mockedPrisma.patientCheckIn.findFirst as jest.Mock).mockResolvedValue({
        ...baseCheckIn,
        appointmentId: "appt-1",
      });
      (mockedPrisma.patientCheckIn.update as jest.Mock).mockResolvedValue({
        ...baseCheckIn,
        appointmentId: "appt-1",
        assignedRoomId: "room-3",
      });
      (mockedPrisma.organisationRoom.findFirst as jest.Mock).mockResolvedValue(
        null,
      );

      await PatientCheckInService.assignRoom("checkin-1", "org-1", "room-3");

      expect(mockedUpdateAppointmentRoom).not.toHaveBeenCalled();
    });

    it("still assigns the room when the appointment cannot be updated (e.g. cancelled)", async () => {
      (mockedPrisma.patientCheckIn.findFirst as jest.Mock).mockResolvedValue({
        ...baseCheckIn,
        appointmentId: "appt-1",
      });
      const updated = {
        ...baseCheckIn,
        appointmentId: "appt-1",
        assignedRoomId: "room-3",
      };
      (mockedPrisma.patientCheckIn.update as jest.Mock).mockResolvedValue(
        updated,
      );
      (mockedPrisma.organisationRoom.findFirst as jest.Mock).mockResolvedValue({
        id: "room-3",
        name: "Room 3",
      });
      mockedUpdateAppointmentRoom.mockRejectedValue(
        new AppointmentPrismaServiceError("Appointment not found", 404),
      );

      const result = await PatientCheckInService.assignRoom(
        "checkin-1",
        "org-1",
        "room-3",
      );

      expect(result.assignedRoomId).toBe("room-3");
    });

    it("still throws an unexpected non-appointment error rather than swallowing it", async () => {
      (mockedPrisma.patientCheckIn.findFirst as jest.Mock).mockResolvedValue({
        ...baseCheckIn,
        appointmentId: "appt-1",
      });
      (mockedPrisma.patientCheckIn.update as jest.Mock).mockResolvedValue({
        ...baseCheckIn,
        appointmentId: "appt-1",
        assignedRoomId: "room-3",
      });
      (mockedPrisma.organisationRoom.findFirst as jest.Mock).mockResolvedValue({
        id: "room-3",
        name: "Room 3",
      });
      mockedUpdateAppointmentRoom.mockRejectedValue(new Error("db down"));

      await expect(
        PatientCheckInService.assignRoom("checkin-1", "org-1", "room-3"),
      ).rejects.toThrow("db down");
    });
  });
});
