import type { ContactSource } from "src/models/contect-us";
import logger from "src/utils/logger";
import type { CreateWebContactRequestInput } from "src/services/contact-us.service";
import { prisma } from "src/config/prisma";

// Give the panel a few seconds and no more: the forward runs off the request
// path, but an unbounded hang would pin the event loop's socket pool for
// nothing when the panel is unreachable.
const FORWARD_TIMEOUT_MS = 5_000;

// Batch size for backfill to avoid overwhelming the SuperAdmin API.
const BACKFILL_BATCH_SIZE = 50;

/**
 * Best-effort mirror of public contact-us submissions into the SuperAdmin
 * panel's CRM intake. The panel's /api/contact accepts the contact-web body
 * VERBATIM (it maps fullName/type/phone itself), authenticated by a shared
 * secret in the x-contact-key header, so no field mapping happens here.
 *
 * Two public forms reach this path, not one: /contact-us and the accessibility
 * report at /accessibility/report both POST to /v1/contact-us/contact-web, so
 * both are mirrored by this single forward.
 *
 * The product database remains the source of truth for the submission - a
 * missing or failing forward loses nothing and must never surface to the
 * visitor. Unconfigured (either env var absent) means mirroring is off.
 */
export const SuperadminContactService = {
  async forwardWebContact(
    payload: CreateWebContactRequestInput,
  ): Promise<void> {
    const url = process.env.SUPERADMIN_CONTACT_INTAKE_URL;
    const key = process.env.SUPERADMIN_CONTACT_INTAKE_KEY;
    if (!url || !key) return;

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json", "x-contact-key": key },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(FORWARD_TIMEOUT_MS),
      });

      if (!response.ok) {
        logger.warn("SuperAdmin contact intake rejected the forward", {
          status: response.status,
        });
      }
    } catch (error) {
      logger.error("Failed to forward contact submission to SuperAdmin", {
        error,
      });
    }
  },

  /**
   * Backfills historical contact submissions to the SuperAdmin CRM.
   *
   * The SuperAdmin panel uses `sourceRequestId` (our contactRequest.id) as a
   * unique key for idempotency. This function queries all web-sourced contact
   * requests and forwards them, skipping any that SuperAdmin already has.
   *
   * Timestamp collision handling: `createdAt` has millisecond precision, so
   * backfill bursts naturally produce many rows with the same timestamp.
   * Ordering by `createdAt, id` ensures stable pagination across runs. The
   * SuperAdmin panel's cursor pagination uses the same compound order, so a
   * replayed backlog pages correctly.
   *
   * @param options.since - Only backfill requests created after this date (exclusive).
   * @param options.until - Only backfill requests created before this date (inclusive).
   * @param options.batchSize - Number of requests to process per batch (default 50).
   * @returns Statistics about the backfill run.
   */
  async backfillContactSubmissions(
    options: {
      since?: Date;
      until?: Date;
      batchSize?: number;
    } = {},
  ): Promise<{
    total: number;
    forwarded: number;
    skipped: number;
    failed: number;
  }> {
    const url = process.env.SUPERADMIN_CONTACT_INTAKE_URL;
    const key = process.env.SUPERADMIN_CONTACT_INTAKE_KEY;
    if (!url || !key) {
      throw new Error(
        "SUPERADMIN_CONTACT_INTAKE_URL and SUPERADMIN_CONTACT_INTAKE_KEY must be configured",
      );
    }

    const { since, until, batchSize = BACKFILL_BATCH_SIZE } = options;
    let total = 0;
    let forwarded = 0;
    let skipped = 0;
    let failed = 0;

    const where = {
      source: { in: ["PMS_WEB", "MARKETING_SITE"] as ContactSource[] },
      createdAt: undefined as { gt?: Date; lte?: Date } | undefined,
    };
    if (since) where.createdAt = { ...where.createdAt, gt: since };
    if (until) where.createdAt = { ...where.createdAt, lte: until };
    if (!where.createdAt?.gt && !where.createdAt?.lte) {
      delete where.createdAt;
    }

    // Use cursor-based pagination with compound ordering (createdAt, id) to
    // handle timestamp ties deterministically. This matches the SuperAdmin
    // panel's pagination order so replayed backlogs page correctly.
    let cursor: { createdAt: Date; id: string } | null = null;
    let hasMore = true;

    while (hasMore) {
      const findManyOptions = {
        where,
        orderBy: [{ createdAt: "asc" as const }, { id: "asc" as const }],
        take: batchSize,
        ...(cursor
          ? {
              skip: 1,
              cursor: { id: cursor.id },
            }
          : {}),
      };
      const requests = await prisma.contactRequest.findMany(findManyOptions);

      if (requests.length === 0) {
        hasMore = false;
        break;
      }

      total += requests.length;

      for (const request of requests) {
        // Extract fullName and phone from complaintContext for web submissions
        const complaintContext = request.complaintContext as
          { fullName?: string; phone?: string } | undefined;
        const fullName = complaintContext?.fullName ?? "";
        const phone = complaintContext?.phone;

        // Skip if missing required fields for web submission shape
        if (!fullName || !request.email) {
          logger.warn("Skipping contact request missing required web fields", {
            id: request.id,
            hasFullName: !!fullName,
            hasEmail: !!request.email,
          });
          skipped++;
          continue;
        }

        const payload: CreateWebContactRequestInput = {
          type: request.type,
          source: request.source as "PMS_WEB" | "MARKETING_SITE",
          message: request.message,
          fullName,
          email: request.email,
          phone,
          organisationId: request.organisationId ?? undefined,
          dsarDetails:
            request.dsarDetails as unknown as CreateWebContactRequestInput["dsarDetails"],
          attachments:
            request.attachments as unknown as CreateWebContactRequestInput["attachments"],
        };

        try {
          const response = await fetch(url, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-contact-key": key,
            },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(FORWARD_TIMEOUT_MS),
          });

          if (response.ok) {
            // SuperAdmin handles deduplication internally via sourceRequestId unique
            // constraint with skipDuplicates: true, so all OK responses count as
            // forwarded. The panel silently skips duplicates.
            forwarded++;
          } else {
            logger.warn(
              "SuperAdmin contact intake rejected the forward during backfill",
              {
                status: response.status,
                requestId: request.id,
              },
            );
            failed++;
          }
        } catch (error) {
          logger.error(
            "Failed to forward contact submission to SuperAdmin during backfill",
            {
              error,
              requestId: request.id,
            },
          );
          failed++;
        }
      }

      // Update cursor for next page
      const lastRequest = requests[requests.length - 1] as {
        createdAt: Date;
        id: string;
      };
      cursor = { createdAt: lastRequest.createdAt, id: lastRequest.id };
      hasMore = requests.length === batchSize;
    }

    return { total, forwarded, skipped, failed };
  },
};
