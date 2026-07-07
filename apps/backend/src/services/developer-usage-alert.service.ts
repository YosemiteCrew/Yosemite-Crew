import { prisma } from "src/config/prisma";
import { emitDeveloperEvent } from "src/utils/developer-events";
import { sendEmail } from "src/utils/email";
import logger from "src/utils/logger";

// Free-tier usage alert emails (80% / 100% of the monthly cap), plus the
// org-owner contact resolution shared with the developer-maintenance job.
//
// Dispatch is fire-and-forget from DeveloperUsageService.incrementAndCheck via
// the same void-IIFE pattern the hot path already uses for Stripe metering
// (reportToStripe): it adds no latency and no failure mode to the data plane.
// BullMQ was considered, but every house queue is a repeatable scheduler
// (poll-style), not a per-event dispatch queue, and a Redis enqueue would put
// a network hop back on the hot path - so the in-process pattern wins.
//
// Send-once-per-threshold-per-month is guaranteed by the unique constraint on
// DeveloperUsageAlert (organisationId, billingPeriod, threshold): the row is
// claimed BEFORE the email goes out, so concurrent crossings cannot
// double-send. If the email itself then fails, the failure is logged and the
// alert is not retried (accepted tradeoff: at-most-once beats spamming owners
// on a persistent mailer outage).

export const USAGE_ALERT_THRESHOLDS = [80, 100] as const;

const SUPPORT_EMAIL_ADDRESS =
  process.env.SUPPORT_EMAIL ??
  process.env.SUPPORT_EMAIL_ADDRESS ??
  "support@yosemitecrew.com";

const BILLING_SETTINGS_URL = process.env.APP_URL
  ? `${process.env.APP_URL}/settings/billing`
  : "https://app.yosemitecrew.com/settings/billing";

export type OrgOwnerContact = {
  email: string;
  name?: string;
  organisationName: string;
};

const extractReferenceId = (value: string) => value.split("/").pop()?.trim();

// Resolves the OWNER user's contact for an organisation (Postgres only - the
// developer platform never touches the legacy Mongo path). Returns null when
// the org, the owner mapping, or the owner's email cannot be found.
export const resolveOrgOwnerContact = async (
  organisationId: string,
): Promise<OrgOwnerContact | null> => {
  const organisation = await prisma.organization.findFirst({
    where: { OR: [{ id: organisationId }, { fhirId: organisationId }] },
    select: { id: true, name: true, fhirId: true },
  });
  if (!organisation) {
    return null;
  }

  const referenceCandidates = [
    organisation.id,
    `Organization/${organisation.id}`,
    organisation.fhirId,
    organisation.fhirId ? `Organization/${organisation.fhirId}` : undefined,
  ].filter(Boolean) as string[];

  const ownerMapping = await prisma.userOrganization.findFirst({
    where: {
      roleCode: "OWNER",
      active: true,
      organizationReference: { in: referenceCandidates },
    },
    select: { practitionerReference: true },
  });
  if (!ownerMapping?.practitionerReference) {
    return null;
  }

  const ownerUserId =
    extractReferenceId(ownerMapping.practitionerReference) ??
    ownerMapping.practitionerReference;
  const ownerUser = await prisma.user.findFirst({
    where: { userId: ownerUserId },
    select: { email: true, firstName: true, lastName: true },
  });
  if (!ownerUser?.email) {
    return null;
  }

  const nameParts = [ownerUser.firstName, ownerUser.lastName].filter(Boolean);
  return {
    email: ownerUser.email,
    name: nameParts.length ? nameParts.join(" ") : undefined,
    organisationName: organisation.name,
  };
};

const isUniqueViolation = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  (error as { code?: unknown }).code === "P2002";

const buildAlertEmail = (
  owner: OrgOwnerContact,
  threshold: number,
  callCount: number,
  limit: number,
) => {
  const ownerName = owner.name ?? "there";
  const reached = threshold >= 100;
  const subject = reached
    ? "You've used 100% of your monthly API quota"
    : `You've used ${threshold}% of your monthly API quota`;
  const statusLine = reached
    ? "has used its entire free-tier API quota for this month. Further API calls will be rejected until the quota resets or you upgrade."
    : `has used ${threshold}% of its free-tier API quota for this month.`;
  return {
    subject,
    textBody: [
      `Hi ${ownerName},`,
      "",
      `Your organisation ${owner.organisationName} ${statusLine}`,
      "",
      `Usage: ${callCount} of ${limit} calls.`,
      `Upgrade or review usage: ${BILLING_SETTINGS_URL}`,
      "",
      `Support: ${SUPPORT_EMAIL_ADDRESS}`,
    ].join("\n"),
    htmlBody: `
      <p>Hi ${ownerName},</p>
      <p>Your organisation <strong>${owner.organisationName}</strong> ${statusLine}</p>
      <p>Usage: <strong>${callCount}</strong> of <strong>${limit}</strong> calls.</p>
      <p><a href="${BILLING_SETTINGS_URL}">Upgrade or review usage</a></p>
      <p>Support: <a href="mailto:${SUPPORT_EMAIL_ADDRESS}">${SUPPORT_EMAIL_ADDRESS}</a></p>
    `,
  };
};

export const DeveloperUsageAlertService = {
  // Claims the (org, period, threshold) dedupe row, then emails the org owner.
  // Duplicate claims (already alerted this month) return silently.
  async sendThresholdAlert(input: {
    organisationId: string;
    billingPeriod: string;
    threshold: number;
    callCount: number;
    limit: number;
  }): Promise<void> {
    try {
      await prisma.developerUsageAlert.create({
        data: {
          organisationId: input.organisationId,
          billingPeriod: input.billingPeriod,
          threshold: input.threshold,
        },
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        return;
      }
      throw error;
    }
    // The dedupe row is the source of truth for "threshold crossed this
    // month" - emit once it commits, independent of email delivery.
    emitDeveloperEvent("usage.threshold_crossed", input.organisationId, {
      billingPeriod: input.billingPeriod,
      threshold: input.threshold,
      callCount: input.callCount,
      limit: input.limit,
    });

    const owner = await resolveOrgOwnerContact(input.organisationId);
    if (!owner) {
      logger.error("Usage alert: no owner contact for organisation", {
        organisationId: input.organisationId,
        threshold: input.threshold,
      });
      return;
    }

    const email = buildAlertEmail(
      owner,
      input.threshold,
      input.callCount,
      input.limit,
    );
    await sendEmail({ to: owner.email, ...email });
  },

  // Fire-and-forget hot-path entry point. Each data-plane call increments the
  // counter by exactly 1, so a threshold is crossed on the one call where the
  // counter equals ceil(limit * threshold / 100); the unique constraint in
  // sendThresholdAlert backstops any replayed or racing crossing.
  notifyThresholds(
    organisationId: string,
    billingPeriod: string,
    callCount: number,
    limit: number,
  ): void {
    for (const threshold of USAGE_ALERT_THRESHOLDS) {
      if (callCount !== Math.ceil((limit * threshold) / 100)) {
        continue;
      }
      void DeveloperUsageAlertService.sendThresholdAlert({
        organisationId,
        billingPeriod,
        threshold,
        callCount,
        limit,
      }).catch((error: unknown) => {
        logger.error("Failed to send developer usage alert", {
          organisationId,
          billingPeriod,
          threshold,
          error,
        });
      });
    }
  },
};
