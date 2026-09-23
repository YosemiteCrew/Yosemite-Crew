import { Request, Response } from "express";
import { ZodError, z } from "zod";
import {
  FinancePaymentError,
  FinancePaymentService,
} from "src/services/finance/payment";
import { FinanceSubscriptionService } from "src/services/finance/subscription";
import {
  FinanceEventService,
  resolveActorDisplayName,
} from "src/services/finance/events";
import {
  FinanceDiscountSettingsError,
  FinanceDiscountSettingsService,
} from "src/services/finance/discount-settings";
import {
  ProviderReceiptService,
  RECONCILIATION_STATUSES,
  type AllocateResult,
} from "src/services/finance/provider-receipt";
import { ProviderReceiptAuditService } from "src/services/finance/provider-receipt-audit";
import {
  ClientAccountService,
  type ClientAccountAllocationResult,
} from "src/services/finance/client-account";
import { parseKeysetCursor } from "src/services/shared/pagination";
import { StripeController } from "src/controllers/web/stripe.controller";
import { StripeService } from "src/services/stripe.service";
import {
  InvoiceService,
  InvoiceServiceError,
} from "src/services/invoice.service";
import { AuthUserMobileService } from "src/services/authUserMobile.service";
import {
  AppointmentPrismaService,
  AppointmentPrismaServiceError,
} from "src/services/appointment.prisma.service";
import logger from "src/utils/logger";
import { OrgRequest } from "src/middlewares/rbac";
import { resolveAuthorizedOrganisationId } from "src/middlewares/authorized-organisation";
import { AuthenticatedRequest } from "src/middlewares/auth";
import { resolveVerifiedUserId } from "src/utils/request";

const CreateInvoicePaymentSessionBodySchema = z.object({
  provider: z.string().trim().min(1).optional(),
  // Major units. Present when the caller is collecting a deposit rather than
  // the whole outstanding balance.
  depositAmount: z.number().positive().optional(),
});

const InvoiceItemBodySchema = z.object({
  name: z.string(),
  quantity: z.number(),
  unitPrice: z.number(),
  total: z.number(),
  description: z.string().optional(),
  discountPercent: z.number().optional(),
});

const CreateInvoiceBodySchema = z.object({
  appointmentId: z.string().trim().min(1),
  parentId: z.string().trim().min(1),
  patientId: z.string().trim().min(1),
  organisationId: z.string().trim().min(1),
  paymentCollectionMethod: z.string().trim().min(1),
  items: z.array(InvoiceItemBodySchema).min(1),
  invoiceDiscount: z
    .object({
      type: z.enum(["FIXED_AMOUNT", "PERCENTAGE"]),
      value: z.number(),
    })
    .optional(),
  notes: z.string().trim().min(1).optional(),
});

const UpdateDiscountSettingsBodySchema = z.object({
  maxOverallDiscountPercent: z.number().min(0).max(100).nullable(),
});

const FinalizeInvoiceBodySchema = z.object({
  taxProvider: z.string().trim().min(1).optional(),
});

const PreviewTaxBodySchema = z.object({
  taxProvider: z.string().trim().min(1).optional(),
});

const CurrentSubscriptionQuerySchema = z.object({
  organisationId: z.string().trim().min(1),
});

const UpsertSubscriptionBodySchema = z.object({
  organisationId: z.string().trim().min(1),
  planCode: z.string().trim().min(1),
  provider: z.string().trim().min(1),
  providerSubscriptionId: z.string().trim().min(1),
  quantity: z.number().int().nonnegative(),
});

const UsageSnapshotsQuerySchema = z.object({
  organisationId: z.string().trim().min(1),
  subscriptionId: z.string().trim().min(1).optional(),
  featureKey: z.string().trim().min(1).optional(),
});

const VisitMilestoneBodySchema = z.object({
  milestone: z.enum([
    "BOOKED",
    "CHECKED_IN",
    "IN_PROGRESS",
    "ADDITIONAL_CHARGE_ADDED",
    "READY_FOR_BILLING",
    "VISIT_ENDED",
    "DISCHARGED",
    "HOSPITALIZATION_STARTED",
    "HOSPITALIZATION_EXTENDED",
    "HOSPITALIZATION_DISCHARGED",
  ]),
  organisationId: z.string().trim().min(1),
  appointmentId: z.string().trim().min(1).optional(),
  patientId: z.string().trim().min(1).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const ReadyForBillingBodySchema = z.object({
  visitId: z.string().trim().min(1).optional(),
  notes: z.string().trim().min(1).optional(),
});

const ProviderParamsSchema = z.object({
  provider: z.string().trim().min(1),
});

const SubscriptionCustomerBodySchema = z.object({
  externalCustomerId: z.string().trim().min(1),
});

const SubscriptionCheckoutCompletedBodySchema = z.object({
  customerId: z.string().trim().min(1),
  subscriptionId: z.string().trim().min(1),
  subscriptionItemId: z.string().trim().min(1),
  priceId: z.string().trim().min(1),
  productId: z.string().trim().min(1).optional(),
  billingInterval: z.enum(["month", "year"]).optional(),
  subscriptionStatus: z
    .enum([
      "none",
      "trialing",
      "active",
      "past_due",
      "unpaid",
      "canceled",
      "incomplete",
      "incomplete_expired",
      "paused",
    ])
    .optional(),
  cancelAtPeriodEnd: z.boolean().optional(),
  currentPeriodStart: z.iso.datetime().optional(),
  currentPeriodEnd: z.iso.datetime().optional(),
  livemode: z.boolean().optional(),
  seatQuantity: z.number().int().nonnegative().optional(),
});

const SubscriptionUpdatedBodySchema = z.object({
  subscriptionId: z.string().trim().min(1),
  subscriptionStatus: z
    .enum([
      "none",
      "trialing",
      "active",
      "past_due",
      "unpaid",
      "canceled",
      "incomplete",
      "incomplete_expired",
      "paused",
    ])
    .optional(),
  cancelAtPeriodEnd: z.boolean().optional(),
  canceledAt: z.iso.datetime().optional(),
  seatQuantity: z.number().int().nonnegative().optional(),
  currentPeriodStart: z.iso.datetime().optional(),
  currentPeriodEnd: z.iso.datetime().optional(),
});

const SubscriptionLifecycleBodySchema = z.object({
  subscriptionId: z.string().trim().min(1),
  invoiceId: z.string().trim().min(1).optional(),
});

const UsageEventBodySchema = z.object({
  usageKey: z.string().trim().min(1),
  quantity: z.number().int().positive(),
  billableQuantity: z.number().int().positive().optional(),
  source: z.string().trim().min(1),
  referenceType: z.string().trim().min(1).optional(),
  referenceId: z.string().trim().min(1).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  occurredAt: z.iso.datetime().optional(),
});

const UsageSnapshotBodySchema = z.object({
  snapshotType: z.string().trim().min(1).optional(),
  seatsActive: z.number().int().nonnegative().optional(),
  seatsBillable: z.number().int().nonnegative().optional(),
  appointmentsUsed: z.number().int().nonnegative().optional(),
  toolsUsed: z.number().int().nonnegative().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  snapshotAt: z.iso.datetime().optional(),
});

const RecordInvoicePaymentBodySchema = z.object({
  provider: z.string().trim().min(1).optional(),
  settlementChannel: z.string().trim().min(1).optional(),
  amount: z.number().positive(),
  currency: z.string().trim().min(1).optional(),
  reference: z.string().trim().min(1).optional(),
  receivedAt: z.iso.datetime().optional(),
});

const CloseoutInvoiceBodySchema = z.object({
  settlementChannel: z.string().trim().min(1).optional(),
  reference: z.string().trim().min(1).optional(),
  receivedAt: z.iso.datetime().optional(),
});

const RefundPaymentBodySchema = z.object({
  amount: z.number().positive(),
  reason: z.string().trim().min(1).optional(),
});

const VoidInvoiceBodySchema = z.object({
  reason: z.string().trim().min(1).optional(),
});

const SupplementInvoiceBodySchema = z.object({
  items: z.array(InvoiceItemBodySchema).min(1),
});

const ListInvoicesQuerySchema = z.object({
  organisationId: z.string().trim().min(1).optional(),
  appointmentId: z.string().trim().min(1).optional(),
  parentId: z.string().trim().min(1).optional(),
  patientId: z.string().trim().min(1).optional(),
});

/**
 * The reconciliation queue's filters.
 *
 * `status` is accepted once or repeated, because that is what Express hands
 * over for `?status=A&status=B` and a queue is worked by state. The enum comes
 * from the model, so a state added to the schema cannot be silently rejected
 * here as unknown.
 *
 * The dates are ISO 8601 with an offset, not bare dates. A reconciliation
 * window read in the operator's local midnight and applied against a UTC
 * `capturedAt` moves the boundary by hours, so the caller states the instant
 * and there is nothing to infer from a device timezone.
 *
 * `limit` is a string here and clamped in the service rather than rejected:
 * the bound is the service's to own, and a caller asking for more gets a
 * bounded page and the `limit` it actually got back in `meta`.
 */
const ProviderReceiptQuerySchema = z.object({
  status: z
    .union([
      z.enum(RECONCILIATION_STATUSES),
      z.array(z.enum(RECONCILIATION_STATUSES)),
    ])
    .optional(),
  capturedFrom: z.iso.datetime({ offset: true }).optional(),
  capturedTo: z.iso.datetime({ offset: true }).optional(),
  limit: z.string().optional(),
});

/**
 * The filter for the historical mismatch audit (#3170 delivery 4).
 *
 * The bounds are named `recorded*` rather than `captured*` because that is
 * genuinely which clock they read: the audit windows on when the payment was
 * recorded here, since `paidAt` is nullable and a window built from it would
 * silently omit every settled payment that has none. Naming them after the
 * capture would be a friendlier lie.
 *
 * Same offset rule as the reconciliation queue, for the same reason - a window
 * taken at the operator's local midnight and applied against a UTC column
 * moves the boundary by hours, so the caller states the instant.
 */
const ProviderReceiptAuditQuerySchema = z.object({
  recordedFrom: z.iso.datetime({ offset: true }).optional(),
  recordedTo: z.iso.datetime({ offset: true }).optional(),
  limit: z.string().optional(),
});

/**
 * One operator decision to apply a captured payment to invoices.
 *
 * `expectedVersion` and `idempotencyKey` are both required rather than
 * optional, and neither substitutes for the other. The version says which
 * state the decision was taken from, so a refund or another operator landing
 * in between loses the write; the key says which decision this is, so a retry
 * after a timeout is recognised as the same one. A client that omitted either
 * would double-post money under exactly the conditions this endpoint exists to
 * survive, so there is no default for either.
 *
 * Bounded at twenty lines. An operator splitting one capture across invoices
 * is working through a handful, and the endpoint posts them sequentially -
 * leaving the list unbounded would let one request hold a connection for as
 * long as the caller liked.
 */
const ProviderReceiptAllocationBodySchema = z.object({
  expectedVersion: z.number().int().min(0),
  idempotencyKey: z.string().trim().min(1).max(200),
  allocations: z
    .array(
      z.object({
        invoiceId: z.uuid(),
        // Major units, and strictly positive: a zero or negative line is not a
        // smaller allocation, it is a different operation this route does not
        // perform. `z.number()` already refuses NaN and Infinity in Zod 4, so
        // no separate finiteness guard is needed - and one written as
        // `.finite()` is deprecated.
        amount: z.number().positive(),
      }),
    )
    .min(1)
    .max(20),
});

/**
 * How each refusal is answered.
 *
 * Separated from the handler so the mapping can be read as a table. Every
 * refusal that is about the state the caller decided from is a 409, and every
 * one that is about the objects they named is a 404 or a 409 on the object -
 * a 400 would tell them to fix a request that was well formed.
 */
const PROVIDER_RECEIPT_ALLOCATION_FAILURES: Record<
  Exclude<AllocateResult["outcome"], "APPLIED" | "REPLAYED">,
  { status: number; message: string }
> = {
  NOT_FOUND: { status: 404, message: "Receipt not found." },
  NOT_ATTRIBUTED: {
    status: 409,
    message:
      "This capture has not been attributed to an organisation yet, so it cannot be applied.",
  },
  FULLY_REFUNDED: {
    status: 409,
    message:
      "This capture has been refunded in full; there is nothing to apply.",
  },
  VERSION_CONFLICT: {
    status: 409,
    message:
      "The receipt changed since it was read. Reload it and submit the allocation again.",
  },
  ACCOUNT_MISMATCH: {
    status: 409,
    message:
      "The money for this capture is not held in this organisation's connected account.",
  },
  EXCEEDS_RESIDUAL: {
    status: 409,
    message:
      "The requested allocation is more than this capture has left to apply.",
  },
  INVOICE_NOT_ELIGIBLE: {
    status: 409,
    message: "An invoice in this allocation cannot take this payment.",
  },
};

/**
 * A reviewed plan handed back for confirmation (#3163).
 *
 * The body is the proposal's own shape rather than a flat list of lines,
 * because each capture carries the version it was planned from and a flat list
 * would have nowhere to put it.
 *
 * One `idempotencyKey` for the whole plan and not one per capture. It is one
 * decision an operator took once, and a per-capture key would let a retry
 * repeat half of it as a new decision.
 *
 * Bounded on both axes. Each capture is applied sequentially and each line
 * within it posts sequentially, so an unbounded plan is an unbounded request.
 */
const ClientAccountAllocationBodySchema = z.object({
  idempotencyKey: z.string().trim().min(1).max(200),
  receipts: z
    .array(
      z.object({
        receiptId: z.uuid(),
        expectedVersion: z.number().int().min(0),
        allocations: z
          .array(
            z.object({
              invoiceId: z.uuid(),
              // Strictly positive, as on the per-capture route: a zero or
              // negative line is a different operation, not a smaller one.
              amount: z.number().positive(),
            }),
          )
          .min(1)
          .max(20),
      }),
    )
    .min(1)
    .max(20),
});

/**
 * How each zero-write refusal of a plan is answered.
 *
 * Both are 409 rather than 404. A 404 on the capture would confirm to anyone
 * who can guess an id that it exists somewhere else in this organisation, and
 * "this is not that client's" is a conflict between the request and the
 * account it was sent to, not a missing object.
 */
const CLIENT_ACCOUNT_ALLOCATION_FAILURES: Record<
  Exclude<ClientAccountAllocationResult["outcome"], "APPLIED" | "STOPPED">,
  string
> = {
  DUPLICATE_RECEIPT: "Each capture may appear at most once in a plan.",
  RECEIPT_NOT_THIS_CLIENT:
    "A capture in this plan does not belong to this client's account.",
  INVOICE_NOT_THIS_CLIENT:
    "An invoice in this plan does not belong to this client.",
};

const normalizeProvider = (value?: string) =>
  value?.trim().toUpperCase() ?? "STRIPE";

const isSupportedSubscriptionProvider = (provider: string) =>
  provider === "STRIPE";

const toFinanceSuccess = <T>(data: T) => ({
  data,
  meta: null,
  error: null,
});

const resolveMobileParentId = async (req: Request) => {
  const authReq = req as AuthenticatedRequest;
  if (!authReq.userId) return null;

  const authUser = await AuthUserMobileService.getByProviderUserId(
    authReq.userId,
  );
  return authUser?.parentId ?? null;
};

// Web routes are bound to the organisation the RBAC middleware authorized;
// mobile routes fall back to the pet parent linked to the session.
const resolveInvoiceScope = async (req: Request) => {
  const organisationId = (req as OrgRequest).organisationId;
  if (organisationId) {
    return { organisationId, parentId: null };
  }

  const parentId = await resolveMobileParentId(req);
  return { organisationId: null, parentId };
};

type SubscriptionRequestContext = {
  organisationId: string;
  provider: string;
};

// Shared prologue for the subscription relay handlers: require the
// organisation path param, then validate and normalise the provider. Writes
// the 400 response and returns null when any check fails.
const parseSubscriptionRequest = (
  req: Request,
  res: Response,
): SubscriptionRequestContext | null => {
  const organisationId = req.params.organisationId;
  if (!organisationId) {
    res.status(400).json({ message: "Organisation Id is required" });
    return null;
  }

  const providerResult = ProviderParamsSchema.safeParse(req.params);
  if (!providerResult.success) {
    res.status(400).json({ message: "Invalid provider" });
    return null;
  }

  const provider = normalizeProvider(providerResult.data.provider);
  if (!isSupportedSubscriptionProvider(provider)) {
    res.status(400).json({ message: "Unsupported provider" });
    return null;
  }

  return { organisationId, provider };
};

// The lifecycle relays (deleted / invoice paid / invoice failed) additionally
// share the SubscriptionLifecycleBodySchema request body.
const parseSubscriptionLifecycleRequest = (
  req: Request,
  res: Response,
):
  | (SubscriptionRequestContext & {
      subscriptionId: string;
      invoiceId: string | null;
    })
  | null => {
  const context = parseSubscriptionRequest(req, res);
  if (!context) {
    return null;
  }

  const body = SubscriptionLifecycleBodySchema.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ message: "Invalid request body" });
    return null;
  }

  return {
    ...context,
    subscriptionId: body.data.subscriptionId,
    invoiceId: body.data.invoiceId ?? null,
  };
};

export const FinanceController = {
  async getDiscountSettings(this: void, req: Request, res: Response) {
    try {
      const organisationId = req.params.organisationId;
      if (!organisationId) {
        return res.status(400).json({ message: "Organisation Id is required" });
      }

      const settings =
        await FinanceDiscountSettingsService.getForOrganisation(organisationId);
      return res.status(200).json(toFinanceSuccess(settings));
    } catch (error) {
      const statusCode =
        error instanceof FinanceDiscountSettingsError ? error.statusCode : 500;
      const message =
        error instanceof FinanceDiscountSettingsError
          ? error.message
          : "Internal server error";

      logger.error("Error fetching organisation discount settings", error);
      return res.status(statusCode).json({ message });
    }
  },

  async updateDiscountSettings(this: void, req: Request, res: Response) {
    try {
      const organisationId = req.params.organisationId;
      if (!organisationId) {
        return res.status(400).json({ message: "Organisation Id is required" });
      }

      const body = UpdateDiscountSettingsBodySchema.safeParse(req.body);
      if (!body.success) {
        return res.status(400).json({ message: "Invalid request body" });
      }

      const settings =
        await FinanceDiscountSettingsService.updateForOrganisation(
          organisationId,
          { maxOverallDiscountPercent: body.data.maxOverallDiscountPercent },
        );

      return res.status(200).json(toFinanceSuccess(settings));
    } catch (error) {
      const statusCode =
        error instanceof FinanceDiscountSettingsError ? error.statusCode : 500;
      const message =
        error instanceof FinanceDiscountSettingsError
          ? error.message
          : "Internal server error";

      logger.error("Error updating organisation discount settings", error);
      return res.status(statusCode).json({ message });
    }
  },

  async createInvoice(this: void, req: Request, res: Response) {
    try {
      const body = CreateInvoiceBodySchema.safeParse(req.body);
      if (!body.success) {
        return res.status(400).json({ message: "Invalid request body" });
      }

      const organisationId = resolveAuthorizedOrganisationId(
        req,
        res,
        body.data.organisationId,
      );
      if (!organisationId) return;

      const items = body.data.items.map((item) => ({
        ...item,
        description: item.description ?? item.name,
      }));

      const invoice = await InvoiceService.createDraftForAppointment({
        appointmentId: body.data.appointmentId,
        parentId: body.data.parentId,
        patientId: body.data.patientId,
        organisationId,
        paymentCollectionMethod: body.data.paymentCollectionMethod as
          "PAYMENT_INTENT" | "PAYMENT_LINK" | "PAYMENT_AT_CLINIC",
        items,
        invoiceDiscount: body.data.invoiceDiscount,
        notes: body.data.notes,
      });

      return res.status(201).json(toFinanceSuccess(invoice));
    } catch (error) {
      const statusCode =
        error instanceof InvoiceServiceError ? error.statusCode : 500;
      const message =
        error instanceof InvoiceServiceError
          ? error.message
          : "Internal server error";

      logger.error("Error creating invoice", error);
      return res.status(statusCode).json({ message });
    }
  },

  async listInvoices(this: void, req: Request, res: Response) {
    try {
      const query = ListInvoicesQuerySchema.safeParse(req.query);
      if (!query.success) {
        return res.status(400).json({ message: "Invalid request query" });
      }

      const filters = query.data;
      // Tenant scope must come from the org authorized by withOrgPermissions
      // (which may be supplied via header/param), not the raw query value.
      const authorizedOrganisationId =
        (req as OrgRequest).organisationId ?? filters.organisationId;
      const resolved = {
        organisationId: filters.organisationId,
        appointmentId: filters.appointmentId,
        parentId: filters.parentId,
        patientId: filters.patientId,
      };

      if (
        !resolved.organisationId &&
        !resolved.appointmentId &&
        !resolved.parentId &&
        !resolved.patientId
      ) {
        return res.status(400).json({
          message:
            "At least one of organisationId, appointmentId, parentId, or patientId is required",
        });
      }

      if (!authorizedOrganisationId) {
        return res.status(400).json({ message: "Organisation Id is required" });
      }

      if (resolved.appointmentId) {
        const invoices = await InvoiceService.getByAppointmentId(
          resolved.appointmentId,
          { organisationId: authorizedOrganisationId },
        );
        return res.status(200).json(toFinanceSuccess(invoices));
      }

      if (resolved.organisationId) {
        const invoices = await InvoiceService.listForOrganisation(
          authorizedOrganisationId,
        );
        return res.status(200).json(toFinanceSuccess(invoices));
      }

      if (resolved.parentId) {
        const invoices = await InvoiceService.listForParent(
          resolved.parentId,
          authorizedOrganisationId,
        );
        return res.status(200).json(toFinanceSuccess(invoices));
      }

      const invoices = await InvoiceService.listForCompanion(
        resolved.patientId as string,
        authorizedOrganisationId,
      );
      return res.status(200).json(toFinanceSuccess(invoices));
    } catch (error) {
      logger.error("Error listing invoices", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  },

  async listInvoicesForOrganisation(this: void, req: Request, res: Response) {
    try {
      const organisationId = req.params.organisationId;
      if (!organisationId) {
        return res.status(400).json({ message: "Organisation Id is required" });
      }

      const authorizedOrganisationId = (req as OrgRequest).organisationId;
      if (
        !authorizedOrganisationId ||
        authorizedOrganisationId !== organisationId
      ) {
        return res.status(404).json({ message: "Organisation not found" });
      }

      const invoices = await InvoiceService.listForOrganisation(organisationId);
      return res.status(200).json(toFinanceSuccess(invoices));
    } catch (error) {
      logger.error("Error fetching organisation invoices", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  },

  async addInvoiceItems(this: void, req: Request, res: Response) {
    try {
      const invoiceId = req.params.invoiceId;
      if (!invoiceId) {
        return res.status(400).json({ message: "Invoice Id is required" });
      }

      const body = SupplementInvoiceBodySchema.safeParse(req.body);
      if (!body.success) {
        return res.status(400).json({ message: "Invalid request body" });
      }

      const invoice = await InvoiceService.addItemsToInvoice(
        invoiceId,
        body.data.items,
      );

      return res.status(200).json(toFinanceSuccess(invoice));
    } catch (error) {
      const statusCode =
        error instanceof InvoiceServiceError ? error.statusCode : 500;
      const message =
        error instanceof InvoiceServiceError
          ? error.message
          : "Internal server error";

      logger.error("Error adding invoice items", error);
      return res.status(statusCode).json({ message });
    }
  },

  async listInvoicesForAppointment(this: void, req: Request, res: Response) {
    try {
      const appointmentId = req.params.appointmentId;
      if (!appointmentId) {
        return res.status(400).json({ message: "Appointment Id is required" });
      }

      const scope = await resolveInvoiceScope(req);
      if (!scope.organisationId && !scope.parentId) {
        return res.status(403).json({
          message: "Parent account is not linked to this mobile user",
        });
      }

      const invoices = await InvoiceService.getByAppointmentId(
        appointmentId,
        scope,
      );

      return res.status(200).json(toFinanceSuccess(invoices));
    } catch (error) {
      const statusCode =
        error instanceof InvoiceServiceError ? error.statusCode : 500;
      const message =
        error instanceof InvoiceServiceError
          ? error.message
          : "Internal server error";

      logger.error("Error fetching appointment invoices", error);
      return res.status(statusCode).json({ message });
    }
  },

  async listInvoicesForParent(this: void, req: Request, res: Response) {
    try {
      const parentId = req.params.parentId;
      if (!parentId) {
        return res.status(400).json({ message: "Parent Id is required" });
      }

      const authReq = req as AuthenticatedRequest;
      if (authReq.userId) {
        const authUser = await AuthUserMobileService.getByProviderUserId(
          authReq.userId,
        );
        if (!authUser?.parentId) {
          return res.status(403).json({
            message: "Parent account is not linked to this mobile user",
          });
        }

        if (authUser.parentId !== parentId) {
          return res.status(403).json({
            message: "Cannot access invoices for another parent",
          });
        }
      }

      const invoices = await InvoiceService.listForParent(
        parentId,
        (req as OrgRequest).organisationId ?? null,
      );
      return res.status(200).json(toFinanceSuccess(invoices));
    } catch (error) {
      logger.error("Error fetching parent invoices", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  },

  async getInvoiceById(this: void, req: Request, res: Response) {
    try {
      const invoiceId = req.params.invoiceId;
      if (!invoiceId) {
        return res.status(400).json({ message: "Invoice Id is required" });
      }

      const scope = await resolveInvoiceScope(req);
      if (!scope.organisationId && !scope.parentId) {
        return res.status(403).json({
          message: "Parent account is not linked to this mobile user",
        });
      }

      const invoice = await InvoiceService.getById(invoiceId, scope);
      return res.status(200).json(toFinanceSuccess(invoice));
    } catch (error) {
      const statusCode =
        error instanceof InvoiceServiceError ? error.statusCode : 500;
      const message =
        error instanceof InvoiceServiceError
          ? error.message
          : "Internal server error";

      logger.error("Error fetching invoice by ID", error);
      return res.status(statusCode).json({ message });
    }
  },

  async retrievePaymentIntent(this: void, req: Request, res: Response) {
    try {
      const paymentIntentId = req.params.paymentIntentId;
      if (!paymentIntentId) {
        return res
          .status(400)
          .json({ message: "Payment Intent Id is required" });
      }

      const scope = await resolveInvoiceScope(req);
      if (!scope.organisationId && !scope.parentId) {
        return res.status(403).json({
          message: "Parent account is not linked to this mobile user",
        });
      }

      const paymentIntent = await StripeService.retrievePaymentIntent(
        paymentIntentId,
        scope,
      );

      return res.status(200).json(toFinanceSuccess(paymentIntent));
    } catch (error) {
      if (error instanceof FinancePaymentError) {
        return res.status(error.statusCode).json({ message: error.message });
      }

      logger.error("Error retrieving payment intent", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  },

  async bootstrapInvoiceForAppointment(
    this: void,
    req: Request,
    res: Response,
  ) {
    try {
      const appointmentId = req.params.appointmentId;
      if (!appointmentId) {
        return res.status(400).json({ message: "Appointment Id is required" });
      }

      const parentId = await resolveMobileParentId(req);
      if (!parentId) {
        return res.status(403).json({ message: "Forbidden" });
      }

      // Resolving through the parent scope rejects an appointment the caller
      // is not linked to before any invoice is created for it.
      await AppointmentPrismaService.getById(appointmentId, { parentId });

      const invoice =
        await InvoiceService.bootstrapForAppointment(appointmentId);
      return res.status(200).json(toFinanceSuccess(invoice));
    } catch (error) {
      const isKnownError =
        error instanceof InvoiceServiceError ||
        error instanceof AppointmentPrismaServiceError;
      const statusCode = isKnownError ? error.statusCode : 500;
      const message = isKnownError ? error.message : "Internal server error";

      logger.error("Error bootstrapping appointment invoice", error);
      return res.status(statusCode).json({ message });
    }
  },

  async finalizeInvoice(this: void, req: Request, res: Response) {
    try {
      const invoiceId = req.params.invoiceId;
      if (!invoiceId) {
        return res.status(400).json({ message: "Invoice Id is required" });
      }

      const body = FinalizeInvoiceBodySchema.safeParse(req.body);
      if (!body.success) {
        return res.status(400).json({ message: "Invalid request body" });
      }

      const invoice = await InvoiceService.finalizeTaxForInvoice(
        invoiceId,
        body.data.taxProvider,
      );

      return res.status(200).json(toFinanceSuccess(invoice));
    } catch (error) {
      const statusCode =
        error instanceof InvoiceServiceError ? error.statusCode : 500;
      const message =
        error instanceof InvoiceServiceError
          ? error.message
          : "Internal server error";

      logger.error("Error finalizing invoice", error);
      return res.status(statusCode).json({ message });
    }
  },

  async settleInvoiceAtCloseout(this: void, req: Request, res: Response) {
    try {
      const invoiceId = req.params.invoiceId;
      if (!invoiceId) {
        return res.status(400).json({ message: "Invoice Id is required" });
      }

      const body = CloseoutInvoiceBodySchema.safeParse(req.body);
      if (!body.success) {
        return res.status(400).json({ message: "Invalid request body" });
      }

      const organisationId = (req as OrgRequest).organisationId;
      if (!organisationId) {
        return res.status(400).json({ message: "Organisation Id is required" });
      }

      const invoice = await InvoiceService.settleInvoiceAtCloseout(
        invoiceId,
        organisationId,
        {
          settlementChannel: body.data.settlementChannel as
            | "CASH"
            | "BANK_TRANSFER"
            | "CARD_PRESENT"
            | "DEPOSIT"
            | "OTHER"
            | undefined,
          reference: body.data.reference,
          receivedAt: body.data.receivedAt
            ? new Date(body.data.receivedAt)
            : undefined,
        },
      );

      return res.status(200).json(toFinanceSuccess(invoice));
    } catch (error) {
      const statusCode =
        error instanceof InvoiceServiceError ||
        error instanceof FinancePaymentError
          ? error.statusCode
          : 500;
      const message =
        error instanceof InvoiceServiceError ||
        error instanceof FinancePaymentError
          ? error.message
          : "Internal server error";

      logger.error("Error settling invoice at closeout", error);
      return res.status(statusCode).json({ message });
    }
  },

  async previewInvoiceTax(this: void, req: Request, res: Response) {
    try {
      const invoiceId = req.params.invoiceId;
      if (!invoiceId) {
        return res.status(400).json({ message: "Invoice Id is required" });
      }

      const body = PreviewTaxBodySchema.safeParse(req.body);
      if (!body.success) {
        return res.status(400).json({ message: "Invalid request body" });
      }

      const preview = await InvoiceService.previewTaxForInvoice(
        invoiceId,
        body.data.taxProvider,
      );
      return res.status(200).json(toFinanceSuccess(preview));
    } catch (error) {
      const statusCode =
        error instanceof InvoiceServiceError ? error.statusCode : 500;
      const message =
        error instanceof InvoiceServiceError
          ? error.message
          : "Internal server error";

      logger.error("Error previewing invoice tax", error);
      return res.status(statusCode).json({ message });
    }
  },

  async getSubscriptionOverview(this: void, req: Request, res: Response) {
    try {
      const organisationId = req.params.organisationId;
      if (!organisationId) {
        return res.status(400).json({ message: "Organisation Id is required" });
      }

      const overview =
        await FinanceSubscriptionService.getSubscriptionOverview(
          organisationId,
        );
      return res.status(200).json(toFinanceSuccess(overview));
    } catch (error) {
      logger.error("Error fetching subscription overview", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  },

  async getSubscriptionSeatSyncPlan(this: void, req: Request, res: Response) {
    try {
      const organisationId = req.params.organisationId;
      if (!organisationId) {
        return res.status(400).json({ message: "Organisation Id is required" });
      }

      const plan =
        await FinanceSubscriptionService.resolveSubscriptionSeatSyncPlan(
          organisationId,
        );
      return res.status(200).json(toFinanceSuccess(plan));
    } catch (error) {
      logger.error("Error resolving subscription seat sync plan", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  },

  async getUsageOverview(this: void, req: Request, res: Response) {
    try {
      const organisationId = req.params.organisationId;
      if (!organisationId) {
        return res.status(400).json({ message: "Organisation Id is required" });
      }

      const overview =
        await FinanceSubscriptionService.getUsageOverview(organisationId);
      return res.status(200).json(toFinanceSuccess(overview));
    } catch (error) {
      logger.error("Error fetching usage overview", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  },

  async getCurrentSubscription(this: void, req: Request, res: Response) {
    try {
      const query = CurrentSubscriptionQuerySchema.safeParse(req.query);
      if (!query.success) {
        return res.status(400).json({ message: "Invalid request query" });
      }

      const organisationId = resolveAuthorizedOrganisationId(
        req,
        res,
        query.data.organisationId,
      );
      if (!organisationId) return;

      const current =
        await FinanceSubscriptionService.getCurrentSubscription(organisationId);

      return res.status(200).json(toFinanceSuccess(current));
    } catch (error) {
      logger.error("Error fetching current subscription", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  },

  async upsertSubscription(this: void, req: Request, res: Response) {
    try {
      const body = UpsertSubscriptionBodySchema.safeParse(req.body);
      if (!body.success) {
        return res.status(400).json({ message: "Invalid request body" });
      }

      const organisationId = resolveAuthorizedOrganisationId(
        req,
        res,
        body.data.organisationId,
      );
      if (!organisationId) return;

      const subscription = await FinanceSubscriptionService.upsertSubscription({
        orgId: organisationId,
        planCode: body.data.planCode,
        provider: body.data.provider,
        providerSubscriptionId: body.data.providerSubscriptionId,
        quantity: body.data.quantity,
      });

      return res.status(201).json(toFinanceSuccess(subscription));
    } catch (error) {
      logger.error("Error upserting subscription", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  },

  async getUsageSnapshots(this: void, req: Request, res: Response) {
    try {
      const query = UsageSnapshotsQuerySchema.safeParse(req.query);
      if (!query.success) {
        return res.status(400).json({ message: "Invalid request query" });
      }

      const organisationId = resolveAuthorizedOrganisationId(
        req,
        res,
        query.data.organisationId,
      );
      if (!organisationId) return;

      const snapshots = await FinanceSubscriptionService.listUsageSnapshots(
        organisationId,
        {
          subscriptionId: query.data.subscriptionId ?? null,
          featureKey: query.data.featureKey ?? null,
        },
      );

      return res.status(200).json(toFinanceSuccess(snapshots));
    } catch (error) {
      logger.error("Error fetching usage snapshots", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  },

  async recordSubscriptionCustomer(this: void, req: Request, res: Response) {
    try {
      const context = parseSubscriptionRequest(req, res);
      if (!context) {
        return res;
      }

      const body = SubscriptionCustomerBodySchema.safeParse(req.body);
      if (!body.success) {
        return res.status(400).json({ message: "Invalid request body" });
      }

      await FinanceSubscriptionService.recordBusinessCheckoutCustomer({
        orgId: context.organisationId,
        externalCustomerId: body.data.externalCustomerId,
      });

      return res.status(200).json(
        toFinanceSuccess({
          organisationId: context.organisationId,
          provider: context.provider,
          externalCustomerId: body.data.externalCustomerId,
        }),
      );
    } catch (error) {
      logger.error("Error recording subscription customer", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  },

  async recordVisitMilestone(this: void, req: Request, res: Response) {
    try {
      const visitId = req.params.visitId;
      if (!visitId) {
        return res.status(400).json({ message: "Visit Id is required" });
      }

      const body = VisitMilestoneBodySchema.safeParse(req.body);
      if (!body.success) {
        return res.status(400).json({ message: "Invalid request body" });
      }

      // The route has no organisation path param, so withOrgPermissions can
      // only authorize the body org; the appointment must be inside it.
      const authorizedOrganisationId = (req as OrgRequest).organisationId;
      if (
        !authorizedOrganisationId ||
        authorizedOrganisationId !== body.data.organisationId
      ) {
        return res
          .status(403)
          .json({ message: "Organisation is not authorized" });
      }

      const appointmentId = body.data.appointmentId ?? visitId;
      const shouldReadyForBilling = body.data.milestone === "READY_FOR_BILLING";
      const invoice = shouldReadyForBilling
        ? await InvoiceService.markAppointmentReadyForBilling(appointmentId, {
            organisationId: authorizedOrganisationId,
          })
        : null;

      if (shouldReadyForBilling && !invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }

      await FinanceEventService.recordEvent({
        organisationId: body.data.organisationId,
        eventType: "VISIT_MILESTONE_RECORDED",
        entityType: "VISIT",
        entityId: visitId,
        payload: {
          milestone: body.data.milestone,
          appointmentId,
          patientId: body.data.patientId ?? null,
          metadata: body.data.metadata ?? null,
        },
      });

      return res.status(201).json(
        toFinanceSuccess({
          visitId,
          appointmentId,
          milestone: body.data.milestone,
          billingState: invoice?.visitBillingStage ?? null,
          invoiceId: invoice?.id ?? null,
          collectionMode: invoice?.billingCollectionMode ?? null,
        }),
      );
    } catch (error) {
      logger.error("Error recording visit milestone", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  },

  async markAppointmentReadyForBilling(
    this: void,
    req: Request,
    res: Response,
  ) {
    try {
      const appointmentId = req.params.appointmentId;
      if (!appointmentId) {
        return res.status(400).json({ message: "Appointment Id is required" });
      }

      const body = ReadyForBillingBodySchema.safeParse(req.body);
      if (!body.success) {
        return res.status(400).json({ message: "Invalid request body" });
      }

      const organisationId = (req as OrgRequest).organisationId;
      if (!organisationId) {
        return res.status(400).json({ message: "Organisation Id is required" });
      }

      const actorUserId = resolveVerifiedUserId(req);
      const invoice = await InvoiceService.markAppointmentReadyForBilling(
        appointmentId,
        { organisationId, actorUserId },
      );
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }

      const actorName = await resolveActorDisplayName(actorUserId);

      await FinanceEventService.recordEvent({
        organisationId: (req as OrgRequest).organisationId ?? null,
        eventType: "APPOINTMENT_READY_FOR_BILLING",
        entityType: "APPOINTMENT",
        entityId: appointmentId,
        payload: {
          visitId: body.data.visitId ?? null,
          notes: body.data.notes ?? null,
          invoiceId: invoice.id,
          billingState: invoice.visitBillingStage,
          collectionMode: invoice.billingCollectionMode ?? null,
          actorUserId: actorUserId ?? null,
          actorName,
        },
      });

      return res.status(200).json(
        toFinanceSuccess({
          appointmentId,
          billingState: invoice.visitBillingStage,
          invoiceId: invoice.id,
          collectionMode: invoice.billingCollectionMode ?? null,
        }),
      );
    } catch (error) {
      logger.error("Error marking appointment ready for billing", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  },

  async reverseAppointmentReadyForBilling(
    this: void,
    req: Request,
    res: Response,
  ) {
    try {
      const appointmentId = req.params.appointmentId;
      if (!appointmentId) {
        return res.status(400).json({ message: "Appointment Id is required" });
      }

      const organisationId = (req as OrgRequest).organisationId;
      if (!organisationId) {
        return res.status(400).json({ message: "Organisation Id is required" });
      }

      const invoice = await InvoiceService.reverseAppointmentReadyForBilling(
        appointmentId,
        { organisationId, actorUserId: resolveVerifiedUserId(req) },
      );
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }

      await FinanceEventService.recordEvent({
        organisationId: (req as OrgRequest).organisationId ?? null,
        eventType: "APPOINTMENT_READY_FOR_BILLING_REVERSED",
        entityType: "APPOINTMENT",
        entityId: appointmentId,
        payload: {
          invoiceId: invoice.id,
          billingState: invoice.visitBillingStage,
          collectionMode: invoice.billingCollectionMode ?? null,
        },
      });

      return res.status(200).json(
        toFinanceSuccess({
          appointmentId,
          billingState: invoice.visitBillingStage,
          invoiceId: invoice.id,
          collectionMode: invoice.billingCollectionMode ?? null,
        }),
      );
    } catch (error) {
      logger.error("Error reversing appointment ready for billing", error);
      const statusCode =
        error instanceof InvoiceServiceError ? error.statusCode : 500;
      const message =
        error instanceof InvoiceServiceError
          ? error.message
          : "Internal server error";
      return res.status(statusCode).json({ message });
    }
  },

  async recordSubscriptionCheckoutCompleted(
    this: void,
    req: Request,
    res: Response,
  ) {
    try {
      const context = parseSubscriptionRequest(req, res);
      if (!context) {
        return res;
      }

      const body = SubscriptionCheckoutCompletedBodySchema.safeParse(req.body);
      if (!body.success) {
        return res.status(400).json({ message: "Invalid request body" });
      }

      await FinanceSubscriptionService.recordBusinessCheckoutCompleted({
        customerId: body.data.customerId,
        subscriptionId: body.data.subscriptionId,
        subscriptionItemId: body.data.subscriptionItemId,
        priceId: body.data.priceId,
        productId: body.data.productId ?? null,
        billingInterval: body.data.billingInterval ?? null,
        subscriptionStatus: body.data.subscriptionStatus ?? null,
        cancelAtPeriodEnd: body.data.cancelAtPeriodEnd ?? null,
        currentPeriodStart: body.data.currentPeriodStart
          ? new Date(body.data.currentPeriodStart)
          : null,
        currentPeriodEnd: body.data.currentPeriodEnd
          ? new Date(body.data.currentPeriodEnd)
          : null,
        livemode: body.data.livemode ?? null,
        seatQuantity: body.data.seatQuantity ?? null,
      });

      return res.status(201).json(
        toFinanceSuccess({
          organisationId: context.organisationId,
          provider: context.provider,
          subscriptionId: body.data.subscriptionId,
        }),
      );
    } catch (error) {
      logger.error("Error recording subscription checkout completion", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  },

  async recordSubscriptionUpdated(this: void, req: Request, res: Response) {
    try {
      const context = parseSubscriptionRequest(req, res);
      if (!context) {
        return res;
      }

      const body = SubscriptionUpdatedBodySchema.safeParse(req.body);
      if (!body.success) {
        return res.status(400).json({ message: "Invalid request body" });
      }

      await FinanceSubscriptionService.recordSubscriptionUpdated({
        subscriptionId: body.data.subscriptionId,
        subscriptionStatus: body.data.subscriptionStatus ?? null,
        cancelAtPeriodEnd: body.data.cancelAtPeriodEnd ?? null,
        canceledAt: body.data.canceledAt
          ? new Date(body.data.canceledAt)
          : null,
        seatQuantity: body.data.seatQuantity ?? null,
        currentPeriodStart: body.data.currentPeriodStart
          ? new Date(body.data.currentPeriodStart)
          : null,
        currentPeriodEnd: body.data.currentPeriodEnd
          ? new Date(body.data.currentPeriodEnd)
          : null,
      });

      return res.status(200).json(
        toFinanceSuccess({
          organisationId: context.organisationId,
          provider: context.provider,
          subscriptionId: body.data.subscriptionId,
        }),
      );
    } catch (error) {
      logger.error("Error recording subscription update", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  },

  async recordSubscriptionDeleted(this: void, req: Request, res: Response) {
    try {
      const context = parseSubscriptionLifecycleRequest(req, res);
      if (!context) {
        return res;
      }

      await FinanceSubscriptionService.recordSubscriptionDeleted(
        context.subscriptionId,
      );

      return res.status(200).json(
        toFinanceSuccess({
          organisationId: context.organisationId,
          provider: context.provider,
          subscriptionId: context.subscriptionId,
        }),
      );
    } catch (error) {
      logger.error("Error recording subscription deletion", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  },

  async recordSubscriptionInvoicePaid(this: void, req: Request, res: Response) {
    try {
      const context = parseSubscriptionLifecycleRequest(req, res);
      if (!context) {
        return res;
      }

      await FinanceSubscriptionService.recordSubscriptionInvoicePaid({
        subscriptionId: context.subscriptionId,
        invoiceId: context.invoiceId,
      });

      return res.status(200).json(
        toFinanceSuccess({
          organisationId: context.organisationId,
          provider: context.provider,
          subscriptionId: context.subscriptionId,
          invoiceId: context.invoiceId,
        }),
      );
    } catch (error) {
      logger.error("Error recording subscription invoice paid", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  },

  async recordSubscriptionInvoiceFailed(
    this: void,
    req: Request,
    res: Response,
  ) {
    try {
      const context = parseSubscriptionLifecycleRequest(req, res);
      if (!context) {
        return res;
      }

      await FinanceSubscriptionService.recordSubscriptionInvoiceFailed({
        subscriptionId: context.subscriptionId,
        invoiceId: context.invoiceId,
      });

      return res.status(200).json(
        toFinanceSuccess({
          organisationId: context.organisationId,
          provider: context.provider,
          subscriptionId: context.subscriptionId,
          invoiceId: context.invoiceId,
        }),
      );
    } catch (error) {
      logger.error("Error recording subscription invoice failure", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  },

  async recordUsageEvent(this: void, req: Request, res: Response) {
    try {
      const organisationId = req.params.organisationId;
      if (!organisationId) {
        return res.status(400).json({ message: "Organisation Id is required" });
      }

      const body = UsageEventBodySchema.safeParse(req.body);
      if (!body.success) {
        return res.status(400).json({ message: "Invalid request body" });
      }

      const event = await FinanceSubscriptionService.recordUsageEvent({
        orgId: organisationId,
        usageKey: body.data.usageKey,
        quantity: body.data.quantity,
        billableQuantity: body.data.billableQuantity,
        source: body.data.source,
        referenceType: body.data.referenceType ?? null,
        referenceId: body.data.referenceId ?? null,
        metadata: body.data.metadata,
        occurredAt: body.data.occurredAt
          ? new Date(body.data.occurredAt)
          : undefined,
      });

      return res.status(201).json(toFinanceSuccess(event));
    } catch (error) {
      logger.error("Error recording usage event", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  },

  async captureUsageSnapshot(this: void, req: Request, res: Response) {
    try {
      const organisationId = req.params.organisationId;
      if (!organisationId) {
        return res.status(400).json({ message: "Organisation Id is required" });
      }

      const body = UsageSnapshotBodySchema.safeParse(req.body);
      if (!body.success) {
        return res.status(400).json({ message: "Invalid request body" });
      }

      const snapshot = await FinanceSubscriptionService.captureUsageSnapshot({
        orgId: organisationId,
        snapshotType: body.data.snapshotType,
        seatsActive: body.data.seatsActive,
        seatsBillable: body.data.seatsBillable,
        appointmentsUsed: body.data.appointmentsUsed,
        toolsUsed: body.data.toolsUsed,
        metadata: body.data.metadata,
        snapshotAt: body.data.snapshotAt
          ? new Date(body.data.snapshotAt)
          : undefined,
      });

      return res.status(201).json(toFinanceSuccess(snapshot));
    } catch (error) {
      logger.error("Error capturing usage snapshot", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  },

  async recordInvoicePayment(this: void, req: Request, res: Response) {
    try {
      const invoiceId = req.params.invoiceId;
      if (!invoiceId) {
        return res.status(400).json({ message: "Invoice Id is required" });
      }

      const body = RecordInvoicePaymentBodySchema.safeParse(req.body);
      if (!body.success) {
        return res.status(400).json({ message: "Invalid request body" });
      }

      const provider = normalizeProvider(body.data.provider);
      if (provider !== "MANUAL") {
        return res
          .status(400)
          .json({ message: "Unsupported payment provider" });
      }

      const settlementChannel = body.data.settlementChannel ?? "CASH";
      const payment = await FinancePaymentService.recordInvoicePayment(
        invoiceId,
        {
          provider: "MANUAL",
          settlementChannel: settlementChannel as
            "CASH" | "BANK_TRANSFER" | "CARD_PRESENT" | "DEPOSIT" | "OTHER",
          amount: body.data.amount,
          currency: body.data.currency,
          reference: body.data.reference,
          receivedAt: body.data.receivedAt
            ? new Date(body.data.receivedAt)
            : undefined,
        },
      );

      if (!payment.payment) {
        return res.status(409).json({ message: "Invoice already settled" });
      }

      return res.status(201).json(
        toFinanceSuccess({
          paymentId: payment.payment.id,
          status: payment.payment.status,
          amount: payment.appliedAmount,
          balanceAfterPayment: payment.balanceAfterPayment,
        }),
      );
    } catch (error) {
      const statusCode =
        error instanceof FinancePaymentError ? error.statusCode : 500;
      const message =
        error instanceof FinancePaymentError
          ? error.message
          : "Internal server error";

      logger.error("Error recording invoice payment", error);
      return res.status(statusCode).json({ message });
    }
  },

  async refundPayment(this: void, req: Request, res: Response) {
    try {
      const paymentId = req.params.paymentId;
      if (!paymentId) {
        return res.status(400).json({ message: "Payment Id is required" });
      }

      const body = RefundPaymentBodySchema.safeParse(req.body);
      if (!body.success) {
        return res.status(400).json({ message: "Invalid request body" });
      }

      const result = await FinancePaymentService.refundPaymentById(paymentId, {
        amount: body.data.amount,
        reason: body.data.reason,
      });

      return res.status(201).json(toFinanceSuccess(result.refund));
    } catch (error) {
      const statusCode =
        error instanceof FinancePaymentError ? error.statusCode : 500;
      const message =
        error instanceof FinancePaymentError
          ? error.message
          : "Internal server error";

      logger.error("Error refunding payment", error);
      return res.status(statusCode).json({ message });
    }
  },

  async voidInvoice(this: void, req: Request, res: Response) {
    try {
      const invoiceId = req.params.invoiceId;
      if (!invoiceId) {
        return res.status(400).json({ message: "Invoice Id is required" });
      }

      const body = VoidInvoiceBodySchema.safeParse(req.body);
      if (!body.success) {
        return res.status(400).json({ message: "Invalid request body" });
      }

      const organisationId = (req as OrgRequest).organisationId;
      if (!organisationId) {
        return res.status(400).json({ message: "Organisation Id is required" });
      }

      const action = await InvoiceService.handleInvoiceCancellation(
        invoiceId,
        body.data.reason ?? "Invoice voided",
      );
      const invoice = await InvoiceService.getById(invoiceId, {
        organisationId,
      });

      return res.status(200).json(
        toFinanceSuccess({
          action,
          invoice,
        }),
      );
    } catch (error) {
      const statusCode =
        error instanceof InvoiceServiceError ? error.statusCode : 500;
      const message =
        error instanceof InvoiceServiceError
          ? error.message
          : "Internal server error";

      logger.error("Error voiding invoice", error);
      return res.status(statusCode).json({ message });
    }
  },

  async supplementInvoice(this: void, req: Request, res: Response) {
    try {
      const invoiceId = req.params.invoiceId;
      if (!invoiceId) {
        return res.status(400).json({ message: "Invoice Id is required" });
      }

      const body = SupplementInvoiceBodySchema.safeParse(req.body);
      if (!body.success) {
        return res.status(400).json({ message: "Invalid request body" });
      }

      const organisationId = (req as OrgRequest).organisationId;
      if (!organisationId) {
        return res.status(400).json({ message: "Organisation Id is required" });
      }

      const invoice = await InvoiceService.getById(invoiceId, {
        organisationId,
      });
      const appointmentId = invoice.invoice.appointmentId;
      if (!appointmentId) {
        return res.status(400).json({
          message: "Invoice is not linked to an appointment",
        });
      }

      const updatedInvoice = await InvoiceService.addChargesToAppointment(
        appointmentId,
        body.data.items,
        organisationId,
      );

      return res.status(201).json(toFinanceSuccess(updatedInvoice));
    } catch (error) {
      const statusCode =
        error instanceof InvoiceServiceError ? error.statusCode : 500;
      const message =
        error instanceof InvoiceServiceError
          ? error.message
          : "Internal server error";

      logger.error("Error creating supplemental invoice", error);
      return res.status(statusCode).json({ message });
    }
  },

  async createInvoicePaymentSession(this: void, req: Request, res: Response) {
    try {
      const body = CreateInvoicePaymentSessionBodySchema.parse(req.body);
      const provider = normalizeProvider(body.provider);

      if (provider !== "STRIPE") {
        return res
          .status(400)
          .json({ message: "Unsupported payment provider" });
      }

      const invoiceId = req.params.invoiceId;
      if (!invoiceId) {
        return res.status(400).json({ message: "Invoice Id is required" });
      }

      const result =
        await FinancePaymentService.createCheckoutSessionForInvoice(
          invoiceId,
          provider,
          body.depositAmount ?? null,
        );

      return res.status(201).json({
        data: result,
        meta: null,
        error: null,
      });
    } catch (error) {
      logger.error("Error creating invoice payment session", error);
      if (error instanceof ZodError) {
        return res.status(400).json({
          message: "Invalid request body",
        });
      }

      if (error instanceof FinancePaymentError) {
        return res.status(error.statusCode).json({
          message: error.message,
        });
      }

      return res.status(500).json({ message: "Internal server error" });
    }
  },

  async createMobileInvoicePaymentSession(
    this: void,
    req: Request,
    res: Response,
  ) {
    try {
      const invoiceId = req.params.invoiceId;
      if (!invoiceId) {
        return res.status(400).json({ message: "Invoice Id is required" });
      }

      const parentId = await resolveMobileParentId(req);
      if (!parentId) {
        return res.status(403).json({
          message: "Parent account is not linked to this mobile user",
        });
      }

      const result = await FinancePaymentService.createPaymentIntentForInvoice(
        invoiceId,
        { parentId },
        {
          collectionMode: "DEPOSIT_THEN_SETTLE",
          settlementChannel: "DEPOSIT",
        },
      );

      return res.status(201).json({
        data: result,
        meta: null,
        error: null,
      });
    } catch (error) {
      logger.error("Error creating mobile invoice payment session", error);

      if (error instanceof FinancePaymentError) {
        return res.status(error.statusCode).json({
          message: error.message,
        });
      }

      return res.status(500).json({ message: "Internal server error" });
    }
  },

  async webhook(this: void, req: Request, res: Response) {
    const provider = normalizeProvider(req.params.provider);
    if (provider !== "STRIPE") {
      return res.status(400).json({ message: "Unsupported provider" });
    }

    return StripeController.webhook(
      req as Request<Record<string, string>, unknown, Buffer>,
      res,
    );
  },

  /**
   * The reconciliation queue for the authorized organisation (#3170).
   *
   * Read-only, so it is behind `billing:view:any` rather than an edit
   * permission: an operator has to be able to SEE an unattributed capture
   * before anyone can decide what to do with it, and nothing here changes a
   * receipt.
   *
   * The organisation comes from `resolveAuthorizedOrganisationId`, never from
   * the query, so a caller cannot name another tenant's organisation in the
   * path and read its money.
   */
  async listProviderReceipts(this: void, req: Request, res: Response) {
    try {
      const organisationId = resolveAuthorizedOrganisationId(
        req,
        res,
        req.params.organisationId,
      );
      if (!organisationId) return;

      const query = ProviderReceiptQuerySchema.safeParse(req.query);
      if (!query.success) {
        /*
         * The offending value is not echoed. It is caller-controlled, a raw
         * CR/LF in it forges a second log line, and the message already tells
         * the only party who can act on it what to send instead.
         */
        return res.status(400).json({
          message:
            "Invalid reconciliation filter. Check status, capturedFrom, capturedTo and limit.",
        });
      }

      /*
       * Rejected up front rather than passed through. A malformed cursor is a
       * caller mistake, and answering 400 here is what lets every failure from
       * the query itself be reported honestly as a 500 - inferring "bad
       * cursor" from a thrown error would report a database outage as the
       * caller's fault.
       */
      const cursor = parseKeysetCursor(req.query.cursor);
      if (cursor === null) {
        return res.status(400).json({
          message:
            "Unknown or malformed cursor. Use nextCursor from the previous response.",
        });
      }

      const statuses = query.data.status;
      const page = await ProviderReceiptService.listForReconciliation({
        organisationId,
        ...(statuses?.length
          ? { statuses: Array.isArray(statuses) ? statuses : [statuses] }
          : {}),
        ...(query.data.capturedFrom
          ? { capturedFrom: new Date(query.data.capturedFrom) }
          : {}),
        ...(query.data.capturedTo
          ? { capturedTo: new Date(query.data.capturedTo) }
          : {}),
        ...(cursor ? { cursor } : {}),
        limit: query.data.limit,
      });

      /*
       * The three fields beside the rows are what stops this being a silently
       * truncated list: a client that ignores them sees a short page, and one
       * that reads them can tell the end of the data from the end of a page.
       */
      return res.status(200).json({
        data: page.receipts,
        meta: {
          nextCursor: page.nextCursor,
          hasMore: page.hasMore,
          limit: page.limit,
        },
        error: null,
      });
    } catch (error) {
      logger.error("Error listing provider receipts for reconciliation", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  },

  /**
   * The historical mismatch audit (#3170 delivery 4).
   *
   * Reports settled provider payments that the journal does not corroborate,
   * and repairs none of them. The issue is explicit that this audit performs
   * no automatic guessed repair, which is why the route is a GET with no
   * counterpart: there is nothing here to invoke a correction with, so no
   * later caller can mistake one for being available.
   *
   * `billing:view:any`, like the queue beside it. The findings are this
   * organisation's own payments and its own journal rows, which billing staff
   * can already read one at a time; what the audit adds is that they are read
   * against each other.
   *
   * The organisation comes from `resolveAuthorizedOrganisationId`, never the
   * query, so a caller cannot name another tenant in the path and audit its
   * money.
   */
  async auditProviderReceipts(this: void, req: Request, res: Response) {
    try {
      const organisationId = resolveAuthorizedOrganisationId(
        req,
        res,
        req.params.organisationId,
      );
      if (!organisationId) return;

      const query = ProviderReceiptAuditQuerySchema.safeParse(req.query);
      if (!query.success) {
        return res.status(400).json({
          message:
            "Invalid audit window. Check recordedFrom, recordedTo and limit.",
        });
      }

      const cursor = parseKeysetCursor(req.query.cursor);
      if (cursor === null) {
        return res.status(400).json({
          message:
            "Unknown or malformed cursor. Use nextCursor from the previous response.",
        });
      }

      const audit = await ProviderReceiptAuditService.auditHistoricalMismatches(
        {
          organisationId,
          ...(query.data.recordedFrom
            ? { recordedFrom: new Date(query.data.recordedFrom) }
            : {}),
          ...(query.data.recordedTo
            ? { recordedTo: new Date(query.data.recordedTo) }
            : {}),
          ...(cursor ? { cursor } : {}),
          limit: query.data.limit,
        },
      );

      return res.status(200).json({
        data: audit.mismatches,
        meta: {
          examined: audit.examined,
          matched: audit.matched,
          nextCursor: audit.nextCursor,
          hasMore: audit.hasMore,
          limit: audit.limit,
        },
        error: null,
      });
    } catch (error) {
      logger.error("Error auditing provider receipts against payments", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  },

  /**
   * A client's available account credit (#3163).
   *
   * Read-only, so `billing:view:any` like the reconciliation queue beside it.
   * The figure is this organisation's own captures against its own invoices,
   * read together; nothing here moves money.
   *
   * The organisation comes from `resolveAuthorizedOrganisationId` and never
   * from the path, and it is then applied to the invoice as well as the
   * capture. A `Parent` is global rather than owned by one practice, so a
   * client id alone is not a tenancy boundary - without the organisation on
   * both sides this route would answer one practice's question with another
   * practice's money.
   */
  async getClientAccountCredit(this: void, req: Request, res: Response) {
    try {
      const organisationId = resolveAuthorizedOrganisationId(
        req,
        res,
        req.params.organisationId,
      );
      if (!organisationId) return;

      const parentId = z.uuid().safeParse(req.params.parentId);
      if (!parentId.success) {
        return res.status(400).json({ message: "Invalid client id." });
      }

      const credit = await ClientAccountService.getAccountCredit({
        organisationId,
        parentId: parentId.data,
      });

      /*
       * An empty array is the honest answer for a client with no credit, and
       * it is the same answer as for a client this organisation has never
       * invoiced. Distinguishing the two would turn this into a test for
       * whether a given client id exists somewhere in the estate.
       */
      return res.status(200).json({ data: credit, error: null });
    } catch (error) {
      logger.error("Error reading client account credit", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  },

  /**
   * What applying this client's credit to their outstanding invoices would do
   * (#3163).
   *
   * `billing:edit:any`, not the view permission the credit route beside it
   * carries. This writes nothing, but it is the preview of a decision only a
   * staff member who may take that decision has any use for, and the tighter
   * of the two permissions is the safe one to attach to a new route.
   *
   * The proposal is returned whole, including the version of every capture it
   * was taken from, because confirming it is a compare-and-set against that
   * state - the allocation route refuses a decision taken from state that has
   * since moved.
   */
  async getClientAccountAllocationProposal(
    this: void,
    req: Request,
    res: Response,
  ) {
    try {
      const organisationId = resolveAuthorizedOrganisationId(
        req,
        res,
        req.params.organisationId,
      );
      if (!organisationId) return;

      const parentId = z.uuid().safeParse(req.params.parentId);
      if (!parentId.success) {
        return res.status(400).json({ message: "Invalid client id." });
      }

      const proposal = await ClientAccountService.proposeAllocation({
        organisationId,
        parentId: parentId.data,
      });

      /*
       * An empty array where there is nothing to propose, for the same reason
       * the credit route returns one: a client with no spendable credit and a
       * client this organisation has never invoiced must not be told apart by
       * anyone who can guess an id.
       */
      return res.status(200).json({ data: proposal, error: null });
    } catch (error) {
      logger.error("Error proposing client account allocation", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  },

  /**
   * Confirm a client account allocation plan (#3163).
   *
   * The organisation and the acting staff member come from the session, as on
   * the per-capture route beside it: an allocation is an audited money
   * movement and a request-supplied actor would put an unverified name on it.
   *
   * A plan that stopped part way is answered 200 and not 409. The request was
   * performed, just not all of it, and a status code cannot say "two of five
   * captures applied" - so the outcome is in the body where it can name which
   * capture refused, what it refused with, and which captures were never
   * tried. A 409 here would tell a client to retry a request that already
   * moved money. The two refusals that write nothing at all are 409, because
   * for those nothing was performed.
   */
  async applyClientAccountAllocation(this: void, req: Request, res: Response) {
    try {
      const organisationId = resolveAuthorizedOrganisationId(
        req,
        res,
        req.params.organisationId,
      );
      if (!organisationId) return;

      const actorId = resolveVerifiedUserId(req);
      if (!actorId) {
        return res.status(401).json({ message: "Unauthenticated" });
      }

      const parentId = z.uuid().safeParse(req.params.parentId);
      if (!parentId.success) {
        return res.status(400).json({ message: "Invalid client id." });
      }

      const body = ClientAccountAllocationBodySchema.safeParse(req.body);
      if (!body.success) {
        // The offending value is not echoed: it is caller-controlled and a raw
        // CR/LF in it forges a second log line.
        return res.status(400).json({
          message:
            "Invalid plan. Send idempotencyKey and one to twenty captures, each with expectedVersion and one to twenty positive allocations.",
        });
      }

      /*
       * An invoice named twice under one capture, for the reason the
       * per-capture route gives: summing them answers a request the caller did
       * not make, and the one-allocation-per-pair rule downstream would refuse
       * the second line as a conflict, which reads as somebody else's write.
       */
      for (const entry of body.data.receipts) {
        const invoiceIds = entry.allocations.map((line) => line.invoiceId);
        if (new Set(invoiceIds).size !== invoiceIds.length) {
          return res.status(400).json({
            message: "Each invoice may appear at most once under one capture.",
          });
        }
      }

      const result = await ClientAccountService.applyAllocation({
        organisationId,
        parentId: parentId.data,
        actorId,
        idempotencyKey: body.data.idempotencyKey,
        receipts: body.data.receipts,
      });

      if (result.outcome !== "APPLIED" && result.outcome !== "STOPPED") {
        return res.status(409).json({
          message: CLIENT_ACCOUNT_ALLOCATION_FAILURES[result.outcome],
          error: {
            code: result.outcome,
            ...("receiptId" in result ? { receiptId: result.receiptId } : {}),
            ...("invoiceId" in result ? { invoiceId: result.invoiceId } : {}),
          },
        });
      }

      return res.status(200).json({
        data: {
          outcome: result.outcome,
          appliedAmount: result.appliedAmount,
          steps: result.steps,
          notAttempted: result.notAttempted,
        },
        error: null,
      });
    } catch (error) {
      logger.error("Error applying client account allocation", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  },

  /**
   * Apply a captured payment to invoices (#3170 delivery 2).
   *
   * The organisation and the acting staff member both come from the session.
   * Neither is read from the body: an allocation is an audited money movement,
   * and a request-supplied actor would put a name on it that nobody verified.
   */
  async allocateProviderReceipt(this: void, req: Request, res: Response) {
    try {
      const organisationId = resolveAuthorizedOrganisationId(
        req,
        res,
        req.params.organisationId,
      );
      if (!organisationId) return;

      const actorId = resolveVerifiedUserId(req);
      if (!actorId) {
        return res.status(401).json({ message: "Unauthenticated" });
      }

      const receiptId = z.uuid().safeParse(req.params.receiptId);
      if (!receiptId.success) {
        return res.status(400).json({ message: "Invalid receipt id." });
      }

      const body = ProviderReceiptAllocationBodySchema.safeParse(req.body);
      if (!body.success) {
        /*
         * The offending value is not echoed, for the same reason the list
         * route does not echo its filter: it is caller-controlled and a raw
         * CR/LF in it forges a second log line.
         */
        return res.status(400).json({
          message:
            "Invalid allocation. Send expectedVersion, idempotencyKey and one to twenty positive allocations.",
        });
      }

      /*
       * Two lines naming the same invoice are rejected here rather than
       * summed. Summing them would answer a request the caller did not make,
       * and the one allocation per receipt and invoice rule downstream would
       * refuse the second line anyway - as a conflict, which reads as though
       * somebody else had allocated it.
       */
      const invoiceIds = body.data.allocations.map((line) => line.invoiceId);
      if (new Set(invoiceIds).size !== invoiceIds.length) {
        return res.status(400).json({
          message: "Each invoice may appear at most once in an allocation.",
        });
      }

      const result = await ProviderReceiptService.allocate({
        organisationId,
        receiptId: receiptId.data,
        expectedVersion: body.data.expectedVersion,
        idempotencyKey: body.data.idempotencyKey,
        actorId,
        allocations: body.data.allocations,
      });

      if (result.outcome !== "APPLIED" && result.outcome !== "REPLAYED") {
        const failure = PROVIDER_RECEIPT_ALLOCATION_FAILURES[result.outcome];
        return res.status(failure.status).json({
          message: failure.message,
          /*
           * The machine-readable half. A UI showing "reload and try again"
           * needs the stored version to reload TO, and one showing which
           * invoice line to correct needs its id - so the details a client can
           * act on travel beside the sentence a human reads.
           */
          error: {
            code: result.outcome,
            ...("version" in result ? { version: result.version } : {}),
            ...("residual" in result
              ? { residual: result.residual, requested: result.requested }
              : {}),
            ...("invoiceId" in result
              ? { invoiceId: result.invoiceId, reason: result.reason }
              : {}),
          },
        });
      }

      return res.status(200).json({
        data: {
          receipt: result.receipt,
          remainingAmount: result.remainingAmount,
          allocations: result.allocations,
        },
        /*
         * `replayed` rather than a different status code. A retry that found
         * the decision already taken succeeded, and answering it 409 would
         * teach clients to treat their own successful write as a failure.
         */
        meta: { replayed: result.outcome === "REPLAYED" },
        error: null,
      });
    } catch (error) {
      logger.error("Error allocating a provider receipt", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  },
};
