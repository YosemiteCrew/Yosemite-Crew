import { DeveloperApiKeyStatus } from "@prisma/client";
import { prisma } from "src/config/prisma";
import {
  DeveloperRequestLogService,
  REQUEST_LOG_RETENTION_DAYS,
} from "src/services/developer-request-log.service";
import { resolveOrgOwnerContact } from "src/services/developer-usage-alert.service";
import { sendEmail } from "src/utils/email";
import logger from "src/utils/logger";

// Daily developer-platform maintenance, run by the developer-maintenance
// BullMQ worker: request-log retention plus API-key expiry reminders.

const DAY_MS = 24 * 60 * 60 * 1000;

// Expiry reminder window: keys whose expiresAt falls within (now + 6.5d,
// now + 7d]. The job runs once a day, so a key's fixed expiresAt lands inside
// this 12-hour-wide window on at most ONE run - that windowing is the whole
// dedupe mechanism, with no sent-tracking table. Accepted tradeoffs:
// - if the job misses a day (worker downtime, Redis flush) the keys whose
//   window passed during the outage get no reminder;
// - if the job were ever rescheduled to run more than twice a day it could
//   double-send. Revisit with a sent-marker column if either bites.
export const EXPIRY_REMINDER_WINDOW_START_DAYS = 6.5;
export const EXPIRY_REMINDER_WINDOW_END_DAYS = 7;

const buildExpiryReminderEmail = (
  ownerName: string | undefined,
  organisationName: string,
  key: { name: string; prefix: string; last4: string; expiresAt: Date },
) => {
  const greeting = ownerName ?? "there";
  const expiresOn = key.expiresAt.toISOString().slice(0, 10);
  const keyLabel = `${key.name} (${key.prefix}...${key.last4})`;
  return {
    subject: "Your Yosemite Crew API key expires in 7 days",
    textBody: [
      `Hi ${greeting},`,
      "",
      `The API key ${keyLabel} for ${organisationName} expires on ${expiresOn}.`,
      "Rotate or reissue it before then to avoid interruptions to your integration.",
    ].join("\n"),
    htmlBody: `
      <p>Hi ${greeting},</p>
      <p>The API key <strong>${keyLabel}</strong> for <strong>${organisationName}</strong> expires on <strong>${expiresOn}</strong>.</p>
      <p>Rotate or reissue it before then to avoid interruptions to your integration.</p>
    `,
  };
};

export const DeveloperMaintenanceService = {
  // Deletes data-plane request logs older than the retention window.
  async purgeRequestLogs(): Promise<number> {
    const deleted = await DeveloperRequestLogService.deleteOlderThan(
      REQUEST_LOG_RETENTION_DAYS,
    );
    logger.info("Developer request-log retention pass complete", { deleted });
    return deleted;
  },

  // Emails org owners about active keys expiring within 7 days (see the
  // window/dedupe note above). Per-key failures are logged and never abort
  // the rest of the batch.
  async sendKeyExpiryReminders(): Promise<number> {
    const now = Date.now();
    const windowStart = new Date(
      now + EXPIRY_REMINDER_WINDOW_START_DAYS * DAY_MS,
    );
    const windowEnd = new Date(now + EXPIRY_REMINDER_WINDOW_END_DAYS * DAY_MS);

    const keys = await prisma.developerApiKey.findMany({
      where: {
        status: DeveloperApiKeyStatus.active,
        rotationGraceUntil: null,
        expiresAt: { gt: windowStart, lte: windowEnd },
      },
      select: {
        id: true,
        organisationId: true,
        name: true,
        prefix: true,
        last4: true,
        expiresAt: true,
      },
    });

    let sent = 0;
    for (const key of keys) {
      try {
        const owner = await resolveOrgOwnerContact(key.organisationId);
        if (!owner) {
          logger.error("Key expiry reminder: no owner contact", {
            keyId: key.id,
            organisationId: key.organisationId,
          });
          continue;
        }
        const email = buildExpiryReminderEmail(
          owner.name,
          owner.organisationName,
          // expiresAt is non-null by the query predicate.
          { ...key, expiresAt: key.expiresAt as Date },
        );
        await sendEmail({ to: owner.email, ...email });
        sent += 1;
      } catch (error) {
        logger.error("Failed to send API key expiry reminder", {
          keyId: key.id,
          error,
        });
      }
    }
    logger.info("Developer key expiry reminder pass complete", {
      candidates: keys.length,
      sent,
    });
    return sent;
  },

  // Entry point for the daily worker. Each step is isolated so a failure in
  // one never starves the other.
  async run(): Promise<void> {
    try {
      await DeveloperMaintenanceService.purgeRequestLogs();
    } catch (error) {
      logger.error("Developer request-log retention failed", { error });
    }
    try {
      await DeveloperMaintenanceService.sendKeyExpiryReminders();
    } catch (error) {
      logger.error("Developer key expiry reminders failed", { error });
    }
  },
};
