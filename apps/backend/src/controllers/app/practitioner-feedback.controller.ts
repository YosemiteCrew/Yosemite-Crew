import { Request, Response } from "express";
import { z } from "zod";
import { AuthUserMobileService } from "src/services/authUserMobile.service";
import {
  PractitionerFeedbackService,
  PractitionerFeedbackServiceError,
} from "src/services/practitioner-feedback.service";
import logger from "src/utils/logger";
import { resolveVerifiedUserId } from "src/utils/request";
import { toSafeErrorLog } from "src/utils/safe-error-log";

const FeedbackBodySchema = z
  .object({
    rating: z.number().int().min(1).max(5),
    review: z.string().max(1000).optional(),
  })
  .strict();
const FeedbackLookupSchema = z
  .object({ appointmentId: z.string().min(1) })
  .strict();
const FeedbackBatchLookupSchema = z.object({}).strict();

const resolveParentId = async (req: Request, res: Response) => {
  const verifiedUserId = resolveVerifiedUserId(req);
  if (!verifiedUserId) {
    res.status(401).json({ message: "Authentication required." });
    return null;
  }

  const authUser =
    await AuthUserMobileService.getByProviderUserId(verifiedUserId);
  const parentId = authUser?.parentId;
  if (!parentId) {
    res.status(400).json({ message: "Parent not found for user." });
    return null;
  }

  return parentId;
};

const sendError = (res: Response, action: string, error: unknown) => {
  if (error instanceof PractitionerFeedbackServiceError) {
    return res.status(error.statusCode).json({ message: error.message });
  }
  logger.error(`Unable to ${action} practitioner feedback`, {
    error: toSafeErrorLog(error),
  });
  return res.status(500).json({
    message:
      action === "load"
        ? "Unable to load feedback."
        : "Unable to save feedback.",
  });
};

export const PractitionerFeedbackController = {
  getForParent: async (req: Request, res: Response) => {
    try {
      const parentId = await resolveParentId(req, res);
      if (!parentId) return;

      const result = FeedbackBatchLookupSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "Invalid feedback request." });
      }

      const feedbackByAppointment =
        await PractitionerFeedbackService.getForParent(parentId);
      return res.status(200).json({ feedbackByAppointment });
    } catch (error) {
      return sendError(res, "load", error);
    }
  },

  getForAppointment: async (req: Request, res: Response) => {
    try {
      const parentId = await resolveParentId(req, res);
      if (!parentId) return;

      const result = FeedbackLookupSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "Invalid feedback request." });
      }

      const feedback = await PractitionerFeedbackService.getForAppointment(
        result.data.appointmentId,
        parentId,
      );
      return res.status(200).json({ feedback });
    } catch (error) {
      return sendError(res, "load", error);
    }
  },

  rateAppointment: async (req: Request, res: Response) => {
    try {
      const parentId = await resolveParentId(req, res);
      if (!parentId) return;

      const result = FeedbackBodySchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "Invalid feedback." });
      }

      await PractitionerFeedbackService.rateAppointment(
        req.params.appointmentId,
        parentId,
        result.data.rating,
        result.data.review,
      );
      return res.status(200).json({ message: "Feedback saved." });
    } catch (error) {
      return sendError(res, "save", error);
    }
  },
};
