export type PaymentCollectionMethodValue =
  | "PAYMENT_INTENT"
  | "PAYMENT_LINK"
  | "PAYMENT_AT_CLINIC";

export const resolvePaymentCollectionMethod = (
  value: string | undefined,
  onError: (message: string) => Error,
): PaymentCollectionMethodValue | undefined => {
  if (!value) return undefined;
  const normalized = value.trim().toUpperCase();
  const allowed: PaymentCollectionMethodValue[] = [
    "PAYMENT_INTENT",
    "PAYMENT_LINK",
    "PAYMENT_AT_CLINIC",
  ];
  if (!allowed.includes(normalized as PaymentCollectionMethodValue)) {
    throw onError("Invalid payment collection method.");
  }
  return normalized as PaymentCollectionMethodValue;
};
