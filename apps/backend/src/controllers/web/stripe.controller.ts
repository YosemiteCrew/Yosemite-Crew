import { Request, Response } from "express";
import { StripeService } from "src/services/stripe.service";
import { FinancePaymentError } from "src/services/finance/payment";
import { AuthUserMobileService } from "src/services/authUserMobile.service";
import {
  AppointmentPrismaService,
  AppointmentPrismaServiceError,
} from "src/services/appointment.prisma.service";
import logger from "src/utils/logger";
import { OrgRequest } from "src/middlewares/rbac";
import { AuthenticatedRequest } from "src/middlewares/auth";

/**
 * Verify, then handle - as two separate failures.
 *
 * Both steps used to share one try/catch that answered 400, which made a forged
 * signature and a database outage indistinguishable in the logs and on the
 * Stripe dashboard. They are different faults: a signature that does not verify
 * is the caller's, and no retry will ever fix it, while a handler that throws is
 * ours and the retry is the thing that saves the event.
 *
 * Stripe retries on any non-2xx, so this does not change delivery behaviour. It
 * changes what the failure says, which is what makes the difference visible when
 * one of these endpoints starts failing.
 */
const dispatchStripeWebhook = async (
  req: Request<unknown, unknown, Buffer>,
  res: Response,
  handler: {
    label: string;
    verify: (
      body: Buffer,
      signature: string | string[] | undefined,
    ) => ReturnType<typeof StripeService.verifyWebhook>;
  },
) => {
  const signature = req.headers["stripe-signature"];

  let event: ReturnType<typeof StripeService.verifyWebhook>;
  try {
    event = handler.verify(req.body, signature);
  } catch (err) {
    logger.error(`${handler.label} signature rejected:`, err);
    return res.status(400).json({
      error: err instanceof Error ? err.message : "Unknown error",
    });
  }

  try {
    await StripeService.handleWebhookEvent(event);
    return res.status(200).send("OK");
  } catch (err) {
    logger.error(`${handler.label} handler failed:`, err);
    return res.status(500).json({
      error: err instanceof Error ? err.message : "Unknown error",
    });
  }
};

// PMS routes are bound to the organisation the RBAC middleware authorized;
// mobile routes fall back to the pet parent linked to the session.
const resolveInvoiceScope = async (req: Request) => {
  const organisationId = (req as OrgRequest).organisationId;
  if (organisationId) {
    return { organisationId, parentId: null };
  }

  const authReq = req as AuthenticatedRequest;
  if (!authReq.userId) {
    return { organisationId: null, parentId: null };
  }

  const authUser = await AuthUserMobileService.getByProviderUserId(
    authReq.userId,
  );
  return { organisationId: null, parentId: authUser?.parentId ?? null };
};

const sendScopeError = (res: Response) =>
  res.status(403).json({ error: "Caller is not bound to a tenant" });

export const StripeController = {
  createOrGetConnectedAccount: async (req: Request, res: Response) => {
    try {
      const { organisationId } = req.params;
      const result =
        await StripeService.createOrGetConnectedAccount(organisationId);
      return res.status(200).json(result);
    } catch (err) {
      logger.error("Error createOrGetConnectedAccount:", err);
      return res.status(400).json({
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  },

  getAccountStatus: async (req: Request, res: Response) => {
    try {
      const { organisationId } = req.params;
      const result = await StripeService.getAccountStatus(organisationId);
      return res.status(200).json(result);
    } catch (err) {
      logger.error("Error getAccountStatus:", err);
      return res.status(400).json({
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  },

  // -------------------------
  // 🆕 SAAS BILLING
  // -------------------------

  /**
   * Create Checkout Session for Business plan
   */
  createBusinessCheckout: async (req: Request, res: Response) => {
    try {
      const { organisationId } = req.params;
      const body: unknown = req.body;
      const intervalValue =
        typeof body === "object" && body !== null && "interval" in body
          ? (body as { interval?: unknown }).interval
          : undefined;
      const interval =
        intervalValue === "month" || intervalValue === "year"
          ? intervalValue
          : undefined;

      if (!interval) {
        return res.status(400).json({
          error: "interval must be 'month' or 'year'",
        });
      }

      const result = await StripeService.createBusinessCheckoutSession(
        organisationId,
        interval,
      );

      return res.status(200).json(result);
    } catch (err) {
      logger.error("Error createBusinessCheckout:", err);
      return res.status(400).json({
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  },

  /**
   * Open Stripe Customer Portal
   */
  createBillingPortal: async (req: Request, res: Response) => {
    try {
      const { organisationId } = req.params;
      const result =
        await StripeService.createCustomerPortalSession(organisationId);
      return res.status(200).json(result);
    } catch (err) {
      logger.error("Error createBillingPortal:", err);
      return res.status(400).json({
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  },

  /**
   * Force sync seats (admin/debug)
   */
  syncSeats: async (req: Request, res: Response) => {
    try {
      const { organisationId } = req.params;
      const result = await StripeService.syncSubscriptionSeats(organisationId);
      return res.status(200).json(result);
    } catch (err) {
      logger.error("Error syncSeats:", err);
      return res.status(400).json({
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  },

  // -------------------------
  // EXISTING PAYMENT FLOWS
  // -------------------------

  refundPayment: async (req: Request, res: Response) => {
    try {
      const { paymentIntentId } = req.params;
      const result = await StripeService.refundPaymentIntent(paymentIntentId);
      return res.status(200).json(result);
    } catch (err) {
      logger.error("Error refundPayment:", err);
      return res.status(400).json({
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  },

  webhook: async (req: Request<unknown, unknown, Buffer>, res: Response) =>
    dispatchStripeWebhook(req, res, {
      label: "Stripe Webhook",
      verify: (body, sig) => StripeService.verifyWebhook(body, sig),
    }),

  connectWebhook: async (
    req: Request<unknown, unknown, Buffer>,
    res: Response,
  ) =>
    dispatchStripeWebhook(req, res, {
      label: "Stripe Connect Webhook",
      verify: (body, sig) => StripeService.verifyConnectWebhook(body, sig),
    }),

  createPaymentIntent: async (req: Request, res: Response) => {
    try {
      const { appointmentId } = req.params;
      if (!appointmentId) {
        return res.status(400).json({ error: "Appointment ID is required" });
      }

      const scope = await resolveInvoiceScope(req);
      if (!scope.organisationId && !scope.parentId) {
        return sendScopeError(res);
      }

      // Resolving through the caller's scope rejects an appointment they are
      // not bound to before a payment intent is minted for it.
      await AppointmentPrismaService.getById(
        appointmentId,
        scope.organisationId
          ? { organisationId: scope.organisationId }
          : { parentId: scope.parentId as string },
      );

      const paymentIntent =
        await StripeService.createPaymentIntentForAppointment(appointmentId);
      return res.status(200).json(paymentIntent);
    } catch (err) {
      logger.error("Error createPaymentIntent:", err);
      const statusCode =
        err instanceof AppointmentPrismaServiceError ? err.statusCode : 400;
      return res.status(statusCode).json({
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  },

  createPaymentIntentForInvoice: async (req: Request, res: Response) => {
    try {
      const { invoiceId } = req.params;
      const scope = await resolveInvoiceScope(req);
      if (!scope.organisationId && !scope.parentId) {
        return sendScopeError(res);
      }

      const paymentIntent = await StripeService.createPaymentIntentForInvoice(
        invoiceId,
        scope,
      );
      return res.status(200).json(paymentIntent);
    } catch (err) {
      if (err instanceof FinancePaymentError) {
        return res.status(err.statusCode).json({ error: err.message });
      }

      logger.error("Error createPaymentIntentForInvoice:", err);
      return res.status(400).json({
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  },

  retrievePaymentIntent: async (req: Request, res: Response) => {
    try {
      const { paymentIntentId } = req.params;
      const scope = await resolveInvoiceScope(req);
      if (!scope.organisationId && !scope.parentId) {
        return sendScopeError(res);
      }

      const paymentIntent = await StripeService.retrievePaymentIntent(
        paymentIntentId,
        scope,
      );
      return res.status(200).json(paymentIntent);
    } catch (err) {
      if (err instanceof FinancePaymentError) {
        return res.status(err.statusCode).json({ error: err.message });
      }

      logger.error("Error retrievePaymentIntent:", err);
      return res.status(400).json({
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  },

  retrieveCheckoutSession: async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;
      const session = await StripeService.retrieveCheckoutSession(sessionId);
      return res.status(200).json(session);
    } catch (err) {
      logger.error("Error retrieveCheckoutSession:", err);
      return res.status(400).json({
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  },

  createOnboardingLink: async (req: Request, res: Response) => {
    try {
      const { organisationId } = req.params;
      const result = await StripeService.createOnboardingLink(organisationId);
      return res.status(200).json(result);
    } catch (err) {
      logger.error("Error createOnboardingLink:", err);
      return res.status(400).json({
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  },
};
