import logger from "src/utils/logger";
import { prisma } from "src/config/prisma";

// Give the panel a few seconds and no more: the drain runs off the request
// path, but an unbounded hang would pin the event loop's socket pool for
// nothing when the panel is unreachable.
const FORWARD_TIMEOUT_MS = 5_000;

/**
 * Rows sent per tick. Every forward, live or backfilled, leaves through this
 * one job, so the tick rate IS the mirror's rate: 15 a minute keeps the whole
 * mirror under the panel intake's limit of 20 requests per 60 seconds.
 */
export const FORWARD_BATCH_SIZE = 15;

/** Used when a 429 carries no usable Retry-After. */
const DEFAULT_RETRY_AFTER_SECONDS = 60;

/** Backoff ceiling. A wrong key or a panel outage drains by itself once fixed. */
const MAX_BACKOFF_MINUTES = 60;

const MINUTE_MS = 60_000;

export type DrainSummary = {
  delivered: number;
  retrying: number;
  failed: number;
  pending: number;
  oldestPendingSeconds: number | null;
};

type ForwardRow = {
  contactRequestId: string;
  attempts: number;
  contactRequest: {
    id: string;
    createdAt: Date;
    email: string | null;
    type: string;
    message: string;
    complaintContext: unknown;
  };
};

const PENDING = { deliveredAt: null, failedAt: null } as const;

const readConfig = () => ({
  url: process.env.SUPERADMIN_CONTACT_INTAKE_URL,
  key: process.env.SUPERADMIN_CONTACT_INTAKE_KEY,
});

/**
 * fullName and phone live in `complaintContext`, which is Json and therefore
 * `unknown` to the compiler. Read defensively rather than casting: a row
 * written by an older shape must still send, because refusing to send it would
 * strand the submission in exactly the way this queue exists to prevent.
 */
const readComplaintContext = (
  value: unknown,
): { fullName?: string; phone?: string } => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const record = value as Record<string, unknown>;
  return {
    ...(typeof record.fullName === "string"
      ? { fullName: record.fullName }
      : {}),
    ...(typeof record.phone === "string" ? { phone: record.phone } : {}),
  };
};

/**
 * Retry-After is seconds or an HTTP date. Anything we cannot read becomes the
 * default: a malformed header must not translate into "retry immediately",
 * which is what a NaN would do once added to a timestamp.
 */
export const parseRetryAfterSeconds = (
  header: string | null,
  now: Date,
): number => {
  if (!header) return DEFAULT_RETRY_AFTER_SECONDS;
  const trimmed = header.trim();
  if (/^\d+$/.test(trimmed)) return Number(trimmed);
  const asDate = Date.parse(trimmed);
  if (Number.isNaN(asDate)) return DEFAULT_RETRY_AFTER_SECONDS;
  const seconds = Math.ceil((asDate - now.getTime()) / 1000);
  return seconds > 0 ? seconds : DEFAULT_RETRY_AFTER_SECONDS;
};

/**
 * `attempts` is the count AFTER this failure, so the first retry waits two
 * minutes rather than one, and the ceiling is reached at six failures.
 */
export const backoffMs = (attempts: number): number =>
  Math.min(2 ** attempts, MAX_BACKOFF_MINUTES) * MINUTE_MS;

const buildIntakeBody = (row: ForwardRow) => {
  const { fullName, phone } = readComplaintContext(
    row.contactRequest.complaintContext,
  );
  return {
    sourceRequestId: row.contactRequest.id,
    submittedAt: row.contactRequest.createdAt.toISOString(),
    email: row.contactRequest.email,
    fullName,
    phone,
    type: row.contactRequest.type,
    message: row.contactRequest.message,
  };
};

/**
 * Durable mirror of public contact-us submissions into the SuperAdmin panel's
 * CRM intake.
 *
 * A forward row is written in the same insert as the submission, so the mirror
 * being off, refusing or unreachable queues the submission rather than losing
 * it. This service drains that queue; it is the only sender, which is what lets
 * one batch size hold the whole mirror under the panel's rate limit.
 *
 * Two public forms reach this path, not one: /contact-us and the accessibility
 * report at /accessibility/report both POST to /v1/contact-us/contact-web, so
 * both are mirrored.
 *
 * The product database remains the source of truth for the submission, and a
 * failing forward must never surface to the visitor.
 */
export const SuperadminContactService = {
  /**
   * One warn at startup rather than one per submission: unconfigured is a
   * standing state, and the number that matters is how much has piled up.
   */
  async warnIfUnconfigured(): Promise<void> {
    const { url, key } = readConfig();
    if (url && key) return;
    const pending = await prisma.superadminContactForward.count({
      where: PENDING,
    });
    logger.warn("SuperAdmin contact mirroring is not configured", {
      missing: !url
        ? "SUPERADMIN_CONTACT_INTAKE_URL"
        : "SUPERADMIN_CONTACT_INTAKE_KEY",
      pending,
    });
  },

  async drainForwards(now: Date = new Date()): Promise<DrainSummary> {
    const { url, key } = readConfig();
    let delivered = 0;
    let retrying = 0;
    let failed = 0;

    if (url && key) {
      const batch = (await prisma.superadminContactForward.findMany({
        where: { ...PENDING, nextAttemptAt: { lte: now } },
        orderBy: [{ nextAttemptAt: "asc" }, { contactRequestId: "asc" }],
        take: FORWARD_BATCH_SIZE,
        include: {
          contactRequest: {
            select: {
              id: true,
              createdAt: true,
              email: true,
              type: true,
              message: true,
              complaintContext: true,
            },
          },
        },
      })) as unknown as ForwardRow[];

      for (const row of batch) {
        const outcome = await sendOne(row, url, key, now);
        if (outcome === "delivered") delivered += 1;
        else if (outcome === "failed") failed += 1;
        else retrying += 1;
        // A 429 is the panel telling us the whole client is over its limit, so
        // the rest of the batch would be refused too. Ending the tick leaves
        // those rows untouched instead of burning an attempt on each.
        if (outcome === "rate-limited") break;
      }
    }

    const pending = await prisma.superadminContactForward.count({
      where: PENDING,
    });
    const oldest = pending
      ? await prisma.superadminContactForward.findFirst({
          where: PENDING,
          orderBy: { createdAt: "asc" },
          select: { createdAt: true },
        })
      : null;

    return {
      delivered,
      retrying,
      failed,
      pending,
      oldestPendingSeconds: oldest
        ? Math.max(
            0,
            Math.floor((now.getTime() - oldest.createdAt.getTime()) / 1000),
          )
        : null,
    };
  },
};

type SendOutcome = "delivered" | "failed" | "retry" | "rate-limited";

const sendOne = async (
  row: ForwardRow,
  url: string,
  key: string,
  now: Date,
): Promise<SendOutcome> => {
  let response: Response | null = null;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", "x-contact-key": key },
      body: JSON.stringify(buildIntakeBody(row)),
      signal: AbortSignal.timeout(FORWARD_TIMEOUT_MS),
    });
  } catch {
    // Timeout or network error. No status to record, and nothing about the
    // error is logged here: the payload is personal data and the error can
    // quote the request.
    await scheduleRetry(row, now, null);
    return "retry";
  }

  const status = response.status;

  if (response.ok) {
    await prisma.superadminContactForward.update({
      where: { contactRequestId: row.contactRequestId },
      data: { deliveredAt: now, lastAttemptAt: now, lastStatus: status },
    });
    return "delivered";
  }

  if (status === 429) {
    const seconds = parseRetryAfterSeconds(
      response.headers.get("retry-after"),
      now,
    );
    await prisma.superadminContactForward.update({
      where: { contactRequestId: row.contactRequestId },
      data: {
        nextAttemptAt: new Date(now.getTime() + seconds * 1000),
        lastAttemptAt: now,
        lastStatus: status,
      },
    });
    return "rate-limited";
  }

  if (status === 400 || status === 409) {
    // Both refuse the CONTENT, so sending the same content again cannot
    // succeed. The id only - never the submission - so the log does not become
    // a second copy of the personal data.
    await prisma.superadminContactForward.update({
      where: { contactRequestId: row.contactRequestId },
      data: { failedAt: now, lastAttemptAt: now, lastStatus: status },
    });
    logger.error("SuperAdmin contact intake refused a forward", {
      contactRequestId: row.contactRequestId,
      status,
    });
    return "failed";
  }

  // 401, 5xx and anything else: transient as far as we can tell. No attempt
  // cap, so a wrong key drains by itself once the key is fixed.
  await scheduleRetry(row, now, status);
  return "retry";
};

const scheduleRetry = async (
  row: ForwardRow,
  now: Date,
  status: number | null,
) => {
  const attempts = row.attempts + 1;
  await prisma.superadminContactForward.update({
    where: { contactRequestId: row.contactRequestId },
    data: {
      attempts,
      nextAttemptAt: new Date(now.getTime() + backoffMs(attempts)),
      lastAttemptAt: now,
      lastStatus: status,
    },
  });
};
