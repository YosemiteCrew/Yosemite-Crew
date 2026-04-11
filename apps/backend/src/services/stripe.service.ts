// src/services/stripe.service.ts
import Stripe from "stripe";
import logger from "../utils/logger";

import InvoiceModel from "src/models/invoice";
import OrganizationModel from "src/models/organization";
import ServiceModel from "src/models/service";
import AppointmentModel from "src/models/appointment";
import { InvoiceService } from "./invoice.service";
import { NotificationTemplates } from "src/utils/notificationTemplates";
import { NotificationService } from "./notification.service";

import { OrgBilling } from "src/models/organization.billing";
import { OrgUsageCounters } from "src/models/organisation.usage.counter";
import UserOrganizationModel from "src/models/user-organization";
import { prisma } from "src/config/prisma";
import { handleDualWriteError, shouldDualWrite } from "src/utils/dual-write";
import { getOrgBillingCurrency } from "src/utils/billing";
import {
  Prisma,
  AccessState,
  BillingInterval,
  SubscriptionStatus,
} from "@prisma/client";
import { isReadFromPostgres } from "src/config/read-switch";

let stripeClient: Stripe | null = null;

type IdLike = { toString(): string } | string;

const toIdString = (value: IdLike | null | undefined) =>
  typeof value === "string" ? value : value?.toString?.();

const extractAppointmentTypeId = (
  value: Prisma.JsonValue | null,
): string | undefined => {
  if (!value || typeof value !== "object") return undefined;
  const candidate = (value as Record<string, unknown>).id;
  return typeof candidate === "string" ? candidate : undefined;
};

const extractCompanionRefs = (
  value: Prisma.JsonValue,
): { companionId?: string; parentId?: string } => {
  if (!value || typeof value !== "object") return {};
  const companion = value as Record<string, unknown>;
  const companionId =
    typeof companion.id === "string" ? companion.id : undefined;
  const parent = companion.parent as Record<string, unknown> | undefined;
  const parentId =
    parent && typeof parent.id === "string" ? parent.id : undefined;
  return { companionId, parentId };
};

type OrgBillingDoc = {
  _id?: IdLike;
  orgId: IdLike;
  connectAccountId?: string | null;
  canAcceptPayments?: boolean;
  connectChargesEnabled?: boolean;
  connectPayoutsEnabled?: boolean;
  connectDisabledReason?: string | null;
  connectRequirements?: {
    currentlyDue?: string[];
    eventuallyDue?: string[];
    pastDue?: string[];
    pendingVerification?: string[];
    errors?: unknown[];
  } | null;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  stripeSubscriptionItemId?: string | null;
  stripePriceId?: string | null;
  stripeProductId?: string | null;
  stripeLivemode?: boolean;
  plan?: "free" | "business";
  billingInterval?: "month" | "year" | null;
  currency?: string;
  seatQuantity?: number;
  seatQuantityUpdatedAt?: Date | null;
  subscriptionStatus?: string | null;
  cancelAtPeriodEnd?: boolean;
  canceledAt?: Date | null;
  currentPeriodStart?: Date | null;
  currentPeriodEnd?: Date | null;
  nextInvoiceAt?: Date | null;
  lastInvoiceId?: string | null;
  lastPaymentStatus?: string | null;
  lastPaymentAt?: Date | null;
  joinedAt?: Date | null;
  upgradedAt?: Date | null;
  downgradedAt?: Date | null;
  accessState?: string | null;
  gracePeriodEndsAt?: Date | null;
  version?: number;
  lastStripeEventId?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
};

type OrgBillingMongooseDoc = OrgBillingDoc & {
  save: () => Promise<OrgBillingMongooseDoc>;
};

type OrgUsageCountersDoc = {
  _id?: IdLike;
  orgId: IdLike;
  appointmentsUsed?: number;
  toolsUsed?: number;
  usersActiveCount?: number;
  usersBillableCount?: number;
  freeAppointmentsLimit?: number;
  freeToolsLimit?: number;
  freeUsersLimit?: number;
  freeLimitReachedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
};

const toAccessState = (value?: string | null): AccessState | undefined => {
  if (!value) return undefined;
  if (value === "free") return "free";
  if (value === "active") return "active";
  if (value === "past_due") return "past_due";
  if (value === "suspended") return "suspended";
  return undefined;
};

const toBillingInterval = (
  value?: string | null,
): BillingInterval | undefined => {
  if (value === "month" || value === "year") return value;
  return undefined;
};

const toSubscriptionStatus = (
  value?: string | null,
): SubscriptionStatus | undefined => {
  if (!value) return undefined;
  if (value === "none") return "none";
  if (value === "trialing") return "trialing";
  if (value === "active") return "active";
  if (value === "past_due") return "past_due";
  if (value === "unpaid") return "unpaid";
  if (value === "canceled") return "canceled";
  if (value === "incomplete") return "incomplete";
  if (value === "incomplete_expired") return "incomplete_expired";
  if (value === "paused") return "paused";
  return undefined;
};

const getStripeClient = () => {
  if (stripeClient) return stripeClient;

  const apiKey = process.env.STRIPE_SECRET_KEY;
  if (!apiKey) throw new Error("STRIPE_SECRET_KEY is not configured");

  stripeClient = new Stripe(apiKey, { apiVersion: "2026-01-28.clover" });
  return stripeClient;
};

function toStripeAmount(amount: number): number {
  return Math.round(amount * 100);
}

// --- Billing helpers ---
async function ensureBillingDocs(
  orgId: string,
): Promise<{ billing: OrgBillingMongooseDoc; usage: OrgUsageCountersDoc }> {
  if (isReadFromPostgres()) {
    const [billing, usage] = await Promise.all([
      prisma.organizationBilling.upsert({
        where: { orgId },
        create: { orgId },
        update: {},
      }),
      prisma.organizationUsageCounter.upsert({
        where: { orgId },
        create: { orgId },
        update: {},
      }),
    ]);

    return {
      billing: billing as unknown as OrgBillingMongooseDoc,
      usage: usage as unknown as OrgUsageCountersDoc,
    };
  }

  const [billing, usage] = await Promise.all([
    OrgBilling.findOneAndUpdate(
      { orgId },
      { $setOnInsert: { orgId } },
      { upsert: true, new: true },
    ) as Promise<OrgBillingMongooseDoc | null>,
    OrgUsageCounters.findOneAndUpdate(
      { orgId },
      { $setOnInsert: { orgId } },
      { upsert: true, new: true },
    ) as Promise<OrgUsageCountersDoc | null>,
  ]);

  if (!billing || !usage) {
    throw new Error("Failed to initialize billing or usage counters");
  }

  await syncOrgBillingToPostgres(billing);
  await syncOrgUsageToPostgres(usage);

  return { billing, usage };
}

const syncOrgBillingToPostgres = async (doc: OrgBillingDoc | null) => {
  if (!shouldDualWrite || !doc) return;
  const orgId = toIdString(doc.orgId);
  if (!orgId) return;
  const id = toIdString(doc._id) ?? orgId;
  const payload = {
    connectAccountId: doc.connectAccountId ?? undefined,
    canAcceptPayments: doc.canAcceptPayments ?? false,
    connectChargesEnabled: doc.connectChargesEnabled ?? false,
    connectPayoutsEnabled: doc.connectPayoutsEnabled ?? false,
    connectDisabledReason: doc.connectDisabledReason ?? undefined,
    connectRequirements: (doc.connectRequirements ??
      undefined) as Prisma.InputJsonValue,
    stripeCustomerId: doc.stripeCustomerId ?? undefined,
    stripeSubscriptionId: doc.stripeSubscriptionId ?? undefined,
    stripeSubscriptionItemId: doc.stripeSubscriptionItemId ?? undefined,
    stripePriceId: doc.stripePriceId ?? undefined,
    stripeProductId: doc.stripeProductId ?? undefined,
    stripeLivemode: doc.stripeLivemode ?? false,
    plan: doc.plan ?? "free",
    billingInterval: toBillingInterval(doc.billingInterval),
    currency: doc.currency ?? "usd",
    seatQuantity: doc.seatQuantity ?? 0,
    seatQuantityUpdatedAt: doc.seatQuantityUpdatedAt ?? undefined,
    subscriptionStatus: toSubscriptionStatus(doc.subscriptionStatus) ?? "none",
    cancelAtPeriodEnd: doc.cancelAtPeriodEnd ?? false,
    canceledAt: doc.canceledAt ?? undefined,
    currentPeriodStart: doc.currentPeriodStart ?? undefined,
    currentPeriodEnd: doc.currentPeriodEnd ?? undefined,
    nextInvoiceAt: doc.nextInvoiceAt ?? undefined,
    lastInvoiceId: doc.lastInvoiceId ?? undefined,
    lastPaymentStatus: doc.lastPaymentStatus ?? undefined,
    lastPaymentAt: doc.lastPaymentAt ?? undefined,
    joinedAt: doc.joinedAt ?? undefined,
    upgradedAt: doc.upgradedAt ?? undefined,
    downgradedAt: doc.downgradedAt ?? undefined,
    accessState: toAccessState(doc.accessState) ?? "free",
    gracePeriodEndsAt: doc.gracePeriodEndsAt ?? undefined,
    version: doc.version ?? 0,
    lastStripeEventId: doc.lastStripeEventId ?? undefined,
    updatedAt: doc.updatedAt ?? undefined,
  };
  try {
    await prisma.organizationBilling.upsert({
      where: { orgId },
      create: {
        id,
        orgId,
        ...payload,
        createdAt: doc.createdAt ?? undefined,
      },
      update: payload,
    });
  } catch (err) {
    handleDualWriteError("OrganizationBilling", err);
  }
};

const syncOrgUsageToPostgres = async (doc: OrgUsageCountersDoc | null) => {
  if (!shouldDualWrite || !doc) return;
  const orgId = toIdString(doc.orgId);
  if (!orgId) return;
  const id = toIdString(doc._id) ?? orgId;
  const payload = {
    appointmentsUsed: doc.appointmentsUsed ?? 0,
    toolsUsed: doc.toolsUsed ?? 0,
    usersActiveCount: doc.usersActiveCount ?? 0,
    usersBillableCount: doc.usersBillableCount ?? 0,
    freeAppointmentsLimit: doc.freeAppointmentsLimit ?? 120,
    freeToolsLimit: doc.freeToolsLimit ?? 200,
    freeUsersLimit: doc.freeUsersLimit ?? 10,
    freeLimitReachedAt: doc.freeLimitReachedAt ?? undefined,
    updatedAt: doc.updatedAt ?? undefined,
  };
  try {
    await prisma.organizationUsageCounter.upsert({
      where: { orgId },
      create: {
        id,
        orgId,
        ...payload,
        createdAt: doc.createdAt ?? undefined,
      },
      update: payload,
    });
  } catch (err) {
    handleDualWriteError("OrganizationUsageCounter", err);
  }
};

async function computeBillableSeats(orgId: string): Promise<number> {
  // Every active user in this org is billable
  if (isReadFromPostgres()) {
    return prisma.userOrganization.count({
      where: { organizationReference: orgId, active: true },
    });
  }
  return UserOrganizationModel.countDocuments({
    organizationReference: orgId,
    active: true,
  });
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

export const StripeService = {
  // ----------------------------
  // CONNECT (existing + improved)
  // ----------------------------
  async createOrGetConnectedAccount(organisationId: string) {
    const stripe = getStripeClient();

    if (isReadFromPostgres()) {
      const org = await prisma.organization.findUnique({
        where: { id: organisationId },
      });
      if (!org) throw new Error("Organisation not found");

      if (org.stripeAccountId) return { accountId: org.stripeAccountId };

      const account = await stripe.accounts.create({});

      await prisma.organization.update({
        where: { id: organisationId },
        data: { stripeAccountId: account.id },
      });

      await prisma.organizationBilling.upsert({
        where: { orgId: organisationId },
        create: { orgId: organisationId, connectAccountId: account.id },
        update: { connectAccountId: account.id },
      });

      return { accountId: account.id };
    }

    const org = await OrganizationModel.findById(organisationId);
    if (!org) throw new Error("Organisation not found");

    if (org.stripeAccountId) return { accountId: org.stripeAccountId };

    // NOTE: For Standard accounts, onboarding flows differ (OAuth / account links are common).
    // Keep your existing approach if it works in your Connect settings.
    const account = await stripe.accounts.create({});

    org.stripeAccountId = account.id;
    await org.save();

    if (shouldDualWrite) {
      try {
        await prisma.organization.updateMany({
          where: { id: organisationId },
          data: { stripeAccountId: account.id },
        });
      } catch (err) {
        handleDualWriteError("Organization stripeAccountId", err);
      }
    }

    // Ensure OrgBilling doc exists and store connectAccountId
    const billingDoc = (await OrgBilling.findOneAndUpdate(
      { orgId: organisationId },
      {
        $set: { connectAccountId: account.id },
        $setOnInsert: { orgId: organisationId },
      },
      { upsert: true, new: true },
    )) as unknown as OrgBillingDoc | null;
    await syncOrgBillingToPostgres(billingDoc);

    return { accountId: account.id };
  },

  async getAccountStatus(organisationId: string) {
    if (isReadFromPostgres()) {
      const [orgBilling, orgUsage] = await Promise.all([
        prisma.organizationBilling.findUnique({
          where: { orgId: organisationId },
        }),
        prisma.organizationUsageCounter.findUnique({
          where: { orgId: organisationId },
        }),
      ]);
      return { orgBilling, orgUsage };
    }

    const org = await OrganizationModel.findById(organisationId);
    if (!org) {
      throw new Error("Organistaion not found");
    }

    const orgBilling = (await OrgBilling.findOne({
      orgId: org._id,
    }).lean()) as unknown as OrgBillingDoc | null;

    const orgUsage = (await OrgUsageCounters.findOne({
      orgId: org._id,
    }).lean()) as unknown as OrgUsageCountersDoc | null;

    return {
      orgBilling: orgBilling,
      orgUsage: orgUsage,
    };
  },

  async createOnboardingLink(organisationId: string) {
    const stripe = getStripeClient();

    if (isReadFromPostgres()) {
      const orgBilling = await prisma.organizationBilling.findUnique({
        where: { orgId: organisationId },
      });

      if (!orgBilling?.connectAccountId)
        throw new Error("Organisation does not have a Stripe account");

      const accountSession = await stripe.accountSessions.create({
        account: orgBilling.connectAccountId,
        components: {
          account_onboarding: { enabled: true },
          tax_settings: {
            enabled: true,
            features: {},
          },
          tax_registrations: {
            enabled: true,
          },
        },
      });

      return { client_secret: accountSession.client_secret };
    }

    const org = await OrganizationModel.findById(organisationId);
    if (!org) throw new Error("No Organisation Found");

    const orgBilling = (await OrgBilling.findOne({
      orgId: org._id,
    })) as unknown as OrgBillingDoc | null;

    if (!orgBilling?.connectAccountId)
      throw new Error("Organisation does not have a Stripe account");

    const accountSession = await stripe.accountSessions.create({
      account: orgBilling.connectAccountId,
      components: {
        account_onboarding: { enabled: true },
        tax_settings: {
          enabled: true,
          features: {},
        },
        tax_registrations: {
          enabled: true,
        },
      },
    });

    return { client_secret: accountSession.client_secret };
  },

  // ----------------------------
  // SAAS SUBSCRIPTION (NEW)
  // ----------------------------

  async createBusinessCheckoutSession(
    orgId: string,
    interval: "month" | "year",
  ) {
    const stripe = getStripeClient();

    if (isReadFromPostgres()) {
      const org = await prisma.organization.findUnique({
        where: { id: orgId },
      });
      if (!org) throw new Error("Organisation not found");

      const { billing } = await ensureBillingDocs(orgId);

      if (!billing.connectAccountId && org.stripeAccountId) {
        await prisma.organizationBilling.update({
          where: { orgId },
          data: { connectAccountId: org.stripeAccountId },
        });
      }

      const seats = await computeBillableSeats(orgId);
      if (seats < 1)
        throw new Error(
          "No users found. Add at least 1 user to start Business.",
        );

      await prisma.organizationUsageCounter.updateMany({
        where: { orgId },
        data: { usersActiveCount: seats, usersBillableCount: seats },
      });

      const priceId =
        interval === "month"
          ? process.env.STRIPE_PRICE_BUSINESS_MONTH
          : process.env.STRIPE_PRICE_BUSINESS_YEAR;

      if (!priceId) throw new Error("Missing STRIPE_PRICE_BUSINESS_* env vars");

      let billingRow = await prisma.organizationBilling.findUnique({
        where: { orgId },
      });
      if (!billingRow?.stripeCustomerId) {
        const customer = await stripe.customers.create({
          name: org.name,
          metadata: {
            orgId: String(orgId),
            connectAccountId: String(billingRow?.connectAccountId ?? ""),
          },
        });

        billingRow = await prisma.organizationBilling.update({
          where: { orgId },
          data: { stripeCustomerId: customer.id },
        });
      }

      const successUrl = `${process.env.APP_URL}/success?session_id={CHECKOUT_SESSION_ID}"`;
      const cancelUrl = `${process.env.APP_URL}/success?session_id={CHECKOUT_SESSION_ID}"`;

      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        customer: billingRow?.stripeCustomerId ?? undefined,
        line_items: [
          {
            price: priceId,
            quantity: seats,
          },
        ],
        success_url: successUrl,
        cancel_url: cancelUrl,
        allow_promotion_codes: true,
        subscription_data: {
          metadata: {
            orgId: String(orgId),
            connectAccountId: String(billingRow?.connectAccountId ?? ""),
          },
        },
        tax_id_collection: {
          enabled: true,
        },
        automatic_tax: {
          enabled: true,
        },
        billing_address_collection: "auto",
        metadata: {
          orgId: String(orgId),
          interval,
          seats: String(seats),
        },
        customer_update: {
          name: "auto",
          address: "auto",
        },
      });

      return { url: session.url };
    }

    const org = await OrganizationModel.findById(orgId);
    if (!org) throw new Error("Organisation not found");

    const { billing } = await ensureBillingDocs(orgId);

    // Ensure connectAccountId mirrored into billing
    if (!billing.connectAccountId && org.stripeAccountId) {
      billing.connectAccountId = org.stripeAccountId;
      await billing.save();
      await syncOrgBillingToPostgres(billing);
    }

    const seats = await computeBillableSeats(orgId);
    if (seats < 1)
      throw new Error("No users found. Add at least 1 user to start Business.");

    // Update usage counters snapshot
    await OrgUsageCounters.updateOne(
      { orgId },
      { usersActiveCount: seats, usersBillableCount: seats },
    );
    if (shouldDualWrite) {
      try {
        await prisma.organizationUsageCounter.updateMany({
          where: { orgId },
          data: { usersActiveCount: seats, usersBillableCount: seats },
        });
      } catch (err) {
        handleDualWriteError("OrganizationUsageCounter snapshot", err);
      }
    }

    const priceId =
      interval === "month"
        ? process.env.STRIPE_PRICE_BUSINESS_MONTH
        : process.env.STRIPE_PRICE_BUSINESS_YEAR;

    if (!priceId) throw new Error("Missing STRIPE_PRICE_BUSINESS_* env vars");

    // Create/reuse platform Customer
    if (!billing.stripeCustomerId) {
      const customer = await stripe.customers.create({
        name: org.name,
        metadata: {
          orgId: String(orgId),
          connectAccountId: String(billing.connectAccountId ?? ""),
        },
      });

      billing.stripeCustomerId = customer.id;
      await billing.save();
      await syncOrgBillingToPostgres(billing);
    }

    const successUrl = `${process.env.APP_URL}/success?session_id={CHECKOUT_SESSION_ID}"`;
    const cancelUrl = `${process.env.APP_URL}/success?session_id={CHECKOUT_SESSION_ID}"`;

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: billing.stripeCustomerId,
      line_items: [
        {
          price: priceId,
          quantity: seats,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      allow_promotion_codes: true,
      subscription_data: {
        metadata: {
          orgId: String(orgId),
          connectAccountId: String(billing.connectAccountId ?? ""),
        },
      },
      tax_id_collection: {
        enabled: true,
      },
      automatic_tax: {
        enabled: true,
      },
      billing_address_collection: "auto",
      metadata: {
        orgId: String(orgId),
        interval,
        seats: String(seats),
      },
      customer_update: {
        name: "auto",
        address: "auto",
      },
    });

    return { url: session.url };
  },

  async createCustomerPortalSession(orgId: string) {
    const stripe = getStripeClient();
    const { billing } = await ensureBillingDocs(orgId);

    if (!billing.stripeCustomerId) {
      throw new Error("No billing customer found. Upgrade to Business first.");
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: billing.stripeCustomerId,
      return_url: `${process.env.APP_URL}/organization`,
    });

    return { url: session.url };
  },

  async syncSubscriptionSeats(orgId: string) {
    const stripe = getStripeClient();
    const { billing } = await ensureBillingDocs(orgId);

    if (isReadFromPostgres()) {
      const billingRow = await prisma.organizationBilling.findUnique({
        where: { orgId },
      });

      if (!billingRow || billingRow.plan !== "business")
        return { updated: false, reason: "not_business" };
      const subscriptionItemId = billingRow.stripeSubscriptionItemId;
      if (!subscriptionItemId)
        return { updated: false, reason: "missing_item_id" };

      const subscriptionStatus = billingRow.subscriptionStatus ?? "none";
      if (!["active", "trialing", "past_due"].includes(subscriptionStatus)) {
        return { updated: false, reason: "subscription_not_syncable" };
      }

      const newSeats = await computeBillableSeats(orgId);
      const oldSeats = billingRow.seatQuantity ?? 0;
      if (newSeats === oldSeats) return { updated: false, reason: "no_change" };

      const prorationBehavior =
        newSeats > oldSeats ? "create_prorations" : "none";

      await stripe.subscriptionItems.update(subscriptionItemId, {
        quantity: newSeats,
        proration_behavior: prorationBehavior,
      });

      await prisma.organizationUsageCounter.updateMany({
        where: { orgId },
        data: { usersActiveCount: newSeats, usersBillableCount: newSeats },
      });

      await prisma.organizationBilling.update({
        where: { orgId },
        data: {
          seatQuantity: newSeats,
          seatQuantityUpdatedAt: new Date(),
        },
      });

      return { updated: true, oldSeats, newSeats, prorationBehavior };
    }

    if (billing.plan !== "business")
      return { updated: false, reason: "not_business" };
    const subscriptionItemId = billing.stripeSubscriptionItemId;
    if (!subscriptionItemId)
      return { updated: false, reason: "missing_item_id" };

    // Don’t sync if fully canceled/unpaid/suspended
    const subscriptionStatus = billing.subscriptionStatus ?? "none";
    if (!["active", "trialing", "past_due"].includes(subscriptionStatus)) {
      return { updated: false, reason: "subscription_not_syncable" };
    }

    const newSeats = await computeBillableSeats(orgId);
    const oldSeats = billing.seatQuantity ?? 0;
    if (newSeats === oldSeats) return { updated: false, reason: "no_change" };

    const prorationBehavior =
      newSeats > oldSeats ? "create_prorations" : "none";

    await stripe.subscriptionItems.update(subscriptionItemId, {
      quantity: newSeats,
      proration_behavior: prorationBehavior,
    });

    await OrgUsageCounters.updateOne(
      { orgId },
      { usersActiveCount: newSeats, usersBillableCount: newSeats },
    );
    if (shouldDualWrite) {
      try {
        await prisma.organizationUsageCounter.updateMany({
          where: { orgId },
          data: { usersActiveCount: newSeats, usersBillableCount: newSeats },
        });
      } catch (err) {
        handleDualWriteError("OrganizationUsageCounter syncSeats", err);
      }
    }

    billing.seatQuantity = newSeats;
    billing.seatQuantityUpdatedAt = new Date();
    await billing.save();
    await syncOrgBillingToPostgres(billing);

    return { updated: true, oldSeats, newSeats, prorationBehavior };
  },

  // ----------------------------
  // EXISTING PAYMENT INTENTS (keep)
  // ----------------------------

  async createPaymentIntentForAppointment(appointmentId: string) {
    const stripe = getStripeClient();

    if (isReadFromPostgres()) {
      const appointment = await prisma.appointment.findUnique({
        where: { id: appointmentId },
        select: {
          id: true,
          status: true,
          organisationId: true,
          appointmentType: true,
          companion: true,
        },
      });
      if (!appointment) throw new Error("Appointment not found");

      const normalizedStatus = appointment.status;
      if (!["REQUESTED", "UPCOMING"].includes(normalizedStatus)) {
        throw new Error("Appointment does not allow payment");
      }

      const serviceId = extractAppointmentTypeId(appointment.appointmentType);
      if (!serviceId) throw new Error("Service not found");

      const service = await prisma.service.findUnique({
        where: { id: serviceId },
      });
      if (!service) throw new Error("Service not found");

      const organisation = await prisma.organization.findUnique({
        where: { id: appointment.organisationId },
        select: { stripeAccountId: true },
      });
      if (!organisation?.stripeAccountId)
        throw new Error("Organisation has no Stripe account");

      const { parentId, companionId } = extractCompanionRefs(
        appointment.companion,
      );

      const amount = toStripeAmount(service.cost);
      const currency = await getOrgBillingCurrency(appointment.organisationId);

      const paymentIntent = await stripe.paymentIntents.create({
        amount,
        currency,
        metadata: {
          type: "APPOINTMENT_BOOKING",
          appointmentId,
          organisationId: appointment.organisationId,
          parentId: parentId ?? "",
          companionId: companionId ?? "",
        },
        transfer_data: { destination: organisation.stripeAccountId },
      });

      return {
        paymentIntentId: paymentIntent.id,
        clientSecret: paymentIntent.client_secret,
        amount: service.cost,
        currency,
      };
    }

    const appointment = await AppointmentModel.findById(appointmentId);
    if (!appointment) throw new Error("Appointment not found");

    const rawStatus = appointment.status as string;
    const normalizedStatus =
      rawStatus === "NO_PAYMENT" ? "REQUESTED" : rawStatus;
    if (!["REQUESTED", "UPCOMING"].includes(normalizedStatus)) {
      throw new Error("Appointment does not allow payment");
    }

    const service = await ServiceModel.findById(
      appointment.appointmentType?.id,
    );
    if (!service) throw new Error("Service not found");

    const organisation = await OrganizationModel.findById(
      appointment.organisationId,
    );
    if (!organisation?.stripeAccountId)
      throw new Error("Organisation has no Stripe account");

    const amount = toStripeAmount(service.cost);
    const currency = await getOrgBillingCurrency(appointment.organisationId);

    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency,
      metadata: {
        type: "APPOINTMENT_BOOKING",
        appointmentId,
        organisationId: appointment.organisationId,
        parentId: appointment.companion.parent.id,
        companionId: appointment.companion.id,
      },
      transfer_data: { destination: organisation.stripeAccountId },
    });

    await AppointmentModel.updateOne(
      { _id: appointmentId },
      { stripePaymentIntentId: paymentIntent.id },
    );

    return {
      paymentIntentId: paymentIntent.id,
      clientSecret: paymentIntent.client_secret,
      amount: service.cost,
      currency,
    };
  },

  async createPaymentIntentForInvoice(invoiceId: string) {
    const stripe = getStripeClient();

    if (isReadFromPostgres()) {
      let invoice = await prisma.invoice.findUnique({
        where: { id: invoiceId },
      });
      if (!invoice) throw new Error("Invoice not found");

      if (!["AWAITING_PAYMENT", "PENDING"].includes(invoice.status)) {
        throw new Error("Invoice is not payable");
      }
      if (invoice.paymentCollectionMethod === "PAYMENT_AT_CLINIC") {
        throw new Error("Invoice is marked for in-clinic payment");
      }

      if (
        invoice.stripeCheckoutSessionId &&
        invoice.paymentCollectionMethod === "PAYMENT_LINK"
      ) {
        await prisma.invoice.updateMany({
          where: { id: invoiceId },
          data: {
            paymentCollectionMethod: "PAYMENT_INTENT",
            stripeCheckoutSessionId: null,
            stripeCheckoutUrl: null,
          },
        });

        invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
        if (!invoice) throw new Error("Invoice not found after switch");
      }

      if (invoice.stripePaymentIntentId) {
        return this.retrievePaymentIntent(invoice.stripePaymentIntentId);
      }

      if (!invoice.organisationId) {
        throw new Error("Invoice missing organisation");
      }

      const organisation = await prisma.organization.findUnique({
        where: { id: invoice.organisationId },
        select: { stripeAccountId: true },
      });
      if (!organisation?.stripeAccountId) {
        throw new Error(
          "Organisation does not have a Stripe connected account",
        );
      }

      const amountToPay = invoice.totalAmount;
      const stripeAmount = toStripeAmount(amountToPay);

      const paymentIntent = await stripe.paymentIntents.create({
        amount: stripeAmount,
        currency: invoice.currency || "usd",
        metadata: {
          type: "INVOICE_PAYMENT",
          invoiceId,
          appointmentId: invoice.appointmentId || "",
          organisationId: invoice.organisationId ?? "",
          parentId: invoice.parentId ?? "",
          companionId: invoice.companionId ?? "",
        },
        description: `Payment for Invoice ${invoiceId}`,
        transfer_data: { destination: organisation.stripeAccountId },
      });

      await InvoiceService.attachStripeDetails(invoiceId, {
        stripePaymentIntentId: paymentIntent.id,
        status: "AWAITING_PAYMENT",
        paymentCollectionMethod: "PAYMENT_INTENT",
      });

      return {
        paymentIntentId: paymentIntent.id,
        clientSecret: paymentIntent.client_secret,
        amount: amountToPay,
        currency: invoice.currency || "usd",
      };
    }

    let invoice = await InvoiceModel.findById(invoiceId);
    if (!invoice) throw new Error("Invoice not found");

    if (!["AWAITING_PAYMENT", "PENDING"].includes(invoice.status)) {
      throw new Error("Invoice is not payable");
    }
    if (invoice.paymentCollectionMethod === "PAYMENT_AT_CLINIC") {
      throw new Error("Invoice is marked for in-clinic payment");
    }

    // 🔒 Switch payment path if coming from PAYMENT_LINK
    if (
      invoice.stripeCheckoutSessionId &&
      invoice.paymentCollectionMethod === "PAYMENT_LINK"
    ) {
      await InvoiceModel.updateOne(
        {
          _id: invoiceId,
          status: { $in: ["AWAITING_PAYMENT", "PENDING"] },
          paymentCollectionMethod: "PAYMENT_LINK",
          stripePaymentIntentId: { $in: [null, undefined] },
        },
        {
          $set: {
            paymentCollectionMethod: "PAYMENT_INTENT",
            stripeCheckoutSessionId: null,
            stripeCheckoutUrl: null,
          },
        },
      );
      if (shouldDualWrite) {
        try {
          await prisma.invoice.updateMany({
            where: { id: invoiceId },
            data: {
              paymentCollectionMethod: "PAYMENT_INTENT",
              stripeCheckoutSessionId: null,
              stripeCheckoutUrl: null,
            },
          });
        } catch (err) {
          handleDualWriteError("Invoice switch payment path", err);
        }
      }

      // 🔁 re-fetch to avoid stale state
      invoice = await InvoiceModel.findById(invoiceId);
      if (!invoice) throw new Error("Invoice not found after switch");
    }

    // Prevent duplicate PI
    if (invoice.stripePaymentIntentId) {
      return this.retrievePaymentIntent(invoice.stripePaymentIntentId);
    }

    const organisation = await OrganizationModel.findById(
      invoice.organisationId,
    );
    if (!organisation?.stripeAccountId) {
      throw new Error("Organisation does not have a Stripe connected account");
    }

    const amountToPay = invoice.totalAmount;
    const stripeAmount = toStripeAmount(amountToPay);

    const paymentIntent = await stripe.paymentIntents.create({
      amount: stripeAmount,
      currency: invoice.currency || "usd",
      metadata: {
        type: "INVOICE_PAYMENT",
        invoiceId,
        appointmentId: invoice.appointmentId || "",
        organisationId: invoice.organisationId ?? "",
        parentId: invoice.parentId ?? "",
        companionId: invoice.companionId ?? "",
      },
      description: `Payment for Invoice ${invoiceId}`,
      transfer_data: { destination: organisation.stripeAccountId },
    });

    await InvoiceService.attachStripeDetails(invoiceId, {
      stripePaymentIntentId: paymentIntent.id,
      status: "AWAITING_PAYMENT",
      paymentCollectionMethod: "PAYMENT_INTENT",
    });

    return {
      paymentIntentId: paymentIntent.id,
      clientSecret: paymentIntent.client_secret,
      amount: amountToPay,
      currency: invoice.currency || "usd",
    };
  },

  async createCheckoutSessionForInvoice(invoiceId: string) {
    const stripe = getStripeClient();

    if (isReadFromPostgres()) {
      const invoice = await prisma.invoice.findUnique({
        where: { id: invoiceId },
      });
      if (!invoice) throw new Error("Invoice not found");

      if (!["AWAITING_PAYMENT", "PENDING"].includes(invoice.status)) {
        throw new Error("Invoice is not payable");
      }
      if (invoice.paymentCollectionMethod === "PAYMENT_AT_CLINIC") {
        throw new Error("Invoice is marked for in-clinic payment");
      }

      if (invoice.stripePaymentIntentId) {
        throw new Error("Invoice already has a PaymentIntent");
      }
      if (invoice.stripeCheckoutSessionId) {
        return {
          sessionId: invoice.stripeCheckoutSessionId,
          url: invoice.stripeCheckoutUrl,
        };
      }

      if (!invoice.organisationId) {
        throw new Error("Invoice missing organisation");
      }

      const organisation = await prisma.organization.findUnique({
        where: { id: invoice.organisationId },
        select: { stripeAccountId: true },
      });
      if (!organisation?.stripeAccountId)
        throw new Error("Organisation not connected to Stripe");

      const items = Array.isArray(invoice.items)
        ? invoice.items
        : ([] as unknown[]);
      if (items.length === 0) {
        throw new Error("Invoice items are missing");
      }

      const expiresAt = Math.floor((Date.now() + 24 * 60 * 60 * 1000) / 1000);

      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        line_items: items.map((item) => ({
          price_data: {
            currency: invoice.currency || "usd",
            product_data: {
              name: (item as { name?: string }).name ?? "Service",
              description:
                (item as { description?: string }).description ?? undefined,
            },
            unit_amount: Math.round(
              (item as { unitPrice: number }).unitPrice * 100,
            ),
          },
          quantity: (item as { quantity: number }).quantity,
        })),
        metadata: {
          type: "INVOICE_PAYMENT",
          invoiceId: invoice.id,
          appointmentId: invoice.appointmentId ?? "",
          organisationId: invoice.organisationId ?? "",
          parentId: invoice.parentId ?? "",
        },
        payment_intent_data: {
          metadata: {
            type: "INVOICE_PAYMENT",
            invoiceId: invoice.id,
            appointmentId: invoice.appointmentId ?? "",
            organisationId: invoice.organisationId ?? "",
            parentId: invoice.parentId ?? "",
          },
          transfer_data: { destination: organisation.stripeAccountId },
        },
        success_url: `${process.env.APP_URL}/success?session_id={CHECKOUT_SESSION_ID}"`,
        cancel_url: `${process.env.APP_URL}/success?session_id={CHECKOUT_SESSION_ID}"`,
        expires_at: expiresAt,
      });

      await prisma.invoice.updateMany({
        where: { id: invoiceId },
        data: {
          paymentCollectionMethod: "PAYMENT_LINK",
          stripeCheckoutSessionId: session.id,
          stripeCheckoutUrl: session.url ?? undefined,
        },
      });

      return { sessionId: session.id, url: session.url };
    }

    const invoice = await InvoiceModel.findById(invoiceId);
    if (!invoice) throw new Error("Invoice not found");

    // Guard: payable only
    if (!["AWAITING_PAYMENT", "PENDING"].includes(invoice.status)) {
      throw new Error("Invoice is not payable");
    }
    if (invoice.paymentCollectionMethod === "PAYMENT_AT_CLINIC") {
      throw new Error("Invoice is marked for in-clinic payment");
    }

    // Guard: don’t start two payment paths
    if (invoice.stripePaymentIntentId) {
      throw new Error("Invoice already has a PaymentIntent");
    }
    if (invoice.stripeCheckoutSessionId) {
      // optionally return existing url to re-send
      return {
        sessionId: invoice.stripeCheckoutSessionId,
        url: invoice.stripeCheckoutUrl,
      };
    }

    const organisation = await OrganizationModel.findById(
      invoice.organisationId,
    );
    if (!organisation?.stripeAccountId)
      throw new Error("Organisation not connected to Stripe");

    // Optional expiry (recommended): e.g. 24 hours
    const expiresAt = Math.floor((Date.now() + 24 * 60 * 60 * 1000) / 1000);

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: invoice.items.map((item) => ({
        price_data: {
          currency: invoice.currency || "usd",
          product_data: {
            name: item.name,
            description: item.description ?? undefined,
          },
          unit_amount: Math.round(item.unitPrice * 100),
        },
        quantity: item.quantity,
      })),
      metadata: {
        type: "INVOICE_PAYMENT",
        invoiceId: invoice._id.toString(),
        appointmentId: invoice.appointmentId ?? "",
        organisationId: invoice.organisationId ?? "",
        parentId: invoice.parentId ?? "",
      },
      payment_intent_data: {
        metadata: {
          type: "INVOICE_PAYMENT",
          invoiceId: invoice._id.toString(),
          appointmentId: invoice.appointmentId ?? "",
          organisationId: invoice.organisationId ?? "",
          parentId: invoice.parentId ?? "",
        },
        transfer_data: { destination: organisation.stripeAccountId },
      },
      success_url: `${process.env.APP_URL}/success?session_id={CHECKOUT_SESSION_ID}"`,
      cancel_url: `${process.env.APP_URL}/success?session_id={CHECKOUT_SESSION_ID}"`,
      expires_at: expiresAt,
    });

    await InvoiceModel.updateOne(
      { _id: invoiceId },
      {
        $set: {
          paymentCollectionMethod: "PAYMENT_LINK",
          stripeCheckoutSessionId: session.id,
          stripeCheckoutUrl: session.url,
          paymentDueAt: new Date(expiresAt * 1000),
        },
      },
    );
    if (shouldDualWrite) {
      try {
        await prisma.invoice.updateMany({
          where: { id: invoiceId },
          data: {
            paymentCollectionMethod: "PAYMENT_LINK",
            stripeCheckoutSessionId: session.id,
            stripeCheckoutUrl: session.url ?? undefined,
          },
        });
      } catch (err) {
        handleDualWriteError("Invoice checkout session", err);
      }
    }

    return { sessionId: session.id, url: session.url };
  },

  async retrievePaymentIntent(paymentIntentId: string) {
    const stripe = getStripeClient();
    return stripe.paymentIntents.retrieve(paymentIntentId);
  },

  async retrieveCheckoutSession(sessionId: string) {
    const stripe = getStripeClient();
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["payment_intent"],
    });

    return {
      status: session.payment_status,
      total: session.amount_total ? session.amount_total / 100 : 0,
    };
  },

  async refundPaymentIntent(paymentIntentId: string) {
    const stripe = getStripeClient();

    if (isReadFromPostgres()) {
      const invoice = await prisma.invoice.findFirst({
        where: { stripePaymentIntentId: paymentIntentId },
      });
      if (!invoice) throw new Error("Invoice not found");

      const paymentIntent = await stripe.paymentIntents.retrieve(
        paymentIntentId,
        { expand: ["latest_charge"] },
      );

      const charge = paymentIntent.latest_charge as Stripe.Charge;
      if (!charge) throw new Error("No charge found for PaymentIntent");

      const refund = await stripe.refunds.create({ charge: charge.id });
      await InvoiceService.markRefunded(invoice.id);

      return {
        refundId: refund.id,
        status: refund.status,
        amountRefunded: refund.amount / 100,
      };
    }

    const invoice = await InvoiceModel.findOne({
      stripePaymentIntentId: paymentIntentId,
    });
    if (!invoice) throw new Error("Invoice not found");

    const paymentIntent = await stripe.paymentIntents.retrieve(
      paymentIntentId,
      {
        expand: ["latest_charge"],
      },
    );

    const charge = paymentIntent.latest_charge as Stripe.Charge;
    if (!charge) throw new Error("No charge found for PaymentIntent");

    const refund = await stripe.refunds.create({ charge: charge.id });
    await InvoiceService.markRefunded(invoice._id.toString());

    return {
      refundId: refund.id,
      status: refund.status,
      amountRefunded: refund.amount / 100,
    };
  },

  // ----------------------------
  // WEBHOOK VERIFICATION (existing)
  // ----------------------------
  verifyWebhook(body: Buffer, signature: string | string[] | undefined) {
    const stripe = getStripeClient();
    if (!signature) throw new Error("Missing Stripe signature header");
    if (Array.isArray(signature))
      throw new Error("Invalid Stripe signature header format");

    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET is not configured");

    return stripe.webhooks.constructEvent(body, signature, secret);
  },

  // ----------------------------
  // WEBHOOK HANDLER (UPGRADED)
  // ----------------------------
  async handleWebhookEvent(event: Stripe.Event) {
    logger.info("Stripe Webhook received:", event.type);

    switch (event.type) {
      // marketplace flows (existing)
      case "payment_intent.succeeded":
        await this._handlePaymentSucceeded(event.data.object);
        break;

      case "payment_intent.payment_failed":
        await this._handlePaymentFailed(event.data.object);
        break;

      case "charge.refunded":
        await this._handleRefund(event.data.object);
        break;

      // connect readiness
      case "account.updated":
        await this._handleAccountUpdated(event.data.object);
        break;

      // subscription lifecycle
      case "checkout.session.completed":
        await this._handleCheckoutCompleted(event.data.object);
        break;

      case "customer.subscription.updated":
        await this._handleSubscriptionUpdated(event.data.object);
        break;

      case "customer.subscription.deleted":
        await this._handleSubscriptionDeleted(event.data.object);
        break;

      case "invoice.paid":
        await this._handleInvoicePaid(event.data.object);
        break;

      case "invoice.payment_failed":
        await this._handleInvoicePaymentFailed(event.data.object);
        break;

      default:
        logger.info(`Unhandled Stripe event: ${event.type}`);
        break;
    }
  },

  // ----------------------------
  // WEBHOOK: CONNECT
  // ----------------------------
  async _handleAccountUpdated(account: Stripe.Account) {
    const canAccept =
      account.charges_enabled === true && account.payouts_enabled === true;

    if (isReadFromPostgres()) {
      await prisma.organizationBilling.updateMany({
        where: { connectAccountId: account.id },
        data: {
          currency: account.default_currency ?? undefined,
          connectChargesEnabled: account.charges_enabled ?? false,
          connectPayoutsEnabled: account.payouts_enabled ?? false,
          canAcceptPayments: canAccept,
          connectDisabledReason:
            account.requirements?.disabled_reason ?? undefined,
          connectRequirements: {
            currentlyDue: account.requirements?.currently_due ?? [],
            eventuallyDue: account.requirements?.eventually_due ?? [],
            pastDue: account.requirements?.past_due ?? [],
            pendingVerification:
              account.requirements?.pending_verification ?? [],
            errors: account.requirements?.errors ?? [],
          } as unknown as Prisma.InputJsonValue,
        },
      });
      return;
    }

    await OrgBilling.updateOne(
      { connectAccountId: account.id },
      {
        currency: account.default_currency,
        connectChargesEnabled: account.charges_enabled,
        connectPayoutsEnabled: account.payouts_enabled,
        canAcceptPayments: canAccept,
        connectDisabledReason: account.requirements?.disabled_reason ?? null,
        connectRequirements: {
          currentlyDue: account.requirements?.currently_due ?? [],
          eventuallyDue: account.requirements?.eventually_due ?? [],
          pastDue: account.requirements?.past_due ?? [],
          pendingVerification: account.requirements?.pending_verification ?? [],
          errors: account.requirements?.errors ?? [],
        },
      },
    );
    if (shouldDualWrite) {
      try {
        await prisma.organizationBilling.updateMany({
          where: { connectAccountId: account.id },
          data: {
            currency: account.default_currency ?? undefined,
            connectChargesEnabled: account.charges_enabled ?? false,
            connectPayoutsEnabled: account.payouts_enabled ?? false,
            canAcceptPayments: canAccept,
            connectDisabledReason:
              account.requirements?.disabled_reason ?? undefined,
            connectRequirements: {
              currentlyDue: account.requirements?.currently_due ?? [],
              eventuallyDue: account.requirements?.eventually_due ?? [],
              pastDue: account.requirements?.past_due ?? [],
              pendingVerification:
                account.requirements?.pending_verification ?? [],
              errors: account.requirements?.errors ?? [],
            } as unknown as Prisma.InputJsonValue,
          },
        });
      } catch (err) {
        handleDualWriteError("OrganizationBilling accountUpdated", err);
      }
    }
  },

  // ----------------------------
  // WEBHOOK: SUBSCRIPTIONS
  // ----------------------------
  async _handleCheckoutCompleted(session: Stripe.Checkout.Session) {
    if (session.mode === "subscription") {
      return this._handleSubscriptionCheckout(session);
    } else if (session.mode === "payment") {
      return this._handleInvoiceCheckout(session);
    }
  },

  async _handleSubscriptionUpdated(subscription: Stripe.Subscription) {
    const item = subscription.items.data[0];

    if (isReadFromPostgres()) {
      await prisma.organizationBilling.updateMany({
        where: { stripeSubscriptionId: subscription.id },
        data: {
          subscriptionStatus:
            toSubscriptionStatus(subscription.status) ?? "none",
          cancelAtPeriodEnd: subscription.cancel_at_period_end ?? false,
          canceledAt: subscription.canceled_at
            ? new Date(subscription.canceled_at * 1000)
            : undefined,
          seatQuantity: item?.quantity ?? 0,
          currentPeriodStart: new Date(item.current_period_start * 1000),
          currentPeriodEnd: new Date(item.current_period_end * 1000),
        },
      });
      return;
    }

    await OrgBilling.updateOne(
      { stripeSubscriptionId: subscription.id },
      {
        subscriptionStatus: subscription.status,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        canceledAt: subscription.canceled_at
          ? new Date(subscription.canceled_at * 1000)
          : null,

        seatQuantity: item?.quantity ?? 0,

        currentPeriodStart: new Date(item.current_period_start * 1000),
        currentPeriodEnd: new Date(item.current_period_end * 1000),
      },
    );
    if (shouldDualWrite) {
      try {
        await prisma.organizationBilling.updateMany({
          where: { stripeSubscriptionId: subscription.id },
          data: {
            subscriptionStatus:
              toSubscriptionStatus(subscription.status) ?? "none",
            cancelAtPeriodEnd: subscription.cancel_at_period_end ?? false,
            canceledAt: subscription.canceled_at
              ? new Date(subscription.canceled_at * 1000)
              : undefined,
            seatQuantity: item?.quantity ?? 0,
            currentPeriodStart: new Date(item.current_period_start * 1000),
            currentPeriodEnd: new Date(item.current_period_end * 1000),
          },
        });
      } catch (err) {
        handleDualWriteError("OrganizationBilling subscriptionUpdated", err);
      }
    }
  },

  async _handleSubscriptionDeleted(subscription: Stripe.Subscription) {
    if (isReadFromPostgres()) {
      await prisma.organizationBilling.updateMany({
        where: { stripeSubscriptionId: subscription.id },
        data: {
          plan: "free",
          accessState: "free",
          downgradedAt: new Date(),
          subscriptionStatus: "canceled",
          billingInterval: null,
          stripeSubscriptionItemId: null,
          stripePriceId: null,
          cancelAtPeriodEnd: false,
          currentPeriodStart: null,
          currentPeriodEnd: null,
          gracePeriodEndsAt: null,
        },
      });
      return;
    }

    await OrgBilling.updateOne(
      { stripeSubscriptionId: subscription.id },
      {
        plan: "free",
        accessState: "free",
        downgradedAt: new Date(),

        subscriptionStatus: "canceled",
        billingInterval: undefined,

        stripeSubscriptionItemId: null,
        stripePriceId: null,

        cancelAtPeriodEnd: false,
        currentPeriodStart: null,
        currentPeriodEnd: null,
        gracePeriodEndsAt: null,
      },
    );
    if (shouldDualWrite) {
      try {
        await prisma.organizationBilling.updateMany({
          where: { stripeSubscriptionId: subscription.id },
          data: {
            plan: "free",
            accessState: "free",
            downgradedAt: new Date(),
            subscriptionStatus: "canceled",
            billingInterval: undefined,
            stripeSubscriptionItemId: null,
            stripePriceId: null,
            cancelAtPeriodEnd: false,
            currentPeriodStart: null,
            currentPeriodEnd: null,
            gracePeriodEndsAt: null,
          },
        });
      } catch (err) {
        handleDualWriteError("OrganizationBilling subscriptionDeleted", err);
      }
    }
  },

  async _handleInvoicePaid(invoice: Stripe.Invoice) {
    const subscriptionValue = invoice.lines.data[0]?.subscription;
    const subscriptionId =
      typeof subscriptionValue === "string"
        ? subscriptionValue
        : subscriptionValue?.id;
    if (!subscriptionId) return;

    if (isReadFromPostgres()) {
      await prisma.organizationBilling.updateMany({
        where: { stripeSubscriptionId: subscriptionId },
        data: {
          lastInvoiceId: invoice.id ?? undefined,
          lastPaymentStatus: "paid",
          lastPaymentAt: new Date(),
          accessState: "active",
          gracePeriodEndsAt: null,
        },
      });
      return;
    }

    await OrgBilling.updateOne(
      { stripeSubscriptionId: subscriptionId },
      {
        lastInvoiceId: invoice.id,
        lastPaymentStatus: "paid",
        lastPaymentAt: new Date(),
        accessState: "active",
        gracePeriodEndsAt: null,
      },
    );
    if (shouldDualWrite) {
      try {
        await prisma.organizationBilling.updateMany({
          where: { stripeSubscriptionId: subscriptionId },
          data: {
            lastInvoiceId: invoice.id ?? undefined,
            lastPaymentStatus: "paid",
            lastPaymentAt: new Date(),
            accessState: "active",
            gracePeriodEndsAt: null,
          },
        });
      } catch (err) {
        handleDualWriteError("OrganizationBilling invoicePaid", err);
      }
    }
  },

  async _handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
    const subscriptionValue = invoice.lines.data[0]?.subscription;
    const subscriptionId =
      typeof subscriptionValue === "string"
        ? subscriptionValue
        : subscriptionValue?.id;
    if (!subscriptionId) return;

    const graceEnd = addDays(new Date(), 7);

    if (isReadFromPostgres()) {
      await prisma.organizationBilling.updateMany({
        where: { stripeSubscriptionId: subscriptionId },
        data: {
          lastInvoiceId: invoice.id ?? undefined,
          lastPaymentStatus: "failed",
          accessState: "past_due",
          gracePeriodEndsAt: graceEnd,
        },
      });
      return;
    }

    await OrgBilling.updateOne(
      { stripeSubscriptionId: subscriptionId },
      {
        lastInvoiceId: invoice.id,
        lastPaymentStatus: "failed",
        accessState: "past_due",
        gracePeriodEndsAt: graceEnd,
      },
    );
    if (shouldDualWrite) {
      try {
        await prisma.organizationBilling.updateMany({
          where: { stripeSubscriptionId: subscriptionId },
          data: {
            lastInvoiceId: invoice.id ?? undefined,
            lastPaymentStatus: "failed",
            accessState: "past_due",
            gracePeriodEndsAt: graceEnd,
          },
        });
      } catch (err) {
        handleDualWriteError("OrganizationBilling invoicePaymentFailed", err);
      }
    }
  },

  // ----------------------------
  // EXISTING HANDLERS (keep)
  // ----------------------------
  async _handlePaymentSucceeded(pi: Stripe.PaymentIntent) {
    const type = pi.metadata?.type;
    if (!type) {
      logger.error("payment_intent.succeeded missing metadata.type");
      return;
    }
    if (type === "INVOICE_PAYMENT") return this._handleInvoicePayment(pi);
    if (type === "APPOINTMENT_BOOKING")
      return this._handleAppointmentBookingPayment(pi);
    logger.error("Unknown payment type in metadata");
  },

  async _handleAppointmentBookingPayment(pi: Stripe.PaymentIntent) {
    // (your existing code unchanged)
    const appointmentId = pi.metadata?.appointmentId;
    if (!appointmentId) return;

    if (isReadFromPostgres()) {
      const appointment = await prisma.appointment.findUnique({
        where: { id: appointmentId },
        select: {
          id: true,
          appointmentType: true,
          organisationId: true,
          companion: true,
        },
      });
      if (!appointment) return;

      const openInvoice = await prisma.invoice.findFirst({
        where: {
          appointmentId,
          status: { in: ["AWAITING_PAYMENT", "PENDING"] },
        },
        orderBy: { createdAt: "desc" },
      });

      if (openInvoice) {
        const chargeId = pi.latest_charge as string;
        const charge = await getStripeClient().charges.retrieve(chargeId);

        await prisma.invoice.updateMany({
          where: {
            id: openInvoice.id,
            status: { in: ["AWAITING_PAYMENT", "PENDING"] },
          },
          data: {
            status: "PAID",
            stripePaymentIntentId: pi.id,
            stripeChargeId: charge.id,
            stripeReceiptUrl: charge.receipt_url ?? undefined,
            paymentCollectionMethod: "PAYMENT_INTENT",
            updatedAt: new Date(),
          },
        });

        await prisma.appointment.updateMany({
          where: { id: appointmentId },
          data: {
            status: "REQUESTED",
            updatedAt: new Date(),
            expiresAt: null,
          },
        });

        logger.info(
          `Appointment ${appointmentId} booking PAID. Invoice ${openInvoice.id} settled`,
        );
        return;
      }

      const existingInvoice = await prisma.invoice.findFirst({
        where: { appointmentId, status: "PAID" },
      });
      if (existingInvoice) return;

      const chargeId = pi.latest_charge as string;
      const charge = await getStripeClient().charges.retrieve(chargeId);

      const serviceId = extractAppointmentTypeId(appointment.appointmentType);
      if (!serviceId) return;

      const service = await prisma.service.findUnique({
        where: { id: serviceId },
      });
      if (!service) return;

      const { parentId, companionId } = extractCompanionRefs(
        appointment.companion,
      );

      await prisma.invoice.create({
        data: {
          appointmentId,
          organisationId: appointment.organisationId,
          parentId: parentId ?? undefined,
          companionId: companionId ?? undefined,
          currency: pi.currency ?? "usd",
          status: "PAID",
          items: [
            {
              name: service.name,
              description: service.description ?? undefined,
              quantity: 1,
              unitPrice: service.cost,
              total: service.cost,
            },
          ] as unknown as Prisma.InputJsonValue,
          subtotal: service.cost,
          discountTotal: 0,
          taxTotal: 0,
          totalAmount: service.cost,
          stripePaymentIntentId: pi.id,
          stripeChargeId: charge.id,
          stripeReceiptUrl: charge.receipt_url ?? undefined,
        },
      });

      await prisma.appointment.updateMany({
        where: { id: appointmentId },
        data: {
          status: "REQUESTED",
          updatedAt: new Date(),
          expiresAt: null,
        },
      });

      logger.info(`Appointment ${appointmentId} booking PAID. Invoice created`);
      return;
    }

    const appointment = await AppointmentModel.findById(appointmentId);
    if (!appointment) return;

    const openInvoice = await InvoiceModel.findOne({
      appointmentId,
      status: { $in: ["AWAITING_PAYMENT", "PENDING"] },
    }).sort({ createdAt: -1 });

    if (openInvoice) {
      const chargeId = pi.latest_charge as string;
      const charge = await getStripeClient().charges.retrieve(chargeId);

      await InvoiceService.attachStripeDetails(openInvoice._id.toString(), {
        status: "PAID",
        stripePaymentIntentId: pi.id,
        stripeChargeId: charge.id,
        stripeReceiptUrl: charge.receipt_url ?? undefined,
        paymentCollectionMethod: "PAYMENT_INTENT",
        paidAt: new Date(),
      });

      await AppointmentModel.updateOne(
        { _id: appointmentId },
        {
          status: "REQUESTED",
          stripePaymentIntentId: pi.id,
          stripeChargeId: charge.id,
          updatedAt: new Date(),
          expiresAt: undefined,
        },
      );
      if (shouldDualWrite) {
        try {
          await prisma.appointment.updateMany({
            where: { id: appointmentId },
            data: {
              status: "REQUESTED",
              updatedAt: new Date(),
              expiresAt: null,
            },
          });
        } catch (err) {
          handleDualWriteError("Appointment booking payment", err);
        }
      }

      logger.info(
        `Appointment ${appointmentId} booking PAID. Invoice ${openInvoice.id} settled`,
      );
      return;
    }

    const existingInvoice = await InvoiceModel.findOne({
      appointmentId,
      status: "PAID",
    });
    if (existingInvoice) return;

    const chargeId = pi.latest_charge as string;
    const charge = await getStripeClient().charges.retrieve(chargeId);

    const service = await ServiceModel.findById(
      appointment.appointmentType?.id,
    );
    if (!service) return;

    const invoice = await InvoiceModel.create({
      appointmentId,
      organisationId: appointment.organisationId,
      parentId: appointment.companion.parent.id,
      companionId: appointment.companion.id,
      currency: pi.currency,

      status: "PAID",
      items: [
        {
          name: service.name,
          description: service.description,
          quantity: 1,
          unitPrice: service.cost,
          total: service.cost,
        },
      ],
      subtotal: service.cost,
      discountTotal: 0,
      taxTotal: 0,
      totalAmount: service.cost,

      stripePaymentIntentId: pi.id,
      stripeChargeId: charge.id,
      stripeReceiptUrl: charge.receipt_url,
    });
    if (shouldDualWrite) {
      try {
        await prisma.invoice.create({
          data: {
            id: invoice._id.toString(),
            appointmentId,
            organisationId: appointment.organisationId,
            parentId: appointment.companion.parent.id,
            companionId: appointment.companion.id,
            currency: pi.currency,
            status: "PAID",
            items: invoice.items as unknown as Prisma.InputJsonValue,
            subtotal: invoice.subtotal,
            discountTotal: invoice.discountTotal ?? 0,
            taxTotal: invoice.taxTotal ?? 0,
            taxPercent: invoice.taxPercent ?? 0,
            totalAmount: invoice.totalAmount,
            paymentCollectionMethod:
              invoice.paymentCollectionMethod as Prisma.InvoiceCreateInput["paymentCollectionMethod"],
            stripePaymentIntentId: invoice.stripePaymentIntentId ?? undefined,
            stripeChargeId: invoice.stripeChargeId ?? undefined,
            stripeReceiptUrl: invoice.stripeReceiptUrl ?? undefined,
            createdAt: invoice.createdAt ?? undefined,
            updatedAt: invoice.updatedAt ?? undefined,
          },
        });
      } catch (err) {
        handleDualWriteError("Invoice create (appointment booking)", err);
      }
    }

    await AppointmentModel.updateOne(
      { _id: appointmentId },
      {
        status: "REQUESTED",
        invoiceId: invoice._id,
        stripePaymentIntentId: pi.id,
        stripeChargeId: charge.id,
        updatedAt: new Date(),
        expiresAt: undefined,
      },
    );
    if (shouldDualWrite) {
      try {
        await prisma.appointment.updateMany({
          where: { id: appointmentId },
          data: {
            status: "REQUESTED",
            updatedAt: new Date(),
            expiresAt: null,
          },
        });
      } catch (err) {
        handleDualWriteError("Appointment booking payment", err);
      }
    }

    logger.info(
      `Appointment ${appointmentId} booking PAID. Invoice ${invoice.id} created`,
    );
  },

  async _handleInvoicePayment(pi: Stripe.PaymentIntent) {
    const invoiceId = pi.metadata?.invoiceId;
    if (!invoiceId) return;

    if (isReadFromPostgres()) {
      const invoice = await prisma.invoice.findUnique({
        where: { id: invoiceId },
      });
      if (!invoice) return;

      if (invoice.status === "PAID") return;

      if (invoice.paymentCollectionMethod !== "PAYMENT_INTENT") {
        await this._refundByPaymentIntentId(pi.id);
        return;
      }

      const chargeId = pi.latest_charge as string;
      const charge = await getStripeClient().charges.retrieve(chargeId);

      await prisma.invoice.updateMany({
        where: { id: invoiceId },
        data: {
          status: "PAID",
          stripePaymentIntentId: pi.id,
          stripeChargeId: charge.id,
          stripeReceiptUrl: charge.receipt_url ?? undefined,
          updatedAt: new Date(),
        },
      });

      logger.info(`Invoice ${invoiceId} marked PAID`);
      return;
    }

    const invoice = await InvoiceModel.findById(invoiceId);
    if (!invoice) return;

    if (invoice.status === "PAID") return;

    // 🔒 Accept PI ONLY if invoice expects IN_APP
    if (invoice.paymentCollectionMethod !== "PAYMENT_INTENT") {
      await this._refundByPaymentIntentId(pi.id);
      return;
    }

    const chargeId = pi.latest_charge as string;
    const charge = await getStripeClient().charges.retrieve(chargeId);

    invoice.status = "PAID";
    invoice.stripePaymentIntentId = pi.id;
    invoice.stripeChargeId = charge.id;
    invoice.stripeReceiptUrl = charge.receipt_url!;
    invoice.updatedAt = new Date();
    await invoice.save();
    if (shouldDualWrite) {
      try {
        await prisma.invoice.updateMany({
          where: { id: invoice._id.toString() },
          data: {
            status: "PAID",
            stripePaymentIntentId: pi.id,
            stripeChargeId: charge.id,
            stripeReceiptUrl: charge.receipt_url ?? undefined,
            updatedAt: new Date(),
          },
        });
      } catch (err) {
        handleDualWriteError("Invoice payment", err);
      }
    }

    logger.info(`Invoice ${invoiceId} marked PAID`);
  },

  async _handlePaymentFailed(pi: Stripe.PaymentIntent) {
    const appointmentId = pi.metadata?.appointmentId;
    if (!appointmentId) return;

    if (isReadFromPostgres()) {
      const invoice = await prisma.invoice.findFirst({
        where: { appointmentId },
      });
      if (!invoice) return;
      await prisma.invoice.updateMany({
        where: { id: invoice.id },
        data: { status: "FAILED" },
      });
      logger.warn(`Invoice ${invoice.id} marked FAILED`);
      return;
    }

    const invoice = await InvoiceModel.findOne({ appointmentId });
    if (!invoice) return;

    await InvoiceModel.updateOne({ _id: invoice._id }, { status: "FAILED" });
    if (shouldDualWrite) {
      try {
        await prisma.invoice.updateMany({
          where: { id: invoice._id.toString() },
          data: { status: "FAILED" },
        });
      } catch (err) {
        handleDualWriteError("Invoice failed", err);
      }
    }
    logger.warn(`Invoice ${invoice.id} marked FAILED`);
  },

  async _handleRefund(charge: Stripe.Charge) {
    const appointmentId = charge.metadata?.appointmentId;
    if (!appointmentId) return;

    if (isReadFromPostgres()) {
      const invoice = await prisma.invoice.findFirst({
        where: { appointmentId },
      });
      if (!invoice) return;
      await prisma.invoice.updateMany({
        where: { id: invoice.id },
        data: { status: "REFUNDED" },
      });

      const notificationPayload = NotificationTemplates.Payment.REFUND_ISSUED(
        charge.amount / 100,
        charge.currency,
      );
      if (invoice.parentId) {
        await NotificationService.sendToUser(
          invoice.parentId,
          notificationPayload,
        );
      }

      logger.warn(`Invoice ${invoice.id} marked REFUNDED`);
      return;
    }

    const invoice = await InvoiceModel.findOne({ appointmentId });
    if (!invoice) return;

    await InvoiceModel.updateOne({ _id: invoice._id }, { status: "REFUNDED" });
    if (shouldDualWrite) {
      try {
        await prisma.invoice.updateMany({
          where: { id: invoice._id.toString() },
          data: { status: "REFUNDED" },
        });
      } catch (err) {
        handleDualWriteError("Invoice refunded", err);
      }
    }

    const notificationPayload = NotificationTemplates.Payment.REFUND_ISSUED(
      charge.amount / 100,
      charge.currency,
    );
    const parentId = invoice.parentId;
    await NotificationService.sendToUser(parentId!, notificationPayload);

    logger.warn(`Invoice ${invoice.id} marked REFUNDED`);
  },

  async _handleSubscriptionCheckout(session: Stripe.Checkout.Session) {
    const stripe = getStripeClient();

    const customerId = session.customer as string;
    const subscriptionId = session.subscription as string;
    if (!customerId || !subscriptionId) return;

    const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
      expand: ["items.data.price"],
    });

    const item = subscription.items.data[0];
    const price = item.price;

    const productId =
      typeof price.product === "string" ? price.product : price.product?.id;

    if (isReadFromPostgres()) {
      await prisma.organizationBilling.updateMany({
        where: { stripeCustomerId: customerId },
        data: {
          plan: "business",
          accessState: "active",
          upgradedAt: new Date(),
          stripeSubscriptionId: subscription.id,
          stripeSubscriptionItemId: item.id,
          stripePriceId: price.id,
          stripeProductId: productId ?? null,
          billingInterval: toBillingInterval(price.recurring?.interval),
          joinedAt: new Date(),
          subscriptionStatus:
            toSubscriptionStatus(subscription.status) ?? "none",
          cancelAtPeriodEnd: subscription.cancel_at_period_end ?? false,
          seatQuantity: item.quantity ?? 0,
          seatQuantityUpdatedAt: new Date(),
          currentPeriodStart: new Date(item.current_period_start * 1000),
          currentPeriodEnd: new Date(item.current_period_end * 1000),
          stripeLivemode: session.livemode ?? false,
          gracePeriodEndsAt: null,
        },
      });
      return;
    }

    await OrgBilling.updateOne(
      { stripeCustomerId: customerId },
      {
        plan: "business",
        accessState: "active",
        upgradedAt: new Date(),

        stripeSubscriptionId: subscription.id,
        stripeSubscriptionItemId: item.id,
        stripePriceId: price.id,
        stripeProductId: productId ?? null,
        billingInterval: price.recurring?.interval,
        joinedAt: new Date(),
        subscriptionStatus: subscription.status,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,

        seatQuantity: item.quantity ?? 0,
        seatQuantityUpdatedAt: new Date(),

        currentPeriodStart: new Date(item.current_period_start * 1000),
        currentPeriodEnd: new Date(item.current_period_end * 1000),

        stripeLivemode: session.livemode ?? false,
        gracePeriodEndsAt: null,
      },
    );
    if (shouldDualWrite) {
      try {
        await prisma.organizationBilling.updateMany({
          where: { stripeCustomerId: customerId },
          data: {
            plan: "business",
            accessState: "active",
            upgradedAt: new Date(),
            stripeSubscriptionId: subscription.id,
            stripeSubscriptionItemId: item.id,
            stripePriceId: price.id,
            stripeProductId: productId ?? null,
            billingInterval: toBillingInterval(price.recurring?.interval),
            joinedAt: new Date(),
            subscriptionStatus:
              toSubscriptionStatus(subscription.status) ?? "none",
            cancelAtPeriodEnd: subscription.cancel_at_period_end ?? false,
            seatQuantity: item.quantity ?? 0,
            seatQuantityUpdatedAt: new Date(),
            currentPeriodStart: new Date(item.current_period_start * 1000),
            currentPeriodEnd: new Date(item.current_period_end * 1000),
            stripeLivemode: session.livemode ?? false,
            gracePeriodEndsAt: null,
          },
        });
      } catch (err) {
        handleDualWriteError("OrganizationBilling subscriptionCheckout", err);
      }
    }
  },

  async _handleInvoiceCheckout(session: Stripe.Checkout.Session) {
    const invoiceId = session.metadata?.invoiceId;
    if (!invoiceId) return;

    if (isReadFromPostgres()) {
      const invoice = await prisma.invoice.findUnique({
        where: { id: invoiceId },
      });
      if (!invoice) return;

      if (invoice.status === "PAID") return;

      const shouldRefundPayment =
        invoice.paymentCollectionMethod !== "PAYMENT_LINK" ||
        (invoice.stripeCheckoutSessionId &&
          invoice.stripeCheckoutSessionId !== session.id);

      if (shouldRefundPayment) {
        await this._refundCheckoutSession(session);
        return;
      }

      await prisma.invoice.updateMany({
        where: { id: invoiceId },
        data: { status: "PAID", paidAt: new Date(), updatedAt: new Date() },
      });

      if (invoice.appointmentId) {
        await prisma.appointment.updateMany({
          where: { id: invoice.appointmentId },
          data: { updatedAt: new Date() },
        });
      }

      if (invoice.parentId) {
        await NotificationService.sendToUser(
          invoice.parentId,
          NotificationTemplates.Payment.PAYMENT_SUCCESS(
            invoice.totalAmount,
            invoice.currency,
          ),
        );
      }
      return;
    }

    const invoice = await InvoiceModel.findById(invoiceId);
    if (!invoice) return;

    // Idempotency
    if (invoice.status === "PAID") return;

    const shouldRefundPayment =
      invoice.paymentCollectionMethod !== "PAYMENT_LINK" ||
      (invoice.stripeCheckoutSessionId &&
        invoice.stripeCheckoutSessionId !== session.id);

    // Late or invalid payment → refund
    if (shouldRefundPayment) {
      await this._refundCheckoutSession(session);
      return;
    }

    // ✅ Mark invoice PAID
    await InvoiceModel.updateOne(
      { _id: invoiceId, status: { $ne: "PAID" } },
      {
        $set: {
          status: "PAID",
          paidAt: new Date(),
          updatedAt: new Date(),
        },
      },
    );
    if (shouldDualWrite) {
      try {
        await prisma.invoice.updateMany({
          where: { id: invoiceId },
          data: { status: "PAID", paidAt: new Date(), updatedAt: new Date() },
        });
      } catch (err) {
        handleDualWriteError("Invoice checkout paid", err);
      }
    }

    // Optional: update appointment state
    if (invoice.appointmentId) {
      await AppointmentModel.updateOne(
        { _id: invoice.appointmentId },
        { $set: { updatedAt: new Date() } },
      );
      if (shouldDualWrite) {
        try {
          await prisma.appointment.updateMany({
            where: { id: invoice.appointmentId },
            data: { updatedAt: new Date() },
          });
        } catch (err) {
          handleDualWriteError("Appointment update (invoice checkout)", err);
        }
      }
    }

    // Optional: notify parent
    if (invoice.parentId) {
      await NotificationService.sendToUser(
        invoice.parentId,
        NotificationTemplates.Payment.PAYMENT_SUCCESS(
          invoice.totalAmount,
          invoice.currency,
        ),
      );
    }
  },

  async _refundCheckoutSession(session: Stripe.Checkout.Session) {
    const paymentIntentId =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : null;

    if (!paymentIntentId) return;

    await this._refundByPaymentIntentId(paymentIntentId);
  },

  async _refundByPaymentIntentId(paymentIntentId: string) {
    const stripe = getStripeClient();

    try {
      const pi = await stripe.paymentIntents.retrieve(paymentIntentId, {
        expand: ["latest_charge"],
      });

      const charge = pi.latest_charge as Stripe.Charge | null;
      if (!charge?.id) return;

      await stripe.refunds.create({ charge: charge.id });
    } catch (err) {
      logger.error(
        "Failed to auto-refund payment intent",
        paymentIntentId,
        err,
      );
    }
  },
};
