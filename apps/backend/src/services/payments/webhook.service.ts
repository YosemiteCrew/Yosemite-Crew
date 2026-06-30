import { prisma } from "src/config/prisma";
import logger from "src/utils/logger";
import type { PaymentProviderRegistry } from "./registry";
import type { NormalizedPaymentEvent, ProviderId } from "./types";
import { WebhookVerificationError } from "./errors";

export class PaymentWebhookService {
  constructor(private readonly registry: PaymentProviderRegistry) {}

  /**
   * Verify, deduplicate, and dispatch a raw provider webhook.
   * Returns the count of new events processed (duplicates are silently skipped).
   */
  async handle(
    providerId: ProviderId,
    rawBody: Buffer,
    headers: Record<string, string | string[] | undefined>,
  ): Promise<number> {
    const adapter = this.registry.get(providerId);
    const events = adapter.verifyAndNormalizeWebhook(rawBody, headers);

    let dispatched = 0;
    for (const event of events) {
      const isNew = await this.markProcessed(
        event.providerEventRef,
        providerId,
      );
      if (!isNew) continue;

      await this.dispatch(event);
      dispatched++;
    }
    return dispatched;
  }

  private async markProcessed(
    providerEventRef: string,
    providerId: string,
  ): Promise<boolean> {
    try {
      await prisma.processedWebhookEvent.create({
        data: { providerEventRef, providerId },
      });
      return true;
    } catch {
      // Unique constraint violation = already processed.
      return false;
    }
  }

  private async dispatch(event: NormalizedPaymentEvent): Promise<void> {
    try {
      switch (event.type) {
        case "PAYMENT_SUCCEEDED":
          await this.onPaymentSucceeded(event);
          break;
        case "PAYMENT_FAILED":
          await this.onPaymentFailed(event);
          break;
        case "REFUND_SUCCEEDED":
          await this.onRefundSucceeded(event);
          break;
        case "REFUND_FAILED":
          await this.onRefundFailed(event);
          break;
        case "ACCOUNT_UPDATED":
          await this.onAccountUpdated(event);
          break;
      }
    } catch (err) {
      logger.error("PaymentWebhookService: dispatch failed", {
        eventRef: event.providerEventRef,
        type: event.type,
        err,
      });
    }
  }

  private async onPaymentSucceeded(
    event: NormalizedPaymentEvent,
  ): Promise<void> {
    if (!event.providerPaymentRef) return;

    const attempt = await prisma.paymentAttempt.findFirst({
      where: { providerPaymentIntentId: event.providerPaymentRef },
    });
    if (!attempt) return;

    await prisma.$transaction([
      prisma.paymentAttempt.update({
        where: { id: attempt.id },
        data: {
          status: "SUCCEEDED",
          amountCaptured: event.amount?.minorAmount ?? attempt.amountRequested,
        },
      }),
      prisma.payment.upsert({
        where: { paymentAttemptId: attempt.id },
        update: { status: "SUCCEEDED", paidAt: new Date() },
        create: {
          invoiceId: attempt.invoiceId,
          paymentAttemptId: attempt.id,
          provider: attempt.provider,
          providerPaymentId: event.providerPaymentRef,
          amount: event.amount?.minorAmount ?? attempt.amountRequested,
          currency: event.amount?.currency ?? attempt.currency,
          status: "SUCCEEDED",
          paidAt: new Date(),
        },
      }),
    ]);
  }

  private async onPaymentFailed(event: NormalizedPaymentEvent): Promise<void> {
    if (!event.providerPaymentRef) return;

    await prisma.paymentAttempt.updateMany({
      where: { providerPaymentIntentId: event.providerPaymentRef },
      data: {
        status: "FAILED",
        failureCode: event.failureCode ?? null,
        failureMessage: event.failureMessage ?? null,
      },
    });
  }

  private async onRefundSucceeded(
    event: NormalizedPaymentEvent,
  ): Promise<void> {
    if (!event.providerRefundRef) return;

    await prisma.refund.updateMany({
      where: { providerRefundId: event.providerRefundRef },
      data: { status: "SUCCEEDED" },
    });
  }

  private async onRefundFailed(event: NormalizedPaymentEvent): Promise<void> {
    if (!event.providerRefundRef) return;

    await prisma.refund.updateMany({
      where: { providerRefundId: event.providerRefundRef },
      data: { status: "FAILED" },
    });
  }

  private async onAccountUpdated(event: NormalizedPaymentEvent): Promise<void> {
    if (!event.accountRef) return;

    const billing = await prisma.organizationBilling.findFirst({
      where: { connectAccountId: event.accountRef },
      select: { orgId: true },
    });
    if (!billing) return;

    const adapter = this.registry.get("STRIPE");
    const status = await adapter.getAccountStatus(billing.orgId);

    await prisma.organizationBilling.updateMany({
      where: { connectAccountId: event.accountRef },
      data: {
        canAcceptPayments: status.chargesEnabled,
        connectChargesEnabled: status.chargesEnabled,
        connectPayoutsEnabled: status.payoutsEnabled,
        connectDisabledReason: status.disabledReason,
      },
    });
  }
}
