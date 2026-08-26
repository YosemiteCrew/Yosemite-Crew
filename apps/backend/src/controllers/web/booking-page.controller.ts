import type { Request, Response } from "express";
import { z } from "zod";
import logger from "src/utils/logger";
import type { OrgRequest } from "src/middlewares/rbac";
import {
  BookingPageService,
  BookingPageServiceError,
} from "src/services/booking-page.service";

/**
 * Authenticated configuration surface for a practice's public booking page.
 *
 * Every handler scopes on `(req as OrgRequest).organisationId` - the value
 * `withOrgPermissions` actually authorized - and never on the route param, so a
 * caller cannot address one organisation while being authorized for another.
 */

/**
 * Bounds, not just types.
 *
 * `bookingWindowDays` decides how far into the future an anonymous caller can
 * later walk a practice's calendar, and `bufferMinutes` decides how much of a
 * real working day one public booking consumes. Both are eventually read by an
 * unauthenticated surface, so they get explicit ceilings here rather than
 * inheriting whatever an admin typed.
 */
const SettingsSchema = z.object({
  serviceIds: z.array(z.string().uuid()).max(200),
  bookingWindowDays: z.number().int().min(1).max(180),
  bufferMinutes: z.number().int().min(0).max(240),
  autoConfirm: z.boolean(),
  welcomeMessage: z.string().trim().max(500).nullish(),
  replyToEmail: z.string().trim().email().max(254).nullish(),
});

const resolveAuthorizedOrgId = (req: Request, res: Response): string | null => {
  const organisationId = (req as OrgRequest).organisationId;
  if (!organisationId) {
    res.status(400).json({ message: "Organisation could not be resolved" });
    return null;
  }
  return organisationId;
};

const handleError = (context: string, error: unknown, res: Response) => {
  if (error instanceof BookingPageServiceError) {
    return res.status(error.status).json({ message: error.message });
  }
  logger.error(context, error);
  return res.status(500).json({ message: "Something went wrong" });
};

export const BookingPageController = {
  getConfig: async (req: Request, res: Response) => {
    try {
      const organisationId = resolveAuthorizedOrgId(req, res);
      if (!organisationId) return;

      const data = await BookingPageService.getConfig(organisationId);
      return res.status(200).json({ data });
    } catch (error: unknown) {
      return handleError("getBookingPageConfig error", error, res);
    }
  },

  saveConfig: async (req: Request, res: Response) => {
    try {
      const organisationId = resolveAuthorizedOrgId(req, res);
      if (!organisationId) return;

      const parsed = SettingsSchema.safeParse(req.body);
      if (!parsed.success) {
        // A zod failure always carries at least one issue, so the first one is
        // the message to show - no fallback needed.
        return res
          .status(400)
          .json({ message: parsed.error.issues[0].message });
      }

      const data = await BookingPageService.saveConfig(organisationId, {
        serviceIds: parsed.data.serviceIds,
        bookingWindowDays: parsed.data.bookingWindowDays,
        bufferMinutes: parsed.data.bufferMinutes,
        autoConfirm: parsed.data.autoConfirm,
        welcomeMessage: parsed.data.welcomeMessage ?? null,
        replyToEmail: parsed.data.replyToEmail ?? null,
      });

      return res.status(200).json({ data });
    } catch (error: unknown) {
      return handleError("saveBookingPageConfig error", error, res);
    }
  },
};
