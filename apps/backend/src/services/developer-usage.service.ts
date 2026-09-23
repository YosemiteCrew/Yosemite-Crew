import type { DeveloperApiKeyEnvironment } from "@prisma/client";
import { prisma } from "src/config/prisma";
import {
  DeveloperBillingService,
  DeveloperBillingServiceError,
} from "./developer-billing.service";

const FREE_TIER_LIMIT = 1_000;
const DELIVERY_BATCH_SIZE = 100;
const DELIVERY_DRAIN_BUDGET_MS = 45_000;
const MAX_BACKOFF_MINUTES = 60;
const MINUTE_MS = 60_000;
const PENDING = { deliveredAt: null } as const;

type MeterEventRow = {
  id: string;
  ownerUserId: string;
  billingPeriod: string;
  stripeCustomerId: string | null;
  attempts: number;
};

type MeteringStatus =
  | "current"
  | "pending"
  | "configuration_error"
  | "delivery_error"
  | "reconciliation_error";

const currentBillingPeriod = (): string => {
  const now = new Date();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${now.getUTCFullYear()}-${mm}`;
};

const retryAt = (attempts: number, now: Date) =>
  new Date(
    now.getTime() + Math.min(2 ** attempts, MAX_BACKOFF_MINUTES) * MINUTE_MS,
  );

const failureCode = (error: unknown): string =>
  error instanceof DeveloperBillingServiceError && error.code
    ? error.code
    : "provider_delivery_failed";

const scheduleRetry = async (
  event: Pick<MeterEventRow, "id" | "attempts">,
  code: string,
  now: Date,
): Promise<void> => {
  const attempts = event.attempts + 1;
  await prisma.developerMeterEvent.update({
    where: { id: event.id },
    data: {
      attempts,
      nextAttemptAt: retryAt(attempts, now),
      lastAttemptAt: now,
      failureCode: code,
    },
  });
};

export const DeveloperUsageService = {
  async incrementAndCheck(
    ownerUserId: string,
    environment: DeveloperApiKeyEnvironment,
  ): Promise<{ allowed: boolean; callCount: number }> {
    if (environment === "test") {
      return { allowed: true, callCount: 0 };
    }

    const billingPeriod = currentBillingPeriod();
    const { record, plan } = await prisma.$transaction(async (tx) => {
      const subscription = await tx.developerSubscription.findUnique({
        where: { ownerUserId },
        select: { plan: true, stripeCustomerId: true },
      });
      const isPro = subscription?.plan === "pro";
      const usage = await tx.developerApiUsage.upsert({
        where: { ownerUserId_billingPeriod: { ownerUserId, billingPeriod } },
        create: {
          ownerUserId,
          billingPeriod,
          callCount: 1,
          meteredCallCount: isPro ? 1 : 0,
        },
        update: {
          callCount: { increment: 1 },
          ...(isPro ? { meteredCallCount: { increment: 1 } } : {}),
        },
      });

      if (isPro) {
        await tx.developerMeterEvent.create({
          data: {
            ownerUserId,
            billingPeriod,
            callSequence: usage.callCount,
            stripeCustomerId: subscription.stripeCustomerId,
          },
        });
      }

      return { record: usage, plan: subscription?.plan ?? "free" };
    });

    return {
      allowed: plan !== "free" || record.callCount <= FREE_TIER_LIMIT,
      callCount: record.callCount,
    };
  },

  async drainMeterEvents(now: Date = new Date()): Promise<{
    delivered: number;
    retrying: number;
    pending: number;
    oldestPendingSeconds: number | null;
  }> {
    const deadline = Date.now() + DELIVERY_DRAIN_BUDGET_MS;
    let delivered = 0;
    let retrying = 0;
    let events: MeterEventRow[];

    do {
      events = await prisma.developerMeterEvent.findMany({
        where: { ...PENDING, nextAttemptAt: { lte: now } },
        orderBy: [{ nextAttemptAt: "asc" }, { id: "asc" }],
        take: DELIVERY_BATCH_SIZE,
      });
      const ownerUserIds = [
        ...new Set(
          events
            .filter((event) => !event.stripeCustomerId)
            .map((event) => event.ownerUserId),
        ),
      ];
      const subscriptions = ownerUserIds.length
        ? await prisma.developerSubscription.findMany({
            where: { ownerUserId: { in: ownerUserIds } },
            select: { ownerUserId: true, stripeCustomerId: true },
          })
        : [];
      const customerIdsByOwner = new Map(
        subscriptions.map((subscription) => [
          subscription.ownerUserId,
          subscription.stripeCustomerId,
        ]),
      );

      for (const event of events) {
        const customerId =
          event.stripeCustomerId ??
          customerIdsByOwner.get(event.ownerUserId) ??
          null;

        if (!customerId) {
          await scheduleRetry(event, "missing_stripe_customer", now);
          retrying += 1;
          continue;
        }

        try {
          await DeveloperBillingService.reportUsage(customerId, 1, event.id);
          await prisma.$transaction([
            prisma.developerMeterEvent.update({
              where: { id: event.id },
              data: {
                stripeCustomerId: customerId,
                deliveredAt: now,
                lastAttemptAt: now,
                failureCode: null,
              },
            }),
            prisma.developerApiUsage.update({
              where: {
                ownerUserId_billingPeriod: {
                  ownerUserId: event.ownerUserId,
                  billingPeriod: event.billingPeriod,
                },
              },
              data: { lastReportedAt: now },
            }),
          ]);
          delivered += 1;
        } catch (error) {
          await scheduleRetry(event, failureCode(error), now);
          retrying += 1;
        }
      }
    } while (events.length === DELIVERY_BATCH_SIZE && Date.now() < deadline);

    const pending = await prisma.developerMeterEvent.count({ where: PENDING });
    const oldest = pending
      ? await prisma.developerMeterEvent.findFirst({
          where: PENDING,
          orderBy: { createdAt: "asc" },
          select: { createdAt: true },
        })
      : null;

    return {
      delivered,
      retrying,
      pending,
      oldestPendingSeconds: oldest
        ? Math.max(
            0,
            Math.floor((now.getTime() - oldest.createdAt.getTime()) / 1000),
          )
        : null,
    };
  },

  async getUsage(
    ownerUserId: string,
    billingPeriod?: string,
  ): Promise<{
    billingPeriod: string;
    callCount: number;
    limit: number | null;
    metering: {
      recorded: number;
      reported: number;
      pending: number;
      status: MeteringStatus;
      failureCode: string | null;
      oldestPendingAt: Date | null;
    } | null;
  }> {
    const period = billingPeriod ?? currentBillingPeriod();
    const [record, subscription] = await Promise.all([
      prisma.developerApiUsage.findUnique({
        where: {
          ownerUserId_billingPeriod: { ownerUserId, billingPeriod: period },
        },
        select: { callCount: true, meteredCallCount: true },
      }),
      prisma.developerSubscription.findUnique({
        where: { ownerUserId },
        select: { plan: true },
      }),
    ]);
    const plan = subscription?.plan ?? "free";

    if (plan !== "pro") {
      return {
        billingPeriod: period,
        callCount: record?.callCount ?? 0,
        limit: plan === "free" ? FREE_TIER_LIMIT : null,
        metering: null,
      };
    }

    const [reported, pending, oldest, latestFailure] = await Promise.all([
      prisma.developerMeterEvent.count({
        where: {
          ownerUserId,
          billingPeriod: period,
          deliveredAt: { not: null },
        },
      }),
      prisma.developerMeterEvent.count({
        where: { ownerUserId, billingPeriod: period, deliveredAt: null },
      }),
      prisma.developerMeterEvent.findFirst({
        where: { ownerUserId, billingPeriod: period, deliveredAt: null },
        orderBy: { createdAt: "asc" },
        select: { createdAt: true },
      }),
      prisma.developerMeterEvent.findFirst({
        where: {
          ownerUserId,
          billingPeriod: period,
          deliveredAt: null,
          failureCode: { not: null },
        },
        orderBy: { lastAttemptAt: "desc" },
        select: { failureCode: true },
      }),
    ]);
    const code = latestFailure?.failureCode;
    const reconciled = reported + pending === (record?.meteredCallCount ?? 0);
    let status: MeteringStatus = "current";
    if (pending) status = "pending";
    if (!reconciled) status = "reconciliation_error";
    if (code) status = "delivery_error";
    if (code?.startsWith("missing_")) status = "configuration_error";

    return {
      billingPeriod: period,
      callCount: record?.callCount ?? 0,
      limit: null,
      metering: {
        recorded: record?.meteredCallCount ?? 0,
        reported,
        pending,
        status,
        failureCode: code ?? (reconciled ? null : "usage_count_mismatch"),
        oldestPendingAt: oldest?.createdAt ?? null,
      },
    };
  },
};
