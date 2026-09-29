import { fromFHIRAppointment } from "@yosemite-crew/types";
import { prisma } from "src/config/prisma";
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
    appointmentId,
    practitionerId,
    practitionerName: appointment.lead.name.trim(),
    userId: parentId,
  };
};

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
  async getForAppointment(appointmentId: string, parentId: string) {
    const target = await getCompletedAppointmentTarget(appointmentId, parentId);
    const feedback = await prisma.organisationRating.findUnique({
      where: {
        appointmentId_userId: {
          appointmentId: target.appointmentId,
          userId: target.userId,
        },
      },
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
          practitionerName: target.practitionerName,
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

    await prisma.organisationRating.upsert({
      where: {
        appointmentId_userId: {
          appointmentId: target.appointmentId,
          userId: target.userId,
        },
      },
      create: {
        organizationId: null,
        ...target,
        rating,
        review: normalizedReview,
      },
      update: {
        rating,
        review: normalizedReview,
      },
    });

    return { success: true };
  },
};
