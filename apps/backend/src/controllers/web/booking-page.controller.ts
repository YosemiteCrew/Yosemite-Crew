import type { Request, Response } from "express";
import { z } from "zod";
import logger from "src/utils/logger";
import type { OrgRequest } from "src/middlewares/rbac";
import {
  BookingPageService,
  BookingPageServiceError,
} from "src/services/booking-page.service";
import {
  PublicBookingError,
  PublicBookingRequestService,
} from "src/services/public-booking.service";

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
  // Optional on purpose: a caller that omits it is saving settings, not
  // changing what the public can reach.
  publicBookingEnabled: z.boolean().optional(),
});

const RequestListQuerySchema = z.object({
  status: z.enum(["CONFIRMED", "DECLINED", "BOOKED"]).optional(),
});

/**
 * A practice may decline a request, or record that it booked it. It cannot move
 * one back to CONFIRMED or invent a PENDING one - those transitions belong to
 * the public flow, and exposing them here would let staff resurrect a request
 * the requester never confirmed.
 */
const RequestStatusSchema = z.object({
  status: z.enum(["DECLINED", "BOOKED"]),
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
  if (
    error instanceof BookingPageServiceError ||
    error instanceof PublicBookingError
  ) {
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
        publicBookingEnabled: parsed.data.publicBookingEnabled,
      });

      return res.status(200).json({ data });
    } catch (error: unknown) {
      return handleError("saveBookingPageConfig error", error, res);
    }
  },

  /**
   * Booking requests the public has submitted and confirmed.
   *
   * Unconfirmed requests are never listed. Anyone can type anyone's address into
   * a public form, so an unconfirmed row is an unverified claim; surfacing it
   * would make this queue fillable by any anonymous caller.
   */
  listRequests: async (req: Request, res: Response) => {
    try {
      const organisationId = resolveAuthorizedOrgId(req, res);
      if (!organisationId) return;

      const parsed = RequestListQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        return res
          .status(400)
          .json({ message: parsed.error.issues[0].message });
      }

      const data = await PublicBookingRequestService.listForOrganisation(
        organisationId,
        parsed.data.status,
      );
      return res.status(200).json({ data });
    } catch (error: unknown) {
      return handleError("listBookingRequests error", error, res);
    }
  },

  updateRequestStatus: async (
    req: Request<{ organisationId: string; requestId: string }>,
    res: Response,
  ) => {
    try {
      const organisationId = resolveAuthorizedOrgId(req, res);
      if (!organisationId) return;

      const parsed = RequestStatusSchema.safeParse(req.body);
      if (!parsed.success) {
        return res
          .status(400)
          .json({ message: parsed.error.issues[0].message });
      }

      await PublicBookingRequestService.setStatus(
        organisationId,
        req.params.requestId,
        parsed.data.status,
      );
      return res.status(200).json({ message: "Updated" });
    } catch (error: unknown) {
      return handleError("updateBookingRequestStatus error", error, res);
    }
  },
};
