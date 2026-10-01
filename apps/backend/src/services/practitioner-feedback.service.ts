import { fromFHIRAppointment } from "@yosemite-crew/types";
import { prisma } from "src/config/prisma";
import { AuditTrailService } from "src/services/audit-trail.service";
import {
  AppointmentPrismaService,
  AppointmentPrismaServiceError,
} from "src/services/appointment.prisma.service";

const MAX_REVIEW_LENGTH = 1000;

export class PractitionerFeedbackServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "PractitionerFeedbackServiceError";
  }
}

const getCompletedAppointmentTarget = async (
  appointmentId: string,
  parentId: string,
) => {
  if (!appointmentId.trim() || !parentId.trim()) {
    throw new PractitionerFeedbackServiceError("Invalid appointment", 400);
  }

  let appointment;
  try {
    appointment = fromFHIRAppointment(
      await AppointmentPrismaService.getById(appointmentId, { parentId }),
    );
  } catch (error) {
    if (error instanceof AppointmentPrismaServiceError) {
      throw new PractitionerFeedbackServiceError(
        error.message,
        error.statusCode,
      );
    }
    throw error;
  }

  if (appointment.status !== "COMPLETED") {
    throw new PractitionerFeedbackServiceError(
      "Feedback is available after a completed appointment.",
      409,
    );
  }

  const practitionerId = appointment.lead?.id.trim();
  if (!practitionerId || !appointment.lead?.name.trim()) {
    throw new PractitionerFeedbackServiceError(
      "This appointment has no veterinarian to review.",
      409,
    );
  }

  return {
    feedback: {
      appointmentId,
      practitionerId,
      practitionerName: appointment.lead.name.trim(),
      userId: parentId,
    },
    organisationId: appointment.organisationId,
    patientId: appointment.patient.id,
  };
};

const feedbackKey = (appointmentId: string, userId: string) => ({
  appointmentId_userId: { appointmentId, userId },
});

const validateFeedback = (rating: number, review?: string) => {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new PractitionerFeedbackServiceError(
      "Rating must be a whole number from 1 to 5.",
      400,
    );
  }
  if (review != null && review.length > MAX_REVIEW_LENGTH) {
    throw new PractitionerFeedbackServiceError(
      "Review must be 1000 characters or fewer.",
      400,
    );
  }
};

export const PractitionerFeedbackService = {
  async getForParent(parentId: string) {
    if (!parentId.trim()) {
      throw new PractitionerFeedbackServiceError("Invalid parent", 400);
    }

    const appointments =
      await AppointmentPrismaService.getAppointmentsForParent(parentId);
    const completedAppointments = appointments.flatMap((row) => {
      const appointment = fromFHIRAppointment(row);
      const lead = appointment.lead;
      const practitionerName = lead?.name.trim();
      if (
        appointment.status !== "COMPLETED" ||
        !appointment.id ||
        !lead?.id.trim() ||
        !practitionerName
      ) {
        return [];
      }

      return [{ appointmentId: appointment.id, practitionerName }];
    });

    if (!completedAppointments.length) return {};

    const savedFeedback = await prisma.organisationRating.findMany({
      where: {
        userId: parentId,
        appointmentId: {
          in: completedAppointments.map(({ appointmentId }) => appointmentId),
        },
      },
      select: {
        appointmentId: true,
        rating: true,
        review: true,
        practitionerName: true,
      },
    });
    const feedbackByAppointmentId = new Map(
      savedFeedback.map((feedback) => [feedback.appointmentId, feedback]),
    );

    return Object.fromEntries(
      completedAppointments.map(({ appointmentId, practitionerName }) => {
        const feedback = feedbackByAppointmentId.get(appointmentId);
        return [
          appointmentId,
          feedback
            ? {
                isRated: true,
                rating: feedback.rating,
                review: feedback.review,
                practitionerName: feedback.practitionerName,
              }
            : {
                isRated: false,
                rating: null,
                review: null,
                practitionerName,
              },
        ];
      }),
    );
  },

  async getForAppointment(appointmentId: string, parentId: string) {
    const target = await getCompletedAppointmentTarget(appointmentId, parentId);
    const feedback = await prisma.organisationRating.findUnique({
      where: feedbackKey(appointmentId, parentId),
    });

    return feedback
      ? {
          isRated: true,
          rating: feedback.rating,
          review: feedback.review,
          practitionerName: feedback.practitionerName,
        }
      : {
          isRated: false,
          rating: null,
          review: null,
          practitionerName: target.feedback.practitionerName,
        };
  },

  async rateAppointment(
    appointmentId: string,
    parentId: string,
    rating: number,
    review?: string,
  ) {
    validateFeedback(rating, review);
    const target = await getCompletedAppointmentTarget(appointmentId, parentId);
    const normalizedReview = review?.trim() || null;
    const where = feedbackKey(appointmentId, parentId);

    const existing = await prisma.organisationRating.findUnique({
      where,
      select: { id: true },
    });
    const saved = await prisma.organisationRating.upsert({
      where,
      create: {
        organizationId: null,
        ...target.feedback,
        rating,
        review: normalizedReview,
      },
      update: {
        rating,
        review: normalizedReview,
      },
    });

    // Who changed the feedback and when; the review text stays out of the trail.
    await AuditTrailService.recordSafely({
      organisationId: target.organisationId,
      patientId: target.patientId,
      eventType: existing
        ? "PRACTITIONER_FEEDBACK_UPDATED"
        : "PRACTITIONER_FEEDBACK_SUBMITTED",
      actorType: "PARENT",
      actorId: parentId,
      entityType: "APPOINTMENT",
      entityId: appointmentId,
      metadata: { feedbackId: saved.id },
    });

    return { success: true };
  },
};
