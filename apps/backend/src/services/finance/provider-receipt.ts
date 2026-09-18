import type {
  PaymentProvider as PrismaPaymentProvider,
  ProviderReceiptStatus as PrismaProviderReceiptStatus,
  Prisma,
} from "@prisma/client";
import { prisma } from "src/config/prisma";
import logger from "src/utils/logger";

/**
 * The journal of captured provider payments (#3170).
 *
 * `Payment` and `PaymentAttempt` both require an `invoiceId`, so before this
 * existed a captured payment that could not be matched to an invoice had
 * nowhere to go: the appointment-booking webhook has five exits where the card
 * is already charged and no invoice can be minted, and every one of them wrote
 * a log line and nothing durable.
 *
 * This records the money first and attributes it afterwards. It is a JOURNAL,
 * not a ledger - writing here never posts an account credit. That belongs to
 * the canonical account receipt in #3163, which links to a row here 1:1, so a
 * second write here must never be able to mean a second credit.
 */

/**
 * The merchant account for a capture that landed on the platform account
 * rather than a connected one.
 *
 * A sentinel rather than NULL because the uniqueness of a journalled capture
 * depends on it: Postgres keeps NULLs distinct in a unique index, so a
 * nullable merchant account would let the same payment reference be journalled
 * twice - which is the one thing this table exists to prevent.
 */
export const PLATFORM_MERCHANT_ACCOUNT_REF = "PLATFORM";

export type JournalCaptureInput = {
  provider: PrismaPaymentProvider;
  /** The connected account the money landed in; platform captures pass null. */
  merchantAccountRef?: string | null;
  /** The provider's own reference for this capture - a Stripe intent id. */
  paymentRef: string;
  amount: number;
  currency: string;
  capturedAt: Date;
  organisationId?: string | null;
  invoiceId?: string | null;
  appointmentId?: string | null;
  /** Why the capture is in this state, for the human who reconciles it. */
  reason?: string | null;
  rawProviderPayload?: Prisma.InputJsonValue | null;
};

export type JournalCaptureResult = {
  id: string;
  status: PrismaProviderReceiptStatus;
  /** False when this delivery found the row a previous one had already written. */
  created: boolean;
};

const isUniqueConstraintViolation = (error: unknown): boolean =>
  !!error &&
  typeof error === "object" &&
  "code" in error &&
  (error as { code?: string }).code === "P2002";

/**
 * The state a freshly journalled capture starts in.
 *
 * Attribution and allocation are separate facts and this keeps them separate:
 * no organisation is UNATTRIBUTED, an organisation with nothing applied is
 * UNALLOCATED, and an invoice the ingesting path already knew about is
 * ALLOCATED. Nothing here guesses - a receipt is only ALLOCATED when the
 * caller hands over the invoice it was actually applied to.
 */
export const initialReceiptStatus = (input: {
  organisationId?: string | null;
  invoiceId?: string | null;
}): PrismaProviderReceiptStatus => {
  if (!input.organisationId) return "UNATTRIBUTED";
  return input.invoiceId ? "ALLOCATED" : "UNALLOCATED";
};

/**
 * Fill in an UNATTRIBUTED receipt once a later call knows who it belongs to.
 *
 * The identity of a receipt is immutable - provider, merchant account and
 * payment reference are the key and are never rewritten. What this fills in is
 * the context the ingesting path had not learned yet, because the journal is
 * written FIRST, before any lookup that could throw, so that no capture
 * depends on the rest of the handler succeeding.
 *
 * Deliberately narrow:
 *   - it only ever moves a receipt OUT of UNATTRIBUTED, so a receipt an
 *     operator has already acted on cannot be rewritten by a redelivery;
 *   - the status predicate is in the WHERE, not checked and then written, so a
 *     concurrent redelivery cannot both pass the check and both write;
 *   - it posts no credit anywhere. This is a journal.
 */
const attributeIfStillUnattributed = async (
  existing: { id: string; status: PrismaProviderReceiptStatus },
  input: JournalCaptureInput,
): Promise<PrismaProviderReceiptStatus> => {
  if (existing.status !== "UNATTRIBUTED" || !input.organisationId) {
    return existing.status;
  }

  const status = initialReceiptStatus(input);
  const updated = await prisma.providerReceipt.updateMany({
    where: { id: existing.id, status: "UNATTRIBUTED" },
    data: {
      organisationId: input.organisationId,
      invoiceId: input.invoiceId ?? null,
      appointmentId: input.appointmentId ?? null,
      reason: input.reason ?? null,
      status,
      version: { increment: 1 },
    },
  });

  if (updated.count === 1) return status;

  // count 0 means the row left UNATTRIBUTED between the read and the write, so
  // neither the status we intended nor the one we read is the stored one. The
  // caller is told what a receipt IS, never what a lost race hoped it would be,
  // so the only honest answer is a fresh read.
  const persisted = await prisma.providerReceipt.findUnique({
    where: { id: existing.id },
    select: { status: true },
  });
  return persisted?.status ?? existing.status;
};

export const ProviderReceiptService = {
  /**
   * Record a captured payment, exactly once per provider reference.
   *
   * Idempotent by the provider's reference rather than by anything derived
   * from our own records: a redelivered webhook carries the SAME reference and
   * must land on the row it already wrote, while a second legitimate charge on
   * the same appointment carries a DIFFERENT one and must get its own row. Two
   * connected accounts stay isolated because the account is part of the key.
   *
   * Create-then-recover rather than upsert, for two reasons. It answers
   * whether this delivery was the one that wrote the row, which an upsert
   * cannot. And it is the shape that is correct under a concurrent redelivery:
   * the racer that loses gets P2002 from an insert the winner had already
   * committed, so the read that follows cannot miss it.
   *
   * Never throws to its caller. A journal that can fail a webhook would turn
   * "we could not record the money" into "Stripe retries this event forever",
   * which is strictly worse than a logged failure - the capture has already
   * happened either way.
   */
  async journalCapture(
    input: JournalCaptureInput,
  ): Promise<JournalCaptureResult | null> {
    const merchantAccountRef =
      input.merchantAccountRef ?? PLATFORM_MERCHANT_ACCOUNT_REF;
    const key = {
      provider: input.provider,
      merchantAccountRef,
      paymentRef: input.paymentRef,
    };

    try {
      const created = await prisma.providerReceipt.create({
        data: {
          ...key,
          organisationId: input.organisationId ?? null,
          invoiceId: input.invoiceId ?? null,
          appointmentId: input.appointmentId ?? null,
          amount: input.amount,
          currency: input.currency,
          capturedAt: input.capturedAt,
          status: initialReceiptStatus(input),
          reason: input.reason ?? null,
          ...(input.rawProviderPayload == null
            ? {}
            : { rawProviderPayload: input.rawProviderPayload }),
        },
        select: { id: true, status: true },
      });
      return { id: created.id, status: created.status, created: true };
    } catch (error) {
      if (!isUniqueConstraintViolation(error)) {
        // The capture stands whether or not we managed to write it down, so
        // the loud failure belongs in the log and not in the webhook's status
        // code.
        logger.error(
          `Could not journal captured payment ${input.paymentRef} on ${merchantAccountRef}`,
          error,
        );
        return null;
      }

      const existing = await prisma.providerReceipt.findUnique({
        where: { provider_merchantAccountRef_paymentRef: key },
        select: { id: true, status: true },
      });
      if (!existing) {
        // A unique violation whose row cannot then be read is not a replay. It
        // means the constraint that fired was a different one, so treating it
        // as "already journalled" would be a silent loss.
        logger.error(
          `Captured payment ${input.paymentRef} on ${merchantAccountRef} collided on a unique constraint but no journal row was found`,
        );
        return null;
      }

      const attributed = await attributeIfStillUnattributed(existing, input);
      logger.info(
        `Captured payment ${input.paymentRef} on ${merchantAccountRef} was already journalled as receipt ${existing.id}`,
      );
      return { id: existing.id, status: attributed, created: false };
    }
  },
};
