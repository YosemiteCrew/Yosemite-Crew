/** Errors raised by the payment-gateway abstraction. */

export class PaymentProviderError extends Error {
  readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = "PaymentProviderError";
    this.code = code;
  }
}

export class UnknownProviderError extends PaymentProviderError {
  constructor(provider: string) {
    super(
      `No payment provider registered for "${provider}"`,
      "UNKNOWN_PROVIDER",
    );
    this.name = "UnknownProviderError";
  }
}

export class WebhookVerificationError extends PaymentProviderError {
  constructor(message = "Webhook signature verification failed") {
    super(message, "WEBHOOK_VERIFICATION_FAILED");
    this.name = "WebhookVerificationError";
  }
}

export class RefundExceedsCaptureError extends PaymentProviderError {
  constructor() {
    super(
      "Refund amount exceeds the captured amount",
      "REFUND_EXCEEDS_CAPTURE",
    );
    this.name = "RefundExceedsCaptureError";
  }
}

export class UnknownPaymentError extends PaymentProviderError {
  constructor(providerPaymentRef: string) {
    super(
      `No payment found for reference "${providerPaymentRef}"`,
      "UNKNOWN_PAYMENT",
    );
    this.name = "UnknownPaymentError";
  }
}
