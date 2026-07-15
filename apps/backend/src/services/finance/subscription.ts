import { Prisma, BillingInterval, SubscriptionStatus } from "@prisma/client";
import { prisma } from "src/config/prisma";
import Stripe from "stripe";
import { FinanceEventService } from "./events";

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

const toBillingInterval = (
  value?: string | null,
): BillingInterval | undefined => {
  if (value === "month" || value === "year") return value;
  return undefined;
};

type SeatUsageInput = {
  orgId: string;
  seats: number;
};

type UsageEventInput = {
  orgId: string;
  usageKey: string;
  quantity: number;
  billableQuantity?: number;
  source: string;
  referenceType?: string | null;
  referenceId?: string | null;
  metadata?: Record<string, unknown>;
  occurredAt?: Date;
};

type UsageSnapshotInput = {
  orgId: string;
  snapshotType?: string;
  seatsActive?: number;
  seatsBillable?: number;
  appointmentsUsed?: number;
  toolsUsed?: number;
  metadata?: Record<string, unknown>;
  snapshotAt?: Date;
};

type UsageSnapshotQuery = {
  subscriptionId?: string | null;
  featureKey?: string | null;
};

type SubscriptionEntitlementInput = {
  orgId: string;
  code: string;
  name?: string | null;
  value?: Record<string, unknown> | null;
  source: string;
  status?: string | null;
  grantedAt?: Date;
  expiresAt?: Date | null;
  metadata?: Record<string, unknown> | null;
};

type SubscriptionProviderLinkInput = {
  orgId: string;
  provider: string;
  externalCustomerId?: string | null;
  externalSubscriptionId?: string | null;
  externalSubscriptionItemId?: string | null;
  externalPriceId?: string | null;
  externalProductId?: string | null;
  metadata?: Record<string, unknown> | null;
};

type UpsertSubscriptionInput = {
  orgId: string;
  planCode: string;
  provider: string;
  providerSubscriptionId: string;
  quantity: number;
};

type BusinessCheckoutInterval = "month" | "year";

type BusinessCheckoutContext = {
  orgName: string;
  connectAccountId?: string | null;
  externalCustomerId?: string | null;
  priceId: string;
  seats: number;
};

type CheckoutCustomerInput = {
  orgId: string;
  externalCustomerId: string;
};

type BillingCustomerLookup = {
  externalCustomerId: string | null;
};

type SeatSyncPlan = {
  subscriptionItemId: string;
  oldSeats: number;
  newSeats: number;
  prorationBehavior: "create_prorations" | "none";
};

type BusinessCheckoutCompletedInput = {
  customerId: string;
  subscriptionId: string;
  subscriptionItemId: string;
  priceId: string;
  productId?: string | null;
  billingInterval?: BillingInterval | null;
  subscriptionStatus?: SubscriptionStatus | null;
  cancelAtPeriodEnd?: boolean | null;
  currentPeriodStart?: Date | null;
  currentPeriodEnd?: Date | null;
  livemode?: boolean | null;
  seatQuantity?: number | null;
};

type SubscriptionUpdatedInput = {
  subscriptionId: string;
  subscriptionStatus?: SubscriptionStatus | null;
  cancelAtPeriodEnd?: boolean | null;
  canceledAt?: Date | null;
  seatQuantity?: number | null;
  currentPeriodStart?: Date | null;
  currentPeriodEnd?: Date | null;
};

type StripeSubscriptionUpdatedInput = Stripe.Subscription;

type StripeSubscriptionCheckoutCompletedInput = {
  customerId: string;
  session: Stripe.Checkout.Session;
  subscription: Stripe.Subscription;
};

type SubscriptionLifecycleInput = {
  subscriptionId: string;
  invoiceId?: string | null;
};

type SubscriptionOverview = {
  organisationId: string;
  providerLinks: Array<{
    provider: string;
    externalCustomerId: string | null;
    externalSubscriptionId: string | null;
    externalSubscriptionItemId: string | null;
    externalPriceId: string | null;
    externalProductId: string | null;
    metadata: Prisma.JsonValue | null;
    createdAt: Date;
    updatedAt: Date;
  }>;
  entitlements: Array<{
    id: string;
    code: string;
    name: string | null;
    value: Prisma.JsonValue | null;
    source: string;
    status: string;
    grantedAt: Date;
    expiresAt: Date | null;
    metadata: Prisma.JsonValue | null;
    createdAt: Date;
    updatedAt: Date;
  }>;
  usageCounter: {
    id: string;
    orgId: string;
    usersActiveCount: number | null;
    usersBillableCount: number | null;
    appointmentsUsed: number | null;
    toolsUsed: number | null;
    freeUsersLimit: number | null;
    freeAppointmentsLimit: number | null;
    freeToolsLimit: number | null;
    freeLimitReachedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  } | null;
  latestSnapshot: {
    id: string;
    orgId: string;
    snapshotType: string;
    snapshotAt: Date;
    seatsActive: number;
    seatsBillable: number;
    appointmentsUsed: number;
    toolsUsed: number;
    metadata: Prisma.JsonValue | null;
    createdAt: Date;
    updatedAt: Date;
  } | null;
  recentUsageEvents: Array<{
    id: string;
    orgId: string;
    usageKey: string;
    quantity: number;
    billableQuantity: number;
    source: string;
    referenceType: string | null;
    referenceId: string | null;
    metadata: Prisma.JsonValue | null;
    occurredAt: Date;
    createdAt: Date;
    updatedAt: Date;
  }>;
};

type CurrentSubscription = {
  organisationId: string;
  providerLink: SubscriptionOverview["providerLinks"][number] | null;
  entitlement: SubscriptionOverview["entitlements"][number] | null;
  usageCounter: SubscriptionOverview["usageCounter"];
  latestSnapshot: SubscriptionOverview["latestSnapshot"];
};

const toPositiveInteger = (value: number) =>
  Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;

const toIsoString = (value?: Date | null) =>
  value ? value.toISOString() : null;

const readJsonRecord = (value: Prisma.JsonValue | null | undefined) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
};

const readString = (value: unknown) =>
  typeof value === "string" && value.length > 0 ? value : null;

const readNumber = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const normalizePlanCode = (planCode: string) => {
  const cleaned = planCode
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_");
  return cleaned.endsWith("_PLAN") ? cleaned : `${cleaned}_PLAN`;
};

export const FinanceSubscriptionService = {
  async recordUsageEvent(input: UsageEventInput) {
    const event = await prisma.usageEvent.create({
      data: {
        orgId: input.orgId,
        usageKey: input.usageKey,
        quantity: toPositiveInteger(input.quantity),
        billableQuantity: toPositiveInteger(
          input.billableQuantity ?? input.quantity,
        ),
        source: input.source,
        referenceType: input.referenceType ?? undefined,
        referenceId: input.referenceId ?? undefined,
        metadata: input.metadata as unknown as
          | Prisma.InputJsonValue
          | undefined,
        occurredAt: input.occurredAt ?? new Date(),
      },
    });

    await FinanceEventService.recordEvent({
      organisationId: input.orgId,
      eventType: "USAGE_EVENT_RECORDED",
      entityType: "USAGE",
      entityId: event.id,
      payload: {
        usageKey: input.usageKey,
        quantity: event.quantity,
        billableQuantity: event.billableQuantity,
        source: input.source,
        referenceType: input.referenceType ?? null,
        referenceId: input.referenceId ?? null,
      },
      occurredAt: event.occurredAt,
    });

    return event;
  },

  async getSubscriptionOverview(orgId: string): Promise<SubscriptionOverview> {
    const [
      providerLinks,
      entitlements,
      usageCounter,
      latestSnapshot,
      recentUsageEvents,
    ] = await Promise.all([
      prisma.financeProviderLink.findMany({
        where: { orgId },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.subscriptionEntitlement.findMany({
        where: { orgId },
        orderBy: [{ status: "asc" }, { grantedAt: "desc" }],
      }),
      prisma.organizationUsageCounter.findUnique({
        where: { orgId },
      }),
      prisma.usageSnapshot.findFirst({
        where: { orgId },
        orderBy: { snapshotAt: "desc" },
      }),
      prisma.usageEvent.findMany({
        where: { orgId },
        orderBy: { occurredAt: "desc" },
        take: 25,
      }),
    ]);

    return {
      organisationId: orgId,
      providerLinks,
      entitlements,
      usageCounter,
      latestSnapshot,
      recentUsageEvents,
    };
  },

  async getUsageOverview(
    orgId: string,
  ): Promise<
    Pick<
      SubscriptionOverview,
      "organisationId" | "usageCounter" | "latestSnapshot" | "recentUsageEvents"
    >
  > {
    const [usageCounter, latestSnapshot, recentUsageEvents] = await Promise.all(
      [
        prisma.organizationUsageCounter.findUnique({
          where: { orgId },
        }),
        prisma.usageSnapshot.findFirst({
          where: { orgId },
          orderBy: { snapshotAt: "desc" },
        }),
        prisma.usageEvent.findMany({
          where: { orgId },
          orderBy: { occurredAt: "desc" },
          take: 50,
        }),
      ],
    );

    return {
      organisationId: orgId,
      usageCounter,
      latestSnapshot,
      recentUsageEvents,
    };
  },

  async getCurrentSubscription(orgId: string): Promise<CurrentSubscription> {
    const overview = await this.getSubscriptionOverview(orgId);

    return {
      organisationId: overview.organisationId,
      providerLink: overview.providerLinks[0] ?? null,
      entitlement:
        overview.entitlements.find((entry) => entry.status === "ACTIVE") ??
        overview.entitlements[0] ??
        null,
      usageCounter: overview.usageCounter,
      latestSnapshot: overview.latestSnapshot,
    };
  },

  async captureUsageSnapshot(input: UsageSnapshotInput) {
    const snapshot = await prisma.usageSnapshot.create({
      data: {
        orgId: input.orgId,
        snapshotType: input.snapshotType ?? "snapshot",
        seatsActive: toPositiveInteger(input.seatsActive ?? 0),
        seatsBillable: toPositiveInteger(input.seatsBillable ?? 0),
        appointmentsUsed: toPositiveInteger(input.appointmentsUsed ?? 0),
        toolsUsed: toPositiveInteger(input.toolsUsed ?? 0),
        metadata: input.metadata as unknown as
          | Prisma.InputJsonValue
          | undefined,
        snapshotAt: input.snapshotAt ?? new Date(),
      },
    });

    await FinanceEventService.recordEvent({
      organisationId: input.orgId,
      eventType: "USAGE_SNAPSHOT_CAPTURED",
      entityType: "USAGE",
      entityId: snapshot.id,
      payload: {
        snapshotType: snapshot.snapshotType,
        seatsActive: snapshot.seatsActive,
        seatsBillable: snapshot.seatsBillable,
        appointmentsUsed: snapshot.appointmentsUsed,
        toolsUsed: snapshot.toolsUsed,
      },
      occurredAt: snapshot.snapshotAt,
    });

    return snapshot;
  },

  async listUsageSnapshots(orgId: string, query: UsageSnapshotQuery = {}) {
    const snapshots = await prisma.usageSnapshot.findMany({
      where: { orgId },
      orderBy: { snapshotAt: "desc" },
    });

    return snapshots.filter((snapshot) => {
      if (!query.subscriptionId && !query.featureKey) return true;

      const metadata = readJsonRecord(snapshot.metadata);
      const metadataSubscriptionId = readString(metadata.subscriptionId);
      const metadataFeatureKey =
        readString(metadata.featureKey) ??
        readString(metadata.usageKey) ??
        snapshot.snapshotType;

      if (
        query.subscriptionId &&
        metadataSubscriptionId !== query.subscriptionId
      ) {
        return false;
      }

      if (query.featureKey && metadataFeatureKey !== query.featureKey) {
        return false;
      }

      return true;
    });
  },

  async upsertSubscriptionEntitlement(input: SubscriptionEntitlementInput) {
    return prisma.subscriptionEntitlement.upsert({
      where: {
        orgId_code: {
          orgId: input.orgId,
          code: input.code,
        },
      },
      create: {
        orgId: input.orgId,
        code: input.code,
        name: input.name ?? undefined,
        value: input.value as unknown as Prisma.InputJsonValue | undefined,
        source: input.source,
        status: input.status ?? "ACTIVE",
        grantedAt: input.grantedAt ?? new Date(),
        expiresAt: input.expiresAt ?? undefined,
        metadata: input.metadata as unknown as
          | Prisma.InputJsonValue
          | undefined,
      },
      update: {
        name: input.name ?? undefined,
        value: input.value as unknown as Prisma.InputJsonValue | undefined,
        source: input.source,
        status: input.status ?? "ACTIVE",
        grantedAt: input.grantedAt ?? undefined,
        expiresAt: input.expiresAt ?? undefined,
        metadata: input.metadata as unknown as
          | Prisma.InputJsonValue
          | undefined,
      },
    });
  },

  async upsertSubscription(input: UpsertSubscriptionInput) {
    const provider = input.provider.trim().toUpperCase();
    const planCode = input.planCode.trim();
    const entitlementCode = normalizePlanCode(planCode);

    const [providerLink, entitlement] = await Promise.all([
      this.upsertSubscriptionProviderLink({
        orgId: input.orgId,
        provider,
        externalSubscriptionId: input.providerSubscriptionId,
        metadata: {
          planCode,
          quantity: input.quantity,
        },
      }),
      this.upsertSubscriptionEntitlement({
        orgId: input.orgId,
        code: entitlementCode,
        name: `${planCode} subscription`,
        value: {
          planCode,
          provider,
          providerSubscriptionId: input.providerSubscriptionId,
          quantity: input.quantity,
        },
        source: provider,
        status: "ACTIVE",
        grantedAt: new Date(),
        metadata: {
          providerSubscriptionId: input.providerSubscriptionId,
          quantity: input.quantity,
        },
      }),
    ]);

    await FinanceEventService.recordEvent({
      organisationId: input.orgId,
      eventType: "SUBSCRIPTION_UPSERTED",
      entityType: "SUBSCRIPTION",
      entityId: input.providerSubscriptionId,
      payload: {
        planCode,
        provider,
        providerSubscriptionId: input.providerSubscriptionId,
        quantity: input.quantity,
      },
    });

    return {
      organisationId: input.orgId,
      providerLink,
      entitlement,
    };
  },

  async upsertSubscriptionProviderLink(input: SubscriptionProviderLinkInput) {
    return prisma.financeProviderLink.upsert({
      where: {
        orgId_provider: {
          orgId: input.orgId,
          provider: input.provider,
        },
      },
      create: {
        orgId: input.orgId,
        provider: input.provider,
        externalCustomerId: input.externalCustomerId ?? undefined,
        externalSubscriptionId: input.externalSubscriptionId ?? undefined,
        externalSubscriptionItemId:
          input.externalSubscriptionItemId ?? undefined,
        externalPriceId: input.externalPriceId ?? undefined,
        externalProductId: input.externalProductId ?? undefined,
        metadata: input.metadata as unknown as
          | Prisma.InputJsonValue
          | undefined,
      },
      update: {
        externalCustomerId: input.externalCustomerId ?? undefined,
        externalSubscriptionId: input.externalSubscriptionId ?? undefined,
        externalSubscriptionItemId:
          input.externalSubscriptionItemId ?? undefined,
        externalPriceId: input.externalPriceId ?? undefined,
        externalProductId: input.externalProductId ?? undefined,
        metadata: input.metadata as unknown as
          | Prisma.InputJsonValue
          | undefined,
      },
    });
  },

  async prepareBusinessCheckoutSession(
    orgId: string,
    interval: BusinessCheckoutInterval,
  ): Promise<BusinessCheckoutContext> {
    const [org, providerLink] = await Promise.all([
      prisma.organization.findUnique({
        where: { id: orgId },
        select: { name: true, stripeAccountId: true },
      }),
      prisma.financeProviderLink.findUnique({
        where: {
          orgId_provider: {
            orgId,
            provider: "STRIPE",
          },
        },
        select: {
          externalCustomerId: true,
        },
      }),
    ]);
    if (!org) throw new Error("Organisation not found");

    const priceId =
      interval === "month"
        ? process.env.STRIPE_PRICE_BUSINESS_MONTH
        : process.env.STRIPE_PRICE_BUSINESS_YEAR;
    if (!priceId) throw new Error("Missing STRIPE_PRICE_BUSINESS_* env vars");

    const seats = await prisma.userOrganization.count({
      where: {
        organizationReference: orgId,
        active: true,
      },
    });
    if (seats < 1) {
      throw new Error("No users found. Add at least 1 user to start Business.");
    }

    await this.recordSeatUsage({ orgId, seats });

    return {
      orgName: org.name,
      connectAccountId: org.stripeAccountId,
      externalCustomerId: providerLink?.externalCustomerId ?? null,
      priceId,
      seats,
    };
  },

  async recordBusinessCheckoutCustomer(
    input: CheckoutCustomerInput,
  ): Promise<void> {
    await this.upsertSubscriptionProviderLink({
      orgId: input.orgId,
      provider: "STRIPE",
      externalCustomerId: input.externalCustomerId,
      metadata: {
        source: "business_checkout",
      },
    });
  },

  async resolveBillingCustomerId(
    orgId: string,
  ): Promise<BillingCustomerLookup> {
    const providerLink = await prisma.financeProviderLink.findUnique({
      where: {
        orgId_provider: {
          orgId,
          provider: "STRIPE",
        },
      },
      select: {
        externalCustomerId: true,
      },
    });

    if (providerLink?.externalCustomerId) {
      return {
        externalCustomerId: providerLink.externalCustomerId,
      };
    }

    return {
      externalCustomerId: null,
    };
  },

  async resolveSubscriptionSeatSyncPlan(
    orgId: string,
  ): Promise<SeatSyncPlan | null> {
    const providerRow = await prisma.financeProviderLink.findUnique({
      where: {
        orgId_provider: {
          orgId,
          provider: "STRIPE",
        },
      },
      select: {
        externalSubscriptionItemId: true,
        metadata: true,
      },
    });

    const providerState = readJsonRecord(providerRow?.metadata);
    const providerSubscriptionStatus = readString(
      providerState.subscriptionStatus,
    );
    const providerSeatQuantity = readNumber(providerState.seatQuantity);

    if (providerRow?.externalSubscriptionItemId) {
      if (
        !["active", "trialing", "past_due"].includes(
          providerSubscriptionStatus ?? "",
        )
      ) {
        return null;
      }

      const newSeats = await prisma.userOrganization.count({
        where: {
          organizationReference: orgId,
          active: true,
        },
      });
      const oldSeats = providerSeatQuantity ?? 0;
      if (newSeats === oldSeats) return null;

      return {
        subscriptionItemId: providerRow.externalSubscriptionItemId,
        oldSeats,
        newSeats,
        prorationBehavior: newSeats > oldSeats ? "create_prorations" : "none",
      };
    }

    return null;
  },

  async recordSeatUsage({ orgId, seats }: SeatUsageInput) {
    await this.recordUsageEvent({
      orgId,
      usageKey: "SEATS_ACTIVE",
      quantity: seats,
      billableQuantity: seats,
      source: "SUBSCRIPTION",
      referenceType: "organization_billing",
      referenceId: orgId,
      metadata: {
        scope: "business_checkout",
      },
    });

    await prisma.organizationUsageCounter.upsert({
      where: { orgId },
      create: {
        orgId,
        usersActiveCount: seats,
        usersBillableCount: seats,
      },
      update: { usersActiveCount: seats, usersBillableCount: seats },
    });

    await this.captureUsageSnapshot({
      orgId,
      snapshotType: "SEAT_SYNC",
      seatsActive: seats,
      seatsBillable: seats,
      metadata: {
        usageKey: "SEATS_ACTIVE",
      },
    });
  },

  async recordBusinessCheckoutCompleted(input: BusinessCheckoutCompletedInput) {
    const rows =
      (await prisma.financeProviderLink.findMany({
        where: {
          provider: "STRIPE",
          externalCustomerId: input.customerId,
        },
        select: { orgId: true },
      })) ?? [];

    await Promise.all(
      rows.map((row) =>
        Promise.all([
          this.upsertSubscriptionProviderLink({
            orgId: row.orgId ?? input.customerId,
            provider: "STRIPE",
            externalCustomerId: input.customerId,
            externalSubscriptionId: input.subscriptionId,
            externalSubscriptionItemId: input.subscriptionItemId,
            externalPriceId: input.priceId,
            externalProductId: input.productId ?? null,
            metadata: {
              subscriptionStatus: input.subscriptionStatus ?? "none",
              cancelAtPeriodEnd: input.cancelAtPeriodEnd ?? false,
            },
          }),
          this.upsertSubscriptionEntitlement({
            orgId: row.orgId ?? input.customerId,
            code: "BUSINESS_PLAN",
            name: "Business subscription",
            value: {
              plan: "business",
              billingInterval: input.billingInterval ?? null,
              seatQuantity: input.seatQuantity ?? 0,
              priceId: input.priceId,
              productId: input.productId ?? null,
            },
            source: "STRIPE",
            status: "ACTIVE",
            grantedAt: new Date(),
            metadata: {
              subscriptionStatus: input.subscriptionStatus ?? "none",
              cancelAtPeriodEnd: input.cancelAtPeriodEnd ?? false,
              currentPeriodStart: toIsoString(input.currentPeriodStart),
              currentPeriodEnd: toIsoString(input.currentPeriodEnd),
              seatQuantity: input.seatQuantity ?? 0,
            },
          }),
        ]),
      ),
    );

    await FinanceEventService.recordEvent({
      organisationId: rows[0]?.orgId ?? input.customerId,
      eventType: "SUBSCRIPTION_STARTED",
      entityType: "SUBSCRIPTION",
      entityId: input.subscriptionId,
      payload: {
        customerId: input.customerId,
        subscriptionItemId: input.subscriptionItemId,
        billingInterval: input.billingInterval ?? null,
        subscriptionStatus: input.subscriptionStatus ?? "none",
        seatQuantity: input.seatQuantity ?? 0,
        cancelAtPeriodEnd: input.cancelAtPeriodEnd ?? false,
      },
    });
  },

  async recordSubscriptionUpdated(input: SubscriptionUpdatedInput) {
    const rows =
      (await prisma.financeProviderLink.findMany({
        where: {
          provider: "STRIPE",
          externalSubscriptionId: input.subscriptionId,
        },
        select: { orgId: true, metadata: true },
      })) ?? [];

    await Promise.all(
      rows.map((row) =>
        Promise.all([
          this.upsertSubscriptionProviderLink({
            orgId: row.orgId,
            provider: "STRIPE",
            externalSubscriptionId: input.subscriptionId,
            metadata: {
              subscriptionStatus: input.subscriptionStatus ?? "none",
              cancelAtPeriodEnd: input.cancelAtPeriodEnd ?? false,
              seatQuantity: input.seatQuantity ?? 0,
              currentPeriodStart: toIsoString(input.currentPeriodStart),
              currentPeriodEnd: toIsoString(input.currentPeriodEnd),
            },
          }),
          prisma.subscriptionEntitlement.upsert({
            where: {
              orgId_code: {
                orgId: row.orgId,
                code: "BUSINESS_PLAN",
              },
            },
            create: {
              orgId: row.orgId,
              code: "BUSINESS_PLAN",
              name: "Business subscription",
              source: "STRIPE",
              status:
                input.subscriptionStatus === "canceled" ? "INACTIVE" : "ACTIVE",
              grantedAt: new Date(),
              metadata: {
                subscriptionStatus: input.subscriptionStatus ?? "none",
                cancelAtPeriodEnd: input.cancelAtPeriodEnd ?? false,
              },
            },
            update: {
              source: "STRIPE",
              status:
                input.subscriptionStatus === "canceled" ? "INACTIVE" : "ACTIVE",
              metadata: {
                subscriptionStatus: input.subscriptionStatus ?? "none",
                cancelAtPeriodEnd: input.cancelAtPeriodEnd ?? false,
              },
            },
          }),
        ]),
      ),
    );

    await FinanceEventService.recordEvent({
      organisationId: rows[0]?.orgId ?? input.subscriptionId,
      eventType: "SUBSCRIPTION_UPDATED",
      entityType: "SUBSCRIPTION",
      entityId: input.subscriptionId,
      payload: {
        subscriptionStatus: input.subscriptionStatus ?? "none",
        cancelAtPeriodEnd: input.cancelAtPeriodEnd ?? false,
        canceledAt: input.canceledAt ?? null,
        seatQuantity: input.seatQuantity ?? 0,
        currentPeriodStart: input.currentPeriodStart?.toISOString() ?? null,
        currentPeriodEnd: input.currentPeriodEnd?.toISOString() ?? null,
      },
    });
  },

  async recordStripeSubscriptionUpdated(
    subscription: StripeSubscriptionUpdatedInput,
  ) {
    const item = subscription.items.data[0];

    await this.recordSubscriptionUpdated({
      subscriptionId: subscription.id,
      subscriptionStatus: toSubscriptionStatus(subscription.status) ?? "none",
      cancelAtPeriodEnd: subscription.cancel_at_period_end ?? false,
      canceledAt: subscription.canceled_at
        ? new Date(subscription.canceled_at * 1000)
        : null,
      seatQuantity: item?.quantity ?? 0,
      currentPeriodStart:
        item?.current_period_start == null
          ? null
          : new Date(item.current_period_start * 1000),
      currentPeriodEnd:
        item?.current_period_end == null
          ? null
          : new Date(item.current_period_end * 1000),
    });
  },

  async recordStripeSubscriptionCheckoutCompleted(
    input: StripeSubscriptionCheckoutCompletedInput,
  ) {
    const item = input.subscription.items.data[0];
    const price = item?.price;
    if (!item || !price) return;

    const productId =
      typeof price.product === "string" ? price.product : price.product?.id;

    await this.recordBusinessCheckoutCompleted({
      customerId: input.customerId,
      subscriptionId: input.subscription.id,
      subscriptionItemId: item.id,
      priceId: price.id,
      productId: productId ?? null,
      billingInterval: toBillingInterval(price.recurring?.interval) ?? null,
      subscriptionStatus:
        toSubscriptionStatus(input.subscription.status) ?? "none",
      cancelAtPeriodEnd: input.subscription.cancel_at_period_end ?? false,
      seatQuantity: item.quantity ?? 0,
      currentPeriodStart:
        item.current_period_start == null
          ? null
          : new Date(item.current_period_start * 1000),
      currentPeriodEnd:
        item.current_period_end == null
          ? null
          : new Date(item.current_period_end * 1000),
      livemode: input.session.livemode ?? false,
    });
  },

  async recordSubscriptionDeleted(subscriptionId: string) {
    const rows = await prisma.financeProviderLink.findMany({
      where: {
        provider: "STRIPE",
        externalSubscriptionId: subscriptionId,
      },
      select: { orgId: true },
    });

    await Promise.all(
      rows.map((row) =>
        Promise.all([
          this.upsertSubscriptionProviderLink({
            orgId: row.orgId,
            provider: "STRIPE",
            externalSubscriptionId: subscriptionId,
            metadata: {
              status: "canceled",
              canceledAt: new Date().toISOString(),
            },
          }),
          prisma.subscriptionEntitlement.upsert({
            where: {
              orgId_code: {
                orgId: row.orgId,
                code: "BUSINESS_PLAN",
              },
            },
            create: {
              orgId: row.orgId,
              code: "BUSINESS_PLAN",
              name: "Business subscription",
              source: "STRIPE",
              status: "INACTIVE",
              grantedAt: new Date(),
              expiresAt: new Date(),
              metadata: {
                status: "canceled",
              },
            },
            update: {
              source: "STRIPE",
              status: "INACTIVE",
              expiresAt: new Date(),
              metadata: {
                status: "canceled",
              },
            },
          }),
          this.captureUsageSnapshot({
            orgId: row.orgId,
            snapshotType: "SUBSCRIPTION_TERMINATED",
            metadata: {
              subscriptionId,
            },
          }),
        ]),
      ),
    );

    await FinanceEventService.recordEvent({
      organisationId: rows[0]?.orgId ?? subscriptionId,
      eventType: "SUBSCRIPTION_DELETED",
      entityType: "SUBSCRIPTION",
      entityId: subscriptionId,
      payload: {
        status: "canceled",
      },
    });
  },

  async recordSubscriptionInvoicePaid(input: SubscriptionLifecycleInput) {
    const rows: Array<{ orgId: string }> =
      (await prisma.financeProviderLink.findMany({
        where: {
          provider: "STRIPE",
          externalSubscriptionId: input.subscriptionId,
        },
        select: { orgId: true },
      })) ?? [];

    await Promise.all(
      rows.map((row) =>
        this.upsertSubscriptionProviderLink({
          orgId: row.orgId,
          provider: "STRIPE",
          externalSubscriptionId: input.subscriptionId,
          metadata: {
            lastInvoiceId: input.invoiceId ?? null,
            lastPaymentStatus: "paid",
            lastPaymentAt: new Date().toISOString(),
          },
        }),
      ),
    );

    await FinanceEventService.recordEvent({
      organisationId: rows[0]?.orgId ?? input.subscriptionId,
      eventType: "SUBSCRIPTION_INVOICE_PAID",
      entityType: "SUBSCRIPTION",
      entityId: input.subscriptionId,
      payload: {
        invoiceId: input.invoiceId ?? null,
        paymentStatus: "paid",
      },
    });

    await FinanceEventService.recordEvent({
      organisationId: rows[0]?.orgId ?? input.subscriptionId,
      eventType: "SUBSCRIPTION_RENEWED",
      entityType: "SUBSCRIPTION",
      entityId: input.subscriptionId,
      payload: {
        invoiceId: input.invoiceId ?? null,
        paymentStatus: "paid",
      },
    });
  },

  async recordSubscriptionInvoiceFailed(input: SubscriptionLifecycleInput) {
    const rows: Array<{ orgId: string }> =
      (await prisma.financeProviderLink.findMany({
        where: {
          provider: "STRIPE",
          externalSubscriptionId: input.subscriptionId,
        },
        select: { orgId: true },
      })) ?? [];

    await Promise.all(
      rows.map((row) =>
        this.upsertSubscriptionProviderLink({
          orgId: row.orgId,
          provider: "STRIPE",
          externalSubscriptionId: input.subscriptionId,
          metadata: {
            lastInvoiceId: input.invoiceId ?? null,
            lastPaymentStatus: "failed",
            lastPaymentAt: new Date().toISOString(),
          },
        }),
      ),
    );

    await FinanceEventService.recordEvent({
      organisationId: rows[0]?.orgId ?? input.subscriptionId,
      eventType: "SUBSCRIPTION_INVOICE_FAILED",
      entityType: "SUBSCRIPTION",
      entityId: input.subscriptionId,
      payload: {
        invoiceId: input.invoiceId ?? null,
        paymentStatus: "failed",
      },
    });
  },
};
