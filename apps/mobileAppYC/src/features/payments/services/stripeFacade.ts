// Stripe PaymentSheet facade (mocked for now)
// Integration plan:
// 1) Install: yarn add @stripe/stripe-react-native; wrap app in <StripeProvider publishableKey=...>
// 2) Backend endpoints:
//    - POST /payments/intents -> returns clientSecret, ephemeralKey, customerId
//    - GET  /payments/ephemeral-key -> returns ephemeral key for Customer (if using)
//    - Webhooks to mark appointment paid on payment_intent.succeeded
// 3) In PaymentInvoice screen, call initPaymentSheet() then presentPaymentSheet().
// 4) On success, dispatch recordPayment and navigate to success.

export type InitResult = { success: boolean; error?: string };
export type PresentResult = { success: boolean; error?: string };

export const initPaymentSheet = async (_opts: {
  clientSecret?: string;
  customerEphemeralKeySecret?: string;
  customerId?: string;
}): Promise<InitResult> => {
  // Mock immediate success
  await new Promise(r => setTimeout(r, 150));
  return {success: true};
};

export const presentPaymentSheet = async (): Promise<PresentResult> => {
  // Mock success immediately
  await new Promise(r => setTimeout(r, 200));
  return {success: true};
};

