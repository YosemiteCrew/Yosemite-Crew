import { Request, Response } from "express";
import { ZodError, z } from "zod";
import {
  FinancePaymentError,
  FinancePaymentService,
} from "src/services/finance/payment";
import { FinanceSubscriptionService } from "src/services/finance/subscription";
import { FinanceEventService } from "src/services/finance/events";
import { StripeController } from "src/controllers/web/stripe.controller";
import { StripeService } from "src/services/stripe.service";
import {
  InvoiceService,
  InvoiceServiceError,
} from "src/services/invoice.service";
import { AuthUserMobileService } from "src/services/authUserMobile.service";
import logger from "src/utils/logger";
import { OrgRequest } from "src/middlewares/rbac";
import { AuthenticatedRequest } from "src/middlewares/auth";
import { resolveUserIdFromRequest } from "src/utils/request";
import { resolveActorDisplayName } from "src/services/finance/events";

const CreateInvoicePaymentSessionBodySchema = z.object({
  provider: z.string().trim().min(1).optional(),
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
  currentPeriodStart: z.string().datetime().optional(),
  currentPeriodEnd: z.string().datetime().optional(),
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
  canceledAt: z.string().datetime().optional(),
  seatQuantity: z.number().int().nonnegative().optional(),
  currentPeriodStart: z.string().datetime().optional(),
  currentPeriodEnd: z.string().datetime().optional(),
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
  occurredAt: z.string().datetime().optional(),
});

const UsageSnapshotBodySchema = z.object({
  snapshotType: z.string().trim().min(1).optional(),
  seatsActive: z.number().int().nonnegative().optional(),
  seatsBillable: z.number().int().nonnegative().optional(),
  appointmentsUsed: z.number().int().nonnegative().optional(),
  toolsUsed: z.number().int().nonnegative().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  snapshotAt: z.string().datetime().optional(),
});

const RecordInvoicePaymentBodySchema = z.object({
  provider: z.string().trim().min(1).optional(),
  settlementChannel: z.string().trim().min(1).optional(),
  amount: z.number().positive(),
  currency: z.string().trim().min(1).optional(),
  reference: z.string().trim().min(1).optional(),
  receivedAt: z.string().datetime().optional(),
});

const CloseoutInvoiceBodySchema = z.object({
  settlementChannel: z.string().trim().min(1).optional(),
  reference: z.string().trim().min(1).optional(),
  receivedAt: z.string().datetime().optional(),
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

const normalizeProvider = (value?: string) =>
  value?.trim().toUpperCase() ?? "STRIPE";

const isSupportedSubscriptionProvider = (provider: string) =>
  provider === "STRIPE";

const toFinanceSuccess = <T>(data: T) => ({
  data,
  meta: null,
  error: null,
});

export const FinanceController = {
  async createInvoice(this: void, req: Request, res: Response) {
    try {
      const body = CreateInvoiceBodySchema.safeParse(req.body);
      if (!body.success) {
        return res.status(400).json({ message: "Invalid request body" });
      }

      const items = body.data.items.map((item) => ({
        ...item,
        description: item.description ?? item.name,
      }));

      const invoice = await InvoiceService.createDraftForAppointment({
        appointmentId: body.data.appointmentId,
        parentId: body.data.parentId,
        patientId: body.data.patientId,
        organisationId: body.data.organisationId,
        paymentCollectionMethod: body.data.paymentCollectionMethod as
          | "PAYMENT_INTENT"
          | "PAYMENT_LINK"
          | "PAYMENT_AT_CLINIC",
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

      if (resolved.appointmentId) {
        const invoices = await InvoiceService.getByAppointmentId(
          resolved.appointmentId,
          authorizedOrganisationId,
        );
        return res.status(200).json(toFinanceSuccess(invoices));
      }

      if (resolved.organisationId) {
        const invoices = await InvoiceService.listForOrganisation(
          resolved.organisationId,
        );
        return res.status(200).json(toFinanceSuccess(invoices));
      }

      if (resolved.parentId) {
        const invoices = await InvoiceService.listForParent(resolved.parentId);
        return res.status(200).json(toFinanceSuccess(invoices));
      }

      const invoices = await InvoiceService.listForCompanion(
        resolved.patientId as string,
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

      const organisationId = (req as OrgRequest).organisationId;
      const invoices = await InvoiceService.getByAppointmentId(
        appointmentId,
        organisationId,
      );

      return res.status(200).json(toFinanceSuccess(invoices));
    } catch (error) {
      logger.error("Error fetching appointment invoices", error);
      return res.status(500).json({ message: "Internal server error" });
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

      const invoices = await InvoiceService.listForParent(parentId);
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

      const invoice = await InvoiceService.getById(invoiceId);
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

      const paymentIntent =
        await StripeService.retrievePaymentIntent(paymentIntentId);

      return res.status(200).json(toFinanceSuccess(paymentIntent));
    } catch (error) {
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

      const invoice =
        await InvoiceService.bootstrapForAppointment(appointmentId);
      return res.status(200).json(toFinanceSuccess(invoice));
    } catch (error) {
      const statusCode =
        error instanceof InvoiceServiceError ? error.statusCode : 500;
      const message =
        error instanceof InvoiceServiceError
          ? error.message
          : "Internal server error";

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
        error instanceof InvoiceServiceError
          ? error.statusCode
          : error instanceof FinancePaymentError
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

      const current = await FinanceSubscriptionService.getCurrentSubscription(
        query.data.organisationId,
      );

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

      const subscription = await FinanceSubscriptionService.upsertSubscription({
        orgId: body.data.organisationId,
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

      const snapshots = await FinanceSubscriptionService.listUsageSnapshots(
        query.data.organisationId,
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
      const organisationId = req.params.organisationId;
      if (!organisationId) {
        return res.status(400).json({ message: "Organisation Id is required" });
      }

      const providerResult = ProviderParamsSchema.safeParse(req.params);
      if (!providerResult.success) {
        return res.status(400).json({ message: "Invalid provider" });
      }

      const provider = normalizeProvider(providerResult.data.provider);
      if (!isSupportedSubscriptionProvider(provider)) {
        return res.status(400).json({ message: "Unsupported provider" });
      }

      const body = SubscriptionCustomerBodySchema.safeParse(req.body);
      if (!body.success) {
        return res.status(400).json({ message: "Invalid request body" });
      }

      await FinanceSubscriptionService.recordBusinessCheckoutCustomer({
        orgId: organisationId,
        externalCustomerId: body.data.externalCustomerId,
      });

      return res.status(200).json(
        toFinanceSuccess({
          organisationId,
          provider,
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

      const appointmentId = body.data.appointmentId ?? visitId;
      const shouldReadyForBilling = body.data.milestone === "READY_FOR_BILLING";
      const invoice = shouldReadyForBilling
        ? await InvoiceService.markAppointmentReadyForBilling(appointmentId)
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

      const invoice =
        await InvoiceService.markAppointmentReadyForBilling(appointmentId);
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }

      const actorUserId = resolveUserIdFromRequest(req);
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

      const invoice =
        await InvoiceService.reverseAppointmentReadyForBilling(appointmentId);
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
      const organisationId = req.params.organisationId;
      if (!organisationId) {
        return res.status(400).json({ message: "Organisation Id is required" });
      }

      const providerResult = ProviderParamsSchema.safeParse(req.params);
      if (!providerResult.success) {
        return res.status(400).json({ message: "Invalid provider" });
      }

      const provider = normalizeProvider(providerResult.data.provider);
      if (!isSupportedSubscriptionProvider(provider)) {
        return res.status(400).json({ message: "Unsupported provider" });
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
          organisationId,
          provider,
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
      const organisationId = req.params.organisationId;
      if (!organisationId) {
        return res.status(400).json({ message: "Organisation Id is required" });
      }

      const providerResult = ProviderParamsSchema.safeParse(req.params);
      if (!providerResult.success) {
        return res.status(400).json({ message: "Invalid provider" });
      }

      const provider = normalizeProvider(providerResult.data.provider);
      if (!isSupportedSubscriptionProvider(provider)) {
        return res.status(400).json({ message: "Unsupported provider" });
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
          organisationId,
          provider,
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
      const organisationId = req.params.organisationId;
      if (!organisationId) {
        return res.status(400).json({ message: "Organisation Id is required" });
      }

      const providerResult = ProviderParamsSchema.safeParse(req.params);
      if (!providerResult.success) {
        return res.status(400).json({ message: "Invalid provider" });
      }

      const provider = normalizeProvider(providerResult.data.provider);
      if (!isSupportedSubscriptionProvider(provider)) {
        return res.status(400).json({ message: "Unsupported provider" });
      }

      const body = SubscriptionLifecycleBodySchema.safeParse(req.body);
      if (!body.success) {
        return res.status(400).json({ message: "Invalid request body" });
      }

      await FinanceSubscriptionService.recordSubscriptionDeleted(
        body.data.subscriptionId,
      );

      return res.status(200).json(
        toFinanceSuccess({
          organisationId,
          provider,
          subscriptionId: body.data.subscriptionId,
        }),
      );
    } catch (error) {
      logger.error("Error recording subscription deletion", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  },

  async recordSubscriptionInvoicePaid(this: void, req: Request, res: Response) {
    try {
      const organisationId = req.params.organisationId;
      if (!organisationId) {
        return res.status(400).json({ message: "Organisation Id is required" });
      }

      const providerResult = ProviderParamsSchema.safeParse(req.params);
      if (!providerResult.success) {
        return res.status(400).json({ message: "Invalid provider" });
      }

      const provider = normalizeProvider(providerResult.data.provider);
      if (!isSupportedSubscriptionProvider(provider)) {
        return res.status(400).json({ message: "Unsupported provider" });
      }

      const body = SubscriptionLifecycleBodySchema.safeParse(req.body);
      if (!body.success) {
        return res.status(400).json({ message: "Invalid request body" });
      }

      await FinanceSubscriptionService.recordSubscriptionInvoicePaid({
        subscriptionId: body.data.subscriptionId,
        invoiceId: body.data.invoiceId ?? null,
      });

      return res.status(200).json(
        toFinanceSuccess({
          organisationId,
          provider,
          subscriptionId: body.data.subscriptionId,
          invoiceId: body.data.invoiceId ?? null,
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
      const organisationId = req.params.organisationId;
      if (!organisationId) {
        return res.status(400).json({ message: "Organisation Id is required" });
      }

      const providerResult = ProviderParamsSchema.safeParse(req.params);
      if (!providerResult.success) {
        return res.status(400).json({ message: "Invalid provider" });
      }

      const provider = normalizeProvider(providerResult.data.provider);
      if (!isSupportedSubscriptionProvider(provider)) {
        return res.status(400).json({ message: "Unsupported provider" });
      }

      const body = SubscriptionLifecycleBodySchema.safeParse(req.body);
      if (!body.success) {
        return res.status(400).json({ message: "Invalid request body" });
      }

      await FinanceSubscriptionService.recordSubscriptionInvoiceFailed({
        subscriptionId: body.data.subscriptionId,
        invoiceId: body.data.invoiceId ?? null,
      });

      return res.status(200).json(
        toFinanceSuccess({
          organisationId,
          provider,
          subscriptionId: body.data.subscriptionId,
          invoiceId: body.data.invoiceId ?? null,
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
            | "CASH"
            | "BANK_TRANSFER"
            | "CARD_PRESENT"
            | "DEPOSIT"
            | "OTHER",
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

      const action = await InvoiceService.handleInvoiceCancellation(
        invoiceId,
        body.data.reason ?? "Invoice voided",
      );
      const invoice = await InvoiceService.getById(invoiceId);

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

      const invoice = await InvoiceService.getById(invoiceId);
      const appointmentId = invoice.invoice.appointmentId;
      if (!appointmentId) {
        return res.status(400).json({
          message: "Invoice is not linked to an appointment",
        });
      }

      const organisationId = (req as OrgRequest).organisationId;
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

      const result =
        await FinancePaymentService.createPaymentIntentForInvoice(invoiceId);

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
};
