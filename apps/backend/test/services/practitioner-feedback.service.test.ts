import { Appointment, toFHIRAppointment } from "@yosemite-crew/types";
import { prisma } from "src/config/prisma";
import {
  AppointmentPrismaService,
  AppointmentPrismaServiceError,
} from "src/services/appointment.prisma.service";
import {
  PractitionerFeedbackService,
  PractitionerFeedbackServiceError,
} from "src/services/practitioner-feedback.service";
import { AuditTrailService } from "src/services/audit-trail.service";

jest.mock("src/config/prisma", () => ({
  prisma: {
    organisationRating: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      upsert: jest.fn(),
    },
  },
}));

jest.mock("src/services/audit-trail.service", () => ({
  AuditTrailService: { recordSafely: jest.fn() },
}));

jest.mock("src/services/appointment.prisma.service", () => ({
  AppointmentPrismaService: {
    getById: jest.fn(),
    getAppointmentsForParent: jest.fn(),
  },
  AppointmentPrismaServiceError: class extends Error {
    constructor(
      message: string,
      public readonly statusCode: number,
    ) {
      super(message);
    }
  },
}));

const appointmentId = "appointment-1";
const parentId = "parent-1";
const completedAppointment = (
  status: Appointment["status"] = "COMPLETED",
  id = appointmentId,
  hasLead = true,
) =>
  toFHIRAppointment({
    id,
    patient: {
      id: "patient-1",
      name: "Milo",
      species: "Dog",
      parent: { id: parentId, name: "Sam" },
    },
    ...(hasLead ? { lead: { id: "practitioner-1", name: "Dr Lee" } } : {}),
    organisationId: "clinic-1",
    appointmentDate: new Date("2026-09-01T10:00:00.000Z"),
    startTime: new Date("2026-09-01T10:00:00.000Z"),
    endTime: new Date("2026-09-01T10:30:00.000Z"),
    timeSlot: "10:00",
    durationMinutes: 30,
    status,
  });

describe("PractitionerFeedbackService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (AppointmentPrismaService.getById as jest.Mock).mockResolvedValue(
      completedAppointment(),
    );
  });

  it("returns an unrated state for the appointment's current practitioner", async () => {
    (prisma.organisationRating.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(
      PractitionerFeedbackService.getForAppointment(appointmentId, parentId),
    ).resolves.toEqual({
      isRated: false,
      rating: null,
      review: null,
      practitionerName: "Dr Lee",
    });
    expect(AppointmentPrismaService.getById).toHaveBeenCalledWith(
      appointmentId,
      { parentId },
    );
    expect(prisma.organisationRating.findUnique).toHaveBeenCalledWith({
      where: { appointmentId_userId: { appointmentId, userId: parentId } },
    });
  });

  it("returns saved feedback with its original practitioner name", async () => {
    const savedFeedback = {
      rating: 4,
      review: "Clear advice",
      practitionerName: "Dr Patel",
    };
    (prisma.organisationRating.findUnique as jest.Mock).mockResolvedValue(
      savedFeedback,
    );

    await expect(
      PractitionerFeedbackService.getForAppointment(appointmentId, parentId),
    ).resolves.toEqual({ isRated: true, ...savedFeedback });
  });

  it("loads completed appointment feedback in one parent-scoped query", async () => {
    (
      AppointmentPrismaService.getAppointmentsForParent as jest.Mock
    ).mockResolvedValue([
      completedAppointment(),
      completedAppointment("COMPLETED", "appointment-2"),
      completedAppointment("UPCOMING", "appointment-3"),
      completedAppointment("COMPLETED", "appointment-4", false),
    ]);
    (prisma.organisationRating.findMany as jest.Mock).mockResolvedValue([
      {
        appointmentId: "appointment-2",
        rating: 5,
        review: "Very kind",
        practitionerName: "Dr Patel",
      },
    ]);

    await expect(
      PractitionerFeedbackService.getForParent(parentId),
    ).resolves.toEqual({
      [appointmentId]: {
        isRated: false,
        rating: null,
        review: null,
        practitionerName: "Dr Lee",
      },
      "appointment-2": {
        isRated: true,
        rating: 5,
        review: "Very kind",
        practitionerName: "Dr Patel",
      },
    });
    expect(
      AppointmentPrismaService.getAppointmentsForParent,
    ).toHaveBeenCalledWith(parentId);
    expect(prisma.organisationRating.findMany).toHaveBeenCalledWith({
      where: {
        userId: parentId,
        appointmentId: { in: [appointmentId, "appointment-2"] },
      },
      select: {
        appointmentId: true,
        rating: true,
        review: true,
        practitionerName: true,
      },
    });
  });

  it("returns no records without completed appointments and skips feedback lookup", async () => {
    (
      AppointmentPrismaService.getAppointmentsForParent as jest.Mock
    ).mockResolvedValue([completedAppointment("UPCOMING")]);

    await expect(
      PractitionerFeedbackService.getForParent(parentId),
    ).resolves.toEqual({});
    expect(prisma.organisationRating.findMany).not.toHaveBeenCalled();
  });

  it("rejects a missing parent before looking up appointments", async () => {
    await expect(
      PractitionerFeedbackService.getForParent(""),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(
      AppointmentPrismaService.getAppointmentsForParent,
    ).not.toHaveBeenCalled();
  });

  it("creates feedback using only the practitioner on the owned appointment", async () => {
    (prisma.organisationRating.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.organisationRating.upsert as jest.Mock).mockResolvedValue({
      id: "feedback-1",
    });

    await expect(
      PractitionerFeedbackService.rateAppointment(
        appointmentId,
        parentId,
        5,
        "  Great care  ",
      ),
    ).resolves.toEqual({ success: true });

    expect(prisma.organisationRating.upsert).toHaveBeenCalledWith({
      where: { appointmentId_userId: { appointmentId, userId: parentId } },
      create: {
        appointmentId,
        organizationId: null,
        practitionerId: "practitioner-1",
        practitionerName: "Dr Lee",
        userId: parentId,
        rating: 5,
        review: "Great care",
      },
      update: { rating: 5, review: "Great care" },
    });
    expect(AuditTrailService.recordSafely).toHaveBeenCalledWith({
      organisationId: "clinic-1",
      patientId: "patient-1",
      eventType: "PRACTITIONER_FEEDBACK_SUBMITTED",
      actorType: "PARENT",
      actorId: parentId,
      entityType: "APPOINTMENT",
      entityId: appointmentId,
      metadata: { feedbackId: "feedback-1" },
    });
  });

  it("updates only the feedback fields so the original practitioner attribution stays fixed", async () => {
    (prisma.organisationRating.findUnique as jest.Mock).mockResolvedValue({
      id: "feedback-1",
    });
    (prisma.organisationRating.upsert as jest.Mock).mockResolvedValue({
      id: "feedback-1",
    });
    await PractitionerFeedbackService.rateAppointment(
      appointmentId,
      parentId,
      2,
      "Second thoughts",
    );

    expect(prisma.organisationRating.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: { rating: 2, review: "Second thoughts" },
      }),
    );
    expect(prisma.organisationRating.findUnique).toHaveBeenCalledWith({
      where: { appointmentId_userId: { appointmentId, userId: parentId } },
      select: { id: true },
    });
    expect(AuditTrailService.recordSafely).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "PRACTITIONER_FEEDBACK_UPDATED",
        actorType: "PARENT",
        actorId: parentId,
        metadata: { feedbackId: "feedback-1" },
      }),
    );
    expect(
      JSON.stringify((AuditTrailService.recordSafely as jest.Mock).mock.calls),
    ).not.toContain("Second thoughts");
  });

  it("does not save or audit feedback on an appointment the parent cannot see", async () => {
    (AppointmentPrismaService.getById as jest.Mock).mockRejectedValue(
      new AppointmentPrismaServiceError("Appointment not found", 404),
    );

    await expect(
      PractitionerFeedbackService.rateAppointment(appointmentId, parentId, 5),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(prisma.organisationRating.upsert).not.toHaveBeenCalled();
    expect(AuditTrailService.recordSafely).not.toHaveBeenCalled();
  });

  it("rejects feedback before the appointment is complete", async () => {
    (AppointmentPrismaService.getById as jest.Mock).mockResolvedValue(
      completedAppointment("UPCOMING"),
    );

    await expect(
      PractitionerFeedbackService.rateAppointment(appointmentId, parentId, 5),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(prisma.organisationRating.upsert).not.toHaveBeenCalled();
  });

  it("rejects completed appointments without an assigned practitioner", async () => {
    (AppointmentPrismaService.getById as jest.Mock).mockResolvedValue(
      toFHIRAppointment({
        ...{
          id: appointmentId,
          patient: {
            id: "patient-1",
            name: "Milo",
            species: "Dog",
            parent: { id: parentId, name: "Sam" },
          },
          organisationId: "clinic-1",
          appointmentDate: new Date("2026-09-01T10:00:00.000Z"),
          startTime: new Date("2026-09-01T10:00:00.000Z"),
          endTime: new Date("2026-09-01T10:30:00.000Z"),
          timeSlot: "10:00",
          durationMinutes: 30,
          status: "COMPLETED" as const,
        },
      }),
    );

    await expect(
      PractitionerFeedbackService.getForAppointment(appointmentId, parentId),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(prisma.organisationRating.findUnique).not.toHaveBeenCalled();
  });

  it.each([0, 6, 2.5])("rejects invalid rating %s", async (rating) => {
    await expect(
      PractitionerFeedbackService.rateAppointment(
        appointmentId,
        parentId,
        rating,
      ),
    ).rejects.toBeInstanceOf(PractitionerFeedbackServiceError);
    expect(AppointmentPrismaService.getById).not.toHaveBeenCalled();
  });

  it("rejects reviews longer than the supported limit", async () => {
    await expect(
      PractitionerFeedbackService.rateAppointment(
        appointmentId,
        parentId,
        5,
        "x".repeat(1001),
      ),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it.each([
    ["", parentId],
    [appointmentId, ""],
  ])(
    "rejects missing appointment ownership context",
    async (requestedAppointmentId, requestedParentId) => {
      await expect(
        PractitionerFeedbackService.getForAppointment(
          requestedAppointmentId,
          requestedParentId,
        ),
      ).rejects.toMatchObject({ statusCode: 400 });
      expect(AppointmentPrismaService.getById).not.toHaveBeenCalled();
    },
  );

  it("preserves appointment access errors as not-found responses", async () => {
    (AppointmentPrismaService.getById as jest.Mock).mockRejectedValue(
      new AppointmentPrismaServiceError("Appointment not found", 404),
    );

    await expect(
      PractitionerFeedbackService.getForAppointment(appointmentId, parentId),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(prisma.organisationRating.findUnique).not.toHaveBeenCalled();
  });
});
