import { Request, Response } from "express";
import { z } from "zod";
import {
  PrescriptionFillAuthorisationService,
  PrescriptionFillAuthorisationServiceError,
} from "src/services/prescription-fill-authorisation.service";
import type { OrgRequest } from "src/middlewares/rbac";
import { resolveVerifiedUserId } from "src/utils/request";
import logger from "src/utils/logger";

const pathParamsSchema = z.object({
  organisationId: z.string().trim().min(1),
  itemId: z.string().trim().min(1),
});

const reservationParamsSchema = z.object({
  organisationId: z.string().trim().min(1),
  reservationId: z.string().trim().min(1),
});

const authorisationParamsSchema = z.object({
  organisationId: z.string().trim().min(1),
  authorizationId: z.string().trim().min(1),
});

/**
 * `perFillQuantity` is a string on the wire on purpose. A JSON number is a
 * double, so 0.1 arrives as 0.1000000000000000055 and a quantity the clinician
 * typed is not the quantity that gets stored.
 */
const decimalString = z
  .string()
  .trim()
  .regex(/^\d+(\.\d+)?$/, "must be a decimal number");

const authoriseBodySchema = z.object({
  validUntil: z.iso.datetime({ offset: true }),
  maxAdditionalFills: z.number().int().min(0),
  perFillQuantity: decimalString,
  perFillQuantityUnit: z.string().trim().min(1),
});

const reserveBodySchema = z.object({
  idempotencyKey: z.string().trim().min(1),
  expectedVersion: z.number().int().min(1).optional(),
  dispenseRequestId: z.string().trim().min(1).optional(),
});

const fulfilBodySchema = z.object({
  quantity: decimalString,
});

/**
 * Every field optional, so `revoke` and `cancel` parse `req.body ?? {}`: a
 * request sent with no body at all is a valid one for them, where the schemas
 * above reject it either way.
 */
const reasonBodySchema = z.object({
  reason: z.string().trim().min(1).optional(),
});

/**
 * The service already classifies its own refusals, so this only has to decide
 * between "the caller sent something invalid", "the service said no" and "we
 * broke". A thrown error that is none of those is logged rather than echoed:
 * its message may name a record the caller is not entitled to know exists.
 */
const handleError = (res: Response, error: unknown, context: string) => {
  if (error instanceof z.ZodError) {
    return res.status(400).json({ message: `Invalid ${context} payload.` });
  }

  if (error instanceof PrescriptionFillAuthorisationServiceError) {
    return res.status(error.statusCode).json({ message: error.message });
  }

  logger.error(`Unexpected ${context} error`, { error });
  return res.status(500).json({ message: `Failed to ${context}.` });
};

/**
 * True only when the caller's loaded permissions include the org-wide edit.
 * Read from the permissions `withOrgPermissions` attached, never from the
 * body: the router admits `prescription:edit:own` holders too, and the service
 * refuses them on someone else's prescription.
 */
const callerMayEditAny = (req: Request): boolean =>
  (req as OrgRequest).userPermissions?.includes("prescription:edit:any") ??
  false;

const requireActor = (req: Request): string => {
  const userId = resolveVerifiedUserId(req);
  if (!userId) {
    throw new PrescriptionFillAuthorisationServiceError(
      "Authenticated user is required",
      401,
    );
  }
  return userId;
};

export const PrescriptionFillAuthorisationController = {
  async authorise(req: Request, res: Response) {
    try {
      const params = pathParamsSchema.parse(req.params);
      const body = authoriseBodySchema.parse(req.body);
      const authorisedBy = requireActor(req);

      const authorisation =
        await PrescriptionFillAuthorisationService.authoriseFills({
          organisationId: params.organisationId,
          itemId: params.itemId,
          validUntil: new Date(body.validUntil),
          maxAdditionalFills: body.maxAdditionalFills,
          perFillQuantity: body.perFillQuantity,
          perFillQuantityUnit: body.perFillQuantityUnit,
          authorisedBy,
          canEditAny: callerMayEditAny(req),
        });

      return res.status(201).json(authorisation);
    } catch (error) {
      return handleError(res, error, "authorise prescription refills");
    }
  },

  async revoke(req: Request, res: Response) {
    try {
      const params = authorisationParamsSchema.parse(req.params);
      const body = reasonBodySchema.parse(req.body ?? {});
      const revokedBy = requireActor(req);

      const authorisation =
        await PrescriptionFillAuthorisationService.revokeAuthorization({
          organisationId: params.organisationId,
          authorizationId: params.authorizationId,
          revokedBy,
          canEditAny: callerMayEditAny(req),
          reason: body.reason,
        });

      return res.status(200).json(authorisation);
    } catch (error) {
      return handleError(res, error, "revoke prescription refill authority");
    }
  },

  async eligibility(req: Request, res: Response) {
    try {
      const params = pathParamsSchema.parse(req.params);

      const eligibility =
        await PrescriptionFillAuthorisationService.getFillEligibility({
          organisationId: params.organisationId,
          itemId: params.itemId,
        });

      return res.status(200).json(eligibility);
    } catch (error) {
      return handleError(res, error, "read prescription refill eligibility");
    }
  },

  async reserve(req: Request, res: Response) {
    try {
      const params = pathParamsSchema.parse(req.params);
      const body = reserveBodySchema.parse(req.body);
      const reservedBy = requireActor(req);

      const reservation =
        await PrescriptionFillAuthorisationService.reserveFill({
          organisationId: params.organisationId,
          itemId: params.itemId,
          idempotencyKey: body.idempotencyKey,
          expectedVersion: body.expectedVersion,
          dispenseRequestId: body.dispenseRequestId,
          reservedBy,
        });

      return res.status(201).json(reservation);
    } catch (error) {
      return handleError(res, error, "reserve a prescription refill");
    }
  },

  async fulfil(req: Request, res: Response) {
    try {
      const params = reservationParamsSchema.parse(req.params);
      const body = fulfilBodySchema.parse(req.body);
      requireActor(req);

      const reservation =
        await PrescriptionFillAuthorisationService.recordFulfilment({
          organisationId: params.organisationId,
          reservationId: params.reservationId,
          quantity: body.quantity,
        });

      return res.status(200).json(reservation);
    } catch (error) {
      return handleError(res, error, "record a prescription refill fulfilment");
    }
  },

  async cancel(req: Request, res: Response) {
    try {
      const params = reservationParamsSchema.parse(req.params);
      const body = reasonBodySchema.parse(req.body ?? {});
      requireActor(req);

      const reservation =
        await PrescriptionFillAuthorisationService.cancelReservation({
          organisationId: params.organisationId,
          reservationId: params.reservationId,
          reason: body.reason,
        });

      return res.status(200).json(reservation);
    } catch (error) {
      return handleError(
        res,
        error,
        "cancel a prescription refill reservation",
      );
    }
  },
};
