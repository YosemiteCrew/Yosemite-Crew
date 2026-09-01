import { prisma } from "src/config/prisma";
import { DeveloperBillingService } from "./developer-billing.service";
import logger from "../utils/logger";

const FREE_TIER_LIMIT = 1_000;

// One authenticated request is one metered call. Reported as a delta because the
// Stripe meter sums the events it receives - see DeveloperBillingService.reportUsage.
const CALLS_PER_REQUEST = 1;

const currentBillingPeriod = (): string => {
  const now = new Date();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${now.getUTCFullYear()}-${mm}`;
};

export const DeveloperUsageService = {
  // Increments call count atomically and checks quota.
  // Returns { allowed: boolean, callCount: number } — caller should 429 when !allowed.
  async incrementAndCheck(
    ownerUserId: string,
  ): Promise<{ allowed: boolean; callCount: number }> {
    const period = currentBillingPeriod();

    const record = await prisma.developerApiUsage.upsert({
      where: {
        ownerUserId_billingPeriod: { ownerUserId, billingPeriod: period },
      },
      create: { ownerUserId, billingPeriod: period, callCount: 1 },
      update: { callCount: { increment: 1 } },
    });

    const sub = await prisma.developerSubscription.findUnique({
      where: { ownerUserId },
      select: { plan: true, stripeCustomerId: true },
    });

    const plan = sub?.plan ?? "free";

    if (plan === "free" && record.callCount > FREE_TIER_LIMIT) {
      return { allowed: false, callCount: record.callCount };
    }

    if (plan === "pro" && sub?.stripeCustomerId) {
      DeveloperUsageService.reportToStripe(
        sub.stripeCustomerId,
        ownerUserId,
        period,
        record.callCount,
      );
    }

    return { allowed: true, callCount: record.callCount };
  },

  // Fire-and-forget: report this one call to Stripe and update lastReportedAt.
  // Called inline from incrementAndCheck; errors are logged but never surfaced to the caller.
  //
  // `callSequence` is the request's position in the period, taken from the atomic
  // increment in incrementAndCheck. It is NOT the reported quantity - it only
  // makes the meter event's identifier unique per call, and stable if the same
  // call is ever reported twice.
  reportToStripe(
    customerId: string,
    ownerUserId: string,
    billingPeriod: string,
    callSequence: number,
  ): void {
    void (async () => {
      try {
        await DeveloperBillingService.reportUsage(
          customerId,
          CALLS_PER_REQUEST,
          `dev-api-${ownerUserId}-${billingPeriod}-${callSequence}`,
        );
        await prisma.developerApiUsage.update({
          where: {
            ownerUserId_billingPeriod: {
              ownerUserId,
              billingPeriod,
            },
          },
          data: { lastReportedAt: new Date() },
        });
      } catch (err) {
        logger.error("Failed to report API usage to Stripe", {
          ownerUserId,
          billingPeriod,
          err,
        });
      }
    })();
  },

  // Returns usage for a given org and period (defaults to current month).
  async getUsage(
    ownerUserId: string,
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
          ownerUserId_billingPeriod: {
            ownerUserId,
            billingPeriod: period,
          },
        },
        select: { callCount: true },
      }),
      prisma.developerSubscription.findUnique({
        where: { ownerUserId },
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
