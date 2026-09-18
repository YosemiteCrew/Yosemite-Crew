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

export type RecordRefundInput = {
  provider: PrismaPaymentProvider;
  /** The connected account the capture landed in; platform captures pass null. */
  merchantAccountRef?: string | null;
  /** The provider's own reference for the CAPTURE being reversed. */
  paymentRef: string;
  /**
   * What the provider says it has given back in total on this capture, not the
   * amount of one refund event.
   */
  refundedAmount: number;
  currency: string;
};

export type RecordRefundResult = {
  id: string;
  status: PrismaProviderReceiptStatus;
  refundedAmount: number;
  /** False when the stored figure already covered this refund. */
  applied: boolean;
};

/**
 * The state a receipt is in once the provider has given some of it back.
 *
 * A capture that has been refunded in full needs no allocation and no
 * reconciliation, so REFUNDED replaces whatever it was - including
 * UNATTRIBUTED, because money that has gone back needs no owner found for it.
 * A partial refund leaves a residual that still does, which is why it gets its
 * own state rather than being folded into either neighbour.
 *
 * `amount` and `refundedAmount` are both minor units divided by the same
 * currency exponent, so they compare exactly; there is no rounding slack to
 * absorb here and an epsilon would only hide a real over-refund.
 */
export const refundedReceiptStatus = (input: {
  amount: number;
  refundedAmount: number;
}): PrismaProviderReceiptStatus =>
  input.refundedAmount >= input.amount ? "REFUNDED" : "PARTIALLY_REFUNDED";

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

  /**
   * Reverse a journalled capture by the provider's cumulative refunded figure.
   *
   * Keyed on the capture's own reference, so a refund lands on the receipt for
   * the money it is giving back and never on a sibling capture of the same
   * appointment. Without this a receipt stayed at its full captured amount
   * after the money had gone, and the issue's oracle - captured equals applied
   * plus unapplied plus refunded - had no term to read for the last one.
   *
   * The figure is cumulative and the write is conditional on being an
   * increase, so a redelivered event, an out-of-order pair of partial refunds
   * and two concurrent deliveries all converge on the provider's own total
   * rather than summing deltas into a number the provider never stated.
   *
   * It reverses the RECEIPT, not an allocation. Releasing the credit a refund
   * takes back belongs to the single account-receipt transaction in #3163;
   * `invoiceId` is left in place because it is the historical record of where
   * the money went, and erasing it would destroy the only link a
   * reconciliation has to work from.
   *
   * Never throws, for the same reason `journalCapture` does not: a webhook
   * answered non-2xx is retried forever, and the refund has happened either
   * way.
   */
  async recordRefund(
    input: RecordRefundInput,
  ): Promise<RecordRefundResult | null> {
    const merchantAccountRef =
      input.merchantAccountRef ?? PLATFORM_MERCHANT_ACCOUNT_REF;

    try {
      const existing = await prisma.providerReceipt.findUnique({
        where: {
          provider_merchantAccountRef_paymentRef: {
            provider: input.provider,
            merchantAccountRef,
            paymentRef: input.paymentRef,
          },
        },
        select: {
          id: true,
          amount: true,
          currency: true,
          status: true,
          refundedAmount: true,
        },
      });

      if (!existing) {
        // The capture this reverses was never journalled, so there is nothing
        // to reduce. Loud, because it means money left the account against a
        // record we do not hold.
        logger.error(
          `Refund of ${input.paymentRef} on ${merchantAccountRef} has no journalled capture to reverse`,
        );
        return null;
      }

      if (existing.currency !== input.currency) {
        // Two currencies cannot be compared, so writing this figure would put
        // a number in the journal that means nothing against the amount beside
        // it. A gap a human can see beats a total that silently does not add
        // up.
        logger.error(
          `Refund of ${input.paymentRef} on ${merchantAccountRef} is in a different currency from the capture it reverses; not recorded`,
        );
        return null;
      }

      const status = refundedReceiptStatus({
        amount: existing.amount,
        refundedAmount: input.refundedAmount,
      });

      const updated = await prisma.providerReceipt.updateMany({
        where: {
          id: existing.id,
          refundedAmount: { lt: input.refundedAmount },
        },
        data: {
          refundedAmount: input.refundedAmount,
          status,
          version: { increment: 1 },
        },
      });

      if (updated.count === 1) {
        return {
          id: existing.id,
          status,
          refundedAmount: input.refundedAmount,
          applied: true,
        };
      }

      // count 0 means the stored figure already covers this refund - a replay,
      // an event delivered behind a later one, or a concurrent delivery that
      // won. None of those is an error, and none of them makes the status this
      // call computed the stored one, so the answer comes from a fresh read.
      const persisted = await prisma.providerReceipt.findUnique({
        where: { id: existing.id },
        select: { status: true, refundedAmount: true },
      });

      return {
        id: existing.id,
        status: persisted?.status ?? existing.status,
        refundedAmount: persisted?.refundedAmount ?? existing.refundedAmount,
        applied: false,
      };
    } catch (error) {
      logger.error(
        `Could not record refund of ${input.paymentRef} on ${merchantAccountRef}`,
        error,
      );
      return null;
    }
  },
};
