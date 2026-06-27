# Payment Gateway Abstraction - Stripe + Financing Partners (CareCredit / Scratchpay)

Status: proposal (design and test plan)
Related issue: #1659
Scope: `apps/backend`, `apps/frontend`, `apps/mobileAppYC`, `packages/database`, `packages/lib`

This document is the detailed design and verification plan behind issue #1659. It describes how to introduce a provider-agnostic payment-gateway abstraction with Stripe as the card-payment rail and CareCredit or Scratchpay as financing options selected per organisation, and how to do so with a test and rollout plan strong enough to enable real money movement with confidence. It contains no credentials or secret values; configuration is referenced by purpose only.

## Settlement model (the core principle)

The platform takes no fee and is never the financial principal. For every customer payment the clinic is the merchant of record: the clinic appears on the payer's statement, the clinic bears the provider processing fee, and the clinic owns refunds and chargebacks. The platform's role is orchestration and governance only.

- **Stripe (card payments):** Standard Connect accounts with direct charges. The charge is created in the clinic's account context, so the processing fee, the statement descriptor, and dispute liability all sit with the clinic. Negative-balance liability stays with the clinic and Stripe, not the platform. No application fee.
- **CareCredit / Scratchpay (financing):** Each clinic signs up directly with the financing provider. The financing company underwrites the patient's loan, pays the clinic in full upfront, and collects repayments from the pet owner. The platform is the technology layer that initiates the financing application and receives confirmation; it is not a lender, does not touch the funds, and has no regulatory exposure.

There is no platform fee, take-rate, or split on any provider. The current Stripe flow uses destination charges, which makes the platform the merchant of record; migrating to direct charges is a prerequisite for the Stripe adapter and is tracked in #1678.

## Why CareCredit / Scratchpay instead of Adyen

The original scope included Adyen as a second card processor. Adyen for Platforms contracts with the platform entity as the regulatory principal - even with 100% of funds routed to the clinic, the platform bears regulatory exposure. That is incompatible with the "platform is software and governance only" constraint.

CareCredit (Synchrony Financial) and Scratchpay are healthcare financing providers. Each clinic signs their own agreement directly with the financing provider. The platform integrates via API to initiate the financing application flow and receive funded/declined events. The regulatory and financial relationship is clinic-to-financing-provider; the platform is the facilitating software and has no regulatory exposure.

This also addresses the real driver behind the second-provider requirement: Stripe's per-transaction fee (~2.9% + $0.30) is high for clinic-to-pet-owner payments. Financing providers accept a higher processing fee willingly because they convert treatments that would otherwise be declined due to cost - increasing clinic revenue is worth more than the processing cost difference.

## Goals

- A stable `PaymentProviderPort` interface with Stripe as the card-payment implementation, selectable per organisation.
- CareCredit and/or Scratchpay behind the same interface, for clinic-facing payments where the pet owner finances over time and the clinic receives payment in full upfront.
- A test and verification strategy that proves all providers behave identically from the application's point of view, and that money reconciles end to end.

## Non-goals (kept single-provider)

- The platform's own SaaS subscription billing (subscription checkout, customer portal, seat proration) stays on Stripe. This is the one place the platform is the merchant - it is selling its own software to the clinic - and it is deliberately separate from the clinic-facing flow.

## Current state

The persistence layer is already provider-aware; the orchestration layer is not.

- `enum PaymentProvider { STRIPE  MANUAL }` is referenced by `PaymentAttempt`, `Payment`, and `Refund`, each indexed on `provider`.
- `OrganizationBilling` holds account-readiness state under Stripe-shaped field names.
- `FinanceProviderLink` and `IntegrationAccount` are existing per-organisation, per-provider precedents (the latter with a service, store, and settings UI for IDEXX and Merck).
- The gateway gap: `apps/backend/src/services/stripe.service.ts` is a concrete object that builds the Stripe client directly, and finance and webhook code call it by name.
- Clinic-facing charges are currently created as destination charges on the platform account (`transfer_data.destination`), making the platform the merchant of record. This contradicts the settlement model above and is corrected by the destination-to-direct migration (#1678).

## Target architecture

1. `PaymentProviderPort`: the capability surface the rest of finance needs.
2. `StripeProviderAdapter`, `CareCreditProviderAdapter`, and `ScratchpayProviderAdapter` implementing the port. Stripe is a behaviour-preserving refactor of the existing service, on top of the direct-charge model.
3. `PaymentProviderRegistry`: resolves the adapter for an organisation from its configured active provider.
4. A normalized webhook pipeline that converts each provider's events into the existing provider-neutral `FinancePaymentService` methods, which remain the source of truth for `PaymentAttempt`, `Payment`, and `Refund` rows.
5. A currency-exponent-aware minor-unit helper in `packages/lib`, shared by backend, web, and mobile.
6. Idempotency and event de-duplication store keyed on `(provider, providerEventReference)`.

### The port (illustrative)

```ts
interface PaymentProviderPort {
  readonly provider: ProviderId; // "STRIPE" | "CARECREDIT" | "SCRATCHPAY" | "MANUAL"
  readonly capabilities: ProviderCapabilities;

  createOrGetConnectedAccount(orgId: string): Promise<{ accountRef: string }>;
  createOnboardingLink(orgId: string): Promise<{ url?: string; clientSecret?: string }>;
  getAccountStatus(orgId: string): Promise<AccountReadiness>;

  createCheckoutSession(input: NormalizedCheckoutInput): Promise<CheckoutSessionResult>;
  createPayment(input: NormalizedPaymentInput): Promise<CreatePaymentResult>;
  refund(input: NormalizedRefundInput): Promise<RefundResult>;

  verifyAndNormalizeWebhook(
    rawBody: Buffer,
    headers: Record<string, string | string[] | undefined>
  ): NormalizedPaymentEvent[];
}
```

The `capabilities` descriptor lets callers guard features a given provider does not offer. CareCredit and Scratchpay set `hostedCheckout: true` (redirect to financing application), `paymentIntent: false`, `automaticTax: false`, `asyncRefunds: true`. Stripe sets `hostedCheckout: true`, `paymentIntent: true`, `automaticTax: true`, `asyncRefunds: false`.

## Connected accounts and settlement

| Concept                      | Stripe (Standard Connect, direct charges) | CareCredit / Scratchpay (financing)       |
| ---------------------------- | ----------------------------------------- | ----------------------------------------- |
| Connected entity             | one connected account per clinic          | one merchant account per clinic           |
| Onboarding                   | embedded component (account session)      | redirect to provider's merchant signup    |
| Readiness                    | charges and payouts enabled               | merchant account approved                 |
| Where the charge is created  | clinic's account context (direct charge)  | financing provider creates the loan       |
| Merchant of record           | clinic                                    | clinic (financing provider is the lender) |
| Processing fee               | borne by the clinic                       | borne by the clinic                       |
| Platform fee                 | none                                      | none                                      |
| Platform regulatory exposure | none                                      | none                                      |
| Refund                       | settled from clinic's balance             | credit issued via financing provider API  |
| Payout                       | provider-managed to the clinic            | financing provider funds clinic directly  |

## Client plan

- Web: branch on the organisation's selected provider; generalize the redirect-URL allowlist so CareCredit and Scratchpay hosted pages are permitted; normalize return-status parsing across providers; provide a per-provider onboarding component.
- Mobile: thread the selected provider through the payment-session request; branch the provider component at the app root; wire the deep-link return path for redirect-based methods.

## Correctness requirements

| Area                         | Requirement                                                                                                                  |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Merchant of record           | Clinic-facing charges are created in the clinic's account context; the platform takes no fee and has no regulatory exposure. |
| Currency exponents           | Amounts convert to and from provider minor units using the correct per-currency exponent.                                    |
| Idempotency                  | Provider create calls carry idempotency keys; redelivered or duplicated webhook events apply at most once.                   |
| Refund settlement            | Refunds settle in the clinic's account context and never from the platform's balance.                                        |
| Partial and multiple refunds | Partial and repeated refunds are represented accurately and never exceed the captured amount in aggregate.                   |
| Race safety                  | The payment attempt is persisted before the provider call, and webhook handlers are idempotent.                              |
| Readiness gating             | Charging is blocked when an account exists but is not yet able to accept payments.                                           |
| Return URLs                  | Success and cancel return URLs are distinct, and return-status parsing is provider-aware.                                    |
| Over-refund                  | Amounts beyond the captured amount are rejected explicitly, not silently discarded.                                          |
| Failed attempts              | A failed payment records a failure code and message and reconciles the attempt state.                                        |

## Data model deltas (additive)

- Add `CARECREDIT` and `SCRATCHPAY` to `enum PaymentProvider`.
- Add `activePaymentProvider` (default `STRIPE`), a provider-neutral `onboardingState`, and `onboardingUpdatedAt` to `OrganizationBilling`; retain `canAcceptPayments` as the cross-provider readiness gate; keep existing connect-shaped columns for backward compatibility behind the neutral rollup.
- Add a processed-webhook-event table keyed on provider plus provider event reference.
- Add a per-organisation provider-config table (Prisma-only, no Mongoose mirror) carrying the active provider, the financing provider's merchant account reference, and a status flag for staged rollout.
- Add audit event and entity enum members for payment-configuration changes.
- Backfill existing rows from current columns; no external API calls.

## Phased delivery

- **Phase 0:** provider port, registry, the prerequisite hardening (idempotency and de-duplication store, currency-exponent helper, clinic-context refund settlement, distinct return URLs), and the Stripe adapter as a behaviour-preserving refactor on top of the direct-charge model. The direct-charge migration (#1678) lands first. The largest and most valuable single piece even if a second provider never ships. (Port and registry complete as of #1685; money helper complete as of #1677.)
- **Phase 1:** CareCredit adapter - redirect checkout flow on web and mobile, clinic merchant account onboarding, webhook normalization, behind a per-organisation provider-config status on one pilot clinic.
- **Phase 2:** Scratchpay adapter - same contract, parallel onboarding path, per-organisation toggle between CareCredit and Scratchpay.
- **Phase 3:** rollout, settings UI mirroring the existing Integrations page, operational dashboards, and per-organisation analytics showing treatment acceptance rate by payment method.

## Testing and verification

A payments change moves money, so the test plan is first-class.

### Contract suite (the centerpiece)

One provider-agnostic contract test suite runs against every implementation: the Stripe adapter, the CareCredit adapter, the Scratchpay adapter, and the in-memory fake. Same assertions, all targets. The fake target runs per commit (fast, deterministic); the sandbox targets run nightly.

### Layered tests

- Unit: each adapter method (request mapping, response normalization, error mapping); the minor-unit helper with a full currency-exponent matrix.
- Signature and HMAC verification: valid passes; tampered body, wrong key, and missing signature fail.
- Service and integration: full lifecycle against a real test database so Prisma writes and constraints are exercised.
- Webhook harness: de-duplication, out-of-order delivery, the create-versus-webhook race, and idempotency.
- Frontend and mobile: provider branch, redirect handling, the URL allowlist, return-status normalization, and the onboarding component.
- End-to-end: pay, refund, and onboarding against both provider sandboxes, in a nightly lane.

### CI gates

- Per commit: unit, contract (fake target), and frontend and mobile tests, under the repo coverage and Sonar new-code gates, plus type-check and lint.
- Nightly: contract against all provider sandboxes, end-to-end, and reconciliation.

## Open decisions

- CareCredit or Scratchpay first for Phase 1 (based on which has the better API and clinic demand).
- Per-organisation provider selection (assumed) versus per-checkout selection (a pet owner could choose card or financing at checkout).
- Whether to surface both Stripe and a financing option at the same checkout, letting the pet owner choose.
- Org-owner-only versus delegated finance-admin onboarding for the new payment-config permissions.
- Whether to allow switching the active provider while an organisation has outstanding unsettled payment attempts.

## Settled decisions

- No platform fee, take-rate, or split on any provider.
- The clinic is the merchant of record and bears processing fees; the platform is software and governance only with zero regulatory exposure.
- Adyen is not a viable second provider: Adyen for Platforms contracts with the platform entity as the regulatory principal, which is incompatible with the zero-regulatory-exposure constraint.
- Stripe uses Standard Connect with direct charges. The destination-to-direct migration is tracked in #1678.
- CareCredit and Scratchpay are the target financing providers: each clinic contracts directly with the provider, the platform has no lending or regulatory exposure.
