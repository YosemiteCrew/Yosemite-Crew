import { prisma } from "src/config/prisma";
import { DeveloperBillingService } from "./developer-billing.service";
import logger from "../utils/logger";

const FREE_TIER_LIMIT = 1_000;

const currentBillingPeriod = (): string => {
  const now = new Date();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${now.getUTCFullYear()}-${mm}`;
};

export const DeveloperUsageService = {
  // Increments call count atomically and checks quota.
  // Returns { allowed: boolean, callCount: number } — caller should 429 when !allowed.
  async incrementAndCheck(
    organisationId: string,
  ): Promise<{ allowed: boolean; callCount: number }> {
    const period = currentBillingPeriod();

    const record = await prisma.developerApiUsage.upsert({
      where: {
        organisationId_billingPeriod: { organisationId, billingPeriod: period },
      },
      create: { organisationId, billingPeriod: period, callCount: 1 },
      update: { callCount: { increment: 1 } },
    });

    const sub = await prisma.developerSubscription.findUnique({
      where: { organisationId },
      select: { plan: true, stripeCustomerId: true },
    });

    const plan = sub?.plan ?? "free";

    if (plan === "free" && record.callCount > FREE_TIER_LIMIT) {
      return { allowed: false, callCount: record.callCount };
    }

    if (plan === "pro" && sub?.stripeCustomerId) {
      DeveloperUsageService.reportToStripe(
        sub.stripeCustomerId,
        organisationId,
        period,
        record.callCount,
      );
    }

    return { allowed: true, callCount: record.callCount };
  },

  // Fire-and-forget: report accumulated usage to Stripe and update lastReportedAt.
  // Called inline from incrementAndCheck; errors are logged but never surfaced to the caller.
  reportToStripe(
    customerId: string,
    organisationId: string,
    billingPeriod: string,
    callCount: number,
  ): void {
    void (async () => {
      try {
        await DeveloperBillingService.reportUsage(customerId, callCount);
        await prisma.developerApiUsage.update({
          where: {
            organisationId_billingPeriod: {
              organisationId,
              billingPeriod,
            },
          },
          data: { lastReportedAt: new Date() },
        });
      } catch (err) {
        logger.error("Failed to report API usage to Stripe", {
          organisationId,
          billingPeriod,
          err,
        });
      }
    })();
  },

  // Returns usage for a given org and period (defaults to current month).
  async getUsage(
    organisationId: string,
    billingPeriod?: string,
  ): Promise<{
    billingPeriod: string;
    callCount: number;
    limit: number | null;
  }> {
    const period = billingPeriod ?? currentBillingPeriod();

    const [record, sub] = await Promise.all([
      prisma.developerApiUsage.findUnique({
        where: {
          organisationId_billingPeriod: {
            organisationId,
            billingPeriod: period,
          },
        },
        select: { callCount: true },
      }),
      prisma.developerSubscription.findUnique({
        where: { organisationId },
        select: { plan: true },
      }),
    ]);

    const plan = sub?.plan ?? "free";
    return {
      billingPeriod: period,
      callCount: record?.callCount ?? 0,
      limit: plan === "free" ? FREE_TIER_LIMIT : null,
    };
  },
};
