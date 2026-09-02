import type { Request, Response } from "express";
import { z } from "zod";
import logger from "src/utils/logger";
import {
  PublicBookingError,
  PublicBookingRequestService,
  PublicBookingService,
  resolveSlug,
} from "src/services/public-booking.service";

/**
 * The unauthenticated booking surface.
 *
 * Every handler here answers to anyone on the internet, so two things hold
 * throughout: the request body is parsed by zod before it reaches a service, and
 * an unexpected failure never reaches the caller. The sibling public POST
 * (`contact-us`) validates nothing, and copying that would have put an
 * unvalidated body in front of a database on a page that collects PII.
 */

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD");

const timeOfDay = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "startTime must be HH:mm");

/**
 * Bounds on every free-text field.
 *
 * These become rows in a veterinary database and lines in an email to a real
 * practice, written by an anonymous stranger. The ceilings are what stop one
 * submission carrying a megabyte of text into either.
 */
const RequestSchema = z.object({
  serviceId: z.uuid(),
  date: isoDate,
  startTime: timeOfDay,
  ownerName: z.string().trim().min(1).max(120),
  ownerEmail: z.string().trim().pipe(z.email().max(254)),
  ownerPhone: z.string().trim().max(40).optional().nullable(),
  petName: z.string().trim().min(1).max(120),
  petSpecies: z.string().trim().min(1).max(60),
  concern: z.string().trim().max(1000).optional().nullable(),
  /**
   * Explicit, not implied by submission. GDPR Art. 6 wants a lawful basis
   * recorded where the data is collected, and the timestamp stored against the
   * row is only meaningful if the box was actually ticked.
   */
  consent: z.literal(true),
});

const SlotsQuerySchema = z.object({
  serviceId: z.uuid(),
  date: isoDate,
});

/**
 * One error shape for every failure.
 *
 * Anything that is not a deliberate `PublicBookingError` becomes a flat 500 with
 * no detail. A stack trace, a Prisma message or a constraint name reaching an
 * anonymous caller describes the schema to someone who should not have it.
 */
const handleError = (context: string, error: unknown, res: Response) => {
  if (error instanceof PublicBookingError) {
    return res.status(error.status).json({ message: error.message });
  }
  logger.error(context, error);
  return res.status(500).json({ message: "Something went wrong" });
};

export const PublicBookingController = {
  /**
   * The practice and what it offers.
   *
   * A retired slug answers 200 with `redirectTo` rather than 301: the caller is
   * a client-side page, and telling it where to go lets it replace its own URL
   * without the API guessing at the frontend's routing.
   */
  getPractice: async (req: Request<{ slug: string }>, res: Response) => {
    try {
      const resolved = await resolveSlug(req.params.slug);
      if (resolved.kind === "retired") {
        return res.status(200).json({ data: { redirectTo: resolved.slug } });
      }

      const data = await PublicBookingService.getPractice(req.params.slug);
      return res.status(200).json({ data });
    } catch (error: unknown) {
      return handleError("public getPractice error", error, res);
    }
  },

  getSlots: async (req: Request<{ slug: string }>, res: Response) => {
    try {
      const parsed = SlotsQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        return res
          .status(400)
          .json({ message: parsed.error.issues[0].message });
      }

      const data = await PublicBookingService.getSlots(
        req.params.slug,
        parsed.data.serviceId,
        parsed.data.date,
      );
      return res.status(200).json({ data });
    } catch (error: unknown) {
      return handleError("public getSlots error", error, res);
    }
  },

  /**
   * Accept a booking request.
   *
   * 202, not 201, and with no body. Nothing is booked and no resource is
   * addressable yet: the request is invisible until the requester follows the
   * emailed link. Returning an id would hand an anonymous caller a handle to
   * something they have not proved they own.
   */
  submitRequest: async (req: Request<{ slug: string }>, res: Response) => {
    try {
      const parsed = RequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res
          .status(400)
          .json({ message: parsed.error.issues[0].message });
      }

      await PublicBookingRequestService.submit(req.params.slug, {
        serviceId: parsed.data.serviceId,
        date: parsed.data.date,
        startTime: parsed.data.startTime,
        ownerName: parsed.data.ownerName,
        ownerEmail: parsed.data.ownerEmail,
        ownerPhone: parsed.data.ownerPhone ?? null,
        petName: parsed.data.petName,
        petSpecies: parsed.data.petSpecies,
        concern: parsed.data.concern ?? null,
      });

      return res.status(202).json({
        message:
          "Check your email and follow the link to confirm this request. Nothing is booked yet.",
      });
    } catch (error: unknown) {
      return handleError("public submitRequest error", error, res);
    }
  },

  confirmRequest: async (
    req: Request<unknown, unknown, { token?: unknown } | undefined>,
    res: Response,
  ) => {
    try {
      // Narrowed rather than trusted: the body is attacker-shaped, and a
      // non-string here would otherwise reach a Prisma `where` as a filter
      // object. An empty string is refused by the service like any other
      // unknown token.
      const raw: unknown = req.body?.token;
      const token = typeof raw === "string" ? raw : "";
      const data = await PublicBookingRequestService.confirm(token);
      return res.status(200).json({ data });
    } catch (error: unknown) {
      return handleError("public confirmRequest error", error, res);
    }
  },
};
