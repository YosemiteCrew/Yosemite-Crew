import type { DeveloperApiKeyEnvironment } from "@prisma/client";
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
  /*
   * Increments call count atomically and checks quota.
   * Returns { allowed: boolean, callCount: number } - caller should 429 when !allowed.
   *
   * `environment` is required rather than optional so a caller cannot meter a
   * key by forgetting to pass it. A `test` key never consumes quota, never
   * triggers a 429 and never produces a Stripe meter event - which is what the
   * billing UI already promises in two places ("Test-environment calls are
   * always free", DeveloperBilling.tsx; "Test-environment calls are not
   * counted", UsageMeter.tsx). The code was silent on test keys rather than
   * deliberate about them: `verified.environment` existed and was attached to
   * the request, but nothing consulted it, and this service could not have
   * discriminated even if a caller wanted it to (#2549).
   */
  async incrementAndCheck(
    ownerUserId: string,
    environment: DeveloperApiKeyEnvironment,
  ): Promise<{ allowed: boolean; callCount: number }> {
    /* Returns the count it did not record. A test key is unmetered, so there is
       no meaningful running total to report, and 0 keeps callers that log or
       surface this from implying a quota was consumed. */
    if (environment === "test") {
      return { allowed: true, callCount: 0 };
    }

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
        // The billing period and the Stripe customer are enough to find the
        // row again; the owner's user id identifies a person and does not
        // belong in a log line.
        logger.error("Failed to report API usage to Stripe", {
          stripeCustomerId: customerId,
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
