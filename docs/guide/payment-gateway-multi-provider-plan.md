# Payment Gateway Abstraction and Multi-Provider Support (Stripe + Adyen)

Status: proposal (design and test plan)
Related issue: #1659
Scope: `apps/backend`, `apps/frontend`, `apps/mobileAppYC`, `packages/database`, `packages/lib`

This document is the detailed design and verification plan behind issue #1659. It describes how to introduce a provider-agnostic payment-gateway abstraction, add Adyen as a second processor selected per organisation, and do so with a test and rollout plan strong enough to enable real money movement with confidence. It contains no credentials or secret values; configuration is referenced by purpose only.

## Settlement model (the core principle)

The platform takes no fee and is never the financial principal. For every customer payment the clinic is the merchant of record: the clinic appears on the payer's statement, the clinic bears the provider processing fee, and the clinic owns refunds and chargebacks. The platform's role is orchestration and governance only. It creates and records payments on the clinic's behalf and keeps full visibility, but it never sits in the settlement path as principal.

- Stripe: Standard Connect accounts with direct charges. The charge is created in the clinic's account context, so the processing fee, the statement descriptor, and dispute liability all sit with the clinic, and negative-balance liability stays with the clinic and Stripe rather than the platform. The platform takes no application fee.
- Adyen: the clinic is the sub-merchant and merchant of record, settling to the clinic's balance account and bearing fees and chargebacks. The platform takes no split.

There is no platform fee, take-rate, or split on either provider. This supersedes any earlier framing of destination transfers and platform fees. The current Stripe flow uses destination charges, which makes the platform the merchant of record; migrating it to direct charges is a prerequisite for the Stripe adapter to match this model and is tracked in its own issue.

## Goals

- A stable `PaymentProvider` interface with Stripe as one concrete implementation, selectable per organisation.
- A second processor (Adyen) behind the same interface, for clinic-facing payments where the clinic is the merchant of record.
- A test and verification strategy that proves both providers behave identically from the application's point of view, and that money reconciles end to end.

## Non-goals (kept single-provider)

- The platform's own SaaS subscription billing (subscription checkout, customer portal, seat proration) stays on Stripe. The second provider does not offer an equivalent subscription-billing product, and this billing path is already cleanly isolated (it writes only `FinanceProviderLink` and `SubscriptionEntitlement`, charges the platform account, and is already gated to a single provider). A clinic can use the second provider for customer payments while its own subscription stays on Stripe, with no data-model conflict, because the provider is stored per row, not per organisation. This is the one place the platform is the merchant (it is selling its own software to the clinic), and it is deliberately separate from the clinic-facing flow.

## Current state

The persistence layer is already provider-aware; the orchestration layer is not.

- `enum PaymentProvider { STRIPE  MANUAL }` is referenced by `PaymentAttempt`, `Payment`, and `Refund`, each indexed on `provider`.
- `OrganizationBilling` (mapped to `OrgBilling`) holds account-readiness state under Stripe-shaped field names.
- `FinanceProviderLink` and `IntegrationAccount` are existing per-organisation, per-provider precedents (the latter with a service, store, and settings UI for IDEXX and Merck).
- The gateway gap: `apps/backend/src/services/stripe.service.ts` is a concrete object that builds the Stripe client directly, and finance and webhook code call it by name. `apps/backend/src/services/finance/payment.ts` does provider-neutral database work but is invoked from inside Stripe-specific webhook handlers, so there is no seam to route a different provider through it.
- Clinic-facing charges are currently created as destination charges on the platform account (`transfer_data.destination`), which makes the platform the merchant of record. This contradicts the settlement model above and is corrected by the destination-to-direct migration (its own issue).
- The web client and mobile client are hosted-redirect: the backend returns a URL and the client navigates to it. There is no client-side card collection to replace. The only embedded provider SDK on the web is the connected-account onboarding component.

## Target architecture

1. `PaymentProviderPort`: the capability surface the rest of finance needs.
2. `StripeProviderAdapter` and `AdyenProviderAdapter` implementing the port. Stripe is a behaviour-preserving refactor of the existing service, on top of the direct-charge model.
3. `PaymentProviderRegistry`: resolves the adapter for an organisation from its configured active provider.
4. A normalized webhook pipeline that converts each provider's events into the existing provider-neutral `FinancePaymentService` methods, which remain the source of truth for `PaymentAttempt`, `Payment`, and `Refund` rows.
5. A currency-exponent-aware minor-unit helper in `packages/lib`, shared by backend, web, and mobile.
6. Asynchronous webhook intake: accept and acknowledge batched notifications quickly, then process off-thread, with an idempotency and event de-duplication store.

### The port (illustrative)

```ts
interface PaymentProviderPort {
  readonly provider: PaymentProvider;
  readonly capabilities: ProviderCapabilities; // hosted checkout, direct charges, automatic tax, hosted receipts

  // onboarding / account lifecycle
  createOrGetConnectedAccount(orgId: string): Promise<{ accountRef: string }>;
  createOnboardingLink(orgId: string): Promise<{ url?: string; clientSecret?: string }>;
  getAccountStatus(orgId: string): Promise<AccountReadiness>;

  // payment lifecycle (charge created in the clinic's account context; gateway owns minor-unit and idempotency-key handling)
  createCheckoutSession(
    input: NormalizedCheckoutInput
  ): Promise<{ providerRef: string; redirectUrl?: string; clientToken?: string }>;
  createPayment(
    input: NormalizedPaymentInput
  ): Promise<{ providerPaymentRef: string; clientSecret?: string; status: PaymentAttemptStatus }>;
  refund(input: NormalizedRefundInput): Promise<{ refundRef: string; status: RefundStatus }>;

  // webhooks (normalize into existing FinancePaymentService inputs)
  verifyAndNormalizeWebhook(
    rawBody: Buffer,
    headers: Record<string, string>
  ): NormalizedPaymentEvent[];
}
```

The existing `FinancePaymentService` webhook-facing methods already take plain provider-neutral inputs (invoice reference, amount in major units, currency), so they are the natural normalization sink. Adapters translate provider-specific shapes (payment intent, charge, session id, or psp reference) into these inputs.

## Asynchronous-provider implications

The second provider differs from Stripe in ways that shape the design:

- It sends batched webhook notifications and expects a fast, fixed acknowledgement, then asynchronous processing.
- Refund, capture, and payout outcomes are confirmed only by webhook, not in the API response.
- Webhook authenticity is verified per merchant account, not against a single global secret.
- Amounts are always in minor units with a per-currency exponent.

Consequences carried into the plan: asynchronous refund and capture lifecycle, an idempotency and event de-duplication store, off-thread webhook processing (the existing queue and worker directories are the home), per-merchant verification key resolution, and a currency-exponent-aware money helper.

## Connected accounts and settlement

The clinic is the merchant of record on both providers, and the platform takes no fee on either. The current single connected-account model maps as follows:

| Concept                     | Stripe (Standard Connect, direct charges)       | Adyen (clinic as sub-merchant)                   |
| --------------------------- | ----------------------------------------------- | ------------------------------------------------ |
| Connected entity            | one connected account per clinic                | account holder plus one or more balance accounts |
| Onboarding                  | embedded component                              | hosted onboarding link                           |
| Readiness and capabilities  | charges and payouts enabled, requirements       | capabilities and verification deadlines          |
| Where the charge is created | in the clinic's account context (direct charge) | against the clinic as sub-merchant               |
| Merchant of record          | clinic                                          | clinic                                           |
| Processing fee              | borne by the clinic                             | borne by the clinic                              |
| Platform fee                | none                                            | none                                             |
| Refund and chargeback       | settled from the clinic's balance               | settled from the clinic's balance                |
| Negative-balance liability  | clinic and Stripe (Standard)                    | clinic                                           |
| Payout                      | provider-managed to the clinic                  | provider-managed to the clinic's balance account |

Because Adyen uses balance accounts, the stored single-account scalar may become a one-to-many relation on that provider. The clinic is the tax merchant of record on both providers, which matches the existing tax configuration (the invoice issuer and tax-liability account are already the clinic).

## Client plan

- Web: branch on the organisation's selected provider; generalize the redirect-URL allowlist so the second provider's hosted pages are permitted; normalize return-status parsing across providers; provide a per-provider onboarding component. The current hosted-redirect model means most flows need only provider plumbing and allowlist changes, not embedded card UI.
- Mobile: thread the selected provider through the payment-session request; branch the provider component at the app root; wire the deep-link return path for redirect-based methods (the current app handles its own redirect interception, so this must be made explicit for a second provider).
- Embedded drop-in (cards rendered in-app) on either client is an optional later enhancement, not required for the redirect-first launch.

## Correctness requirements

The implementation must satisfy the following. Each is a named test in the test plan.

| Area                         | Requirement                                                                                                                                                                        |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Merchant of record           | Clinic-facing charges are created in the clinic's account context so the clinic is the merchant of record, bears the processing fee, and owns disputes; the platform takes no fee. |
| Currency exponents           | Amounts convert to and from provider minor units using the correct per-currency exponent (zero-, two-, and three-decimal currencies).                                              |
| Idempotency                  | Provider create calls carry idempotency keys; redelivered or duplicated webhook events apply at most once.                                                                         |
| Async refund and capture     | Refund and capture move through a pending state and are finalized to succeeded or failed by webhook.                                                                               |
| Refund settlement            | Refunds and chargebacks are issued in the clinic's account context and settle from the clinic's balance, never the platform's.                                                     |
| Partial and multiple refunds | Partial and repeated refunds are represented accurately and never exceed the captured amount in aggregate.                                                                         |
| Race safety                  | The payment attempt is persisted before the provider call, and webhook handlers are idempotent, so an early webhook cannot mis-handle a not-yet-persisted attempt.                 |
| Readiness gating             | Charging is blocked when an account exists but is not yet able to accept payments.                                                                                                 |
| Return URLs                  | Success and cancel return URLs are distinct, and return-status parsing is provider-aware.                                                                                          |
| Over-payment and over-refund | Amounts beyond the outstanding balance or captured amount are handled explicitly, not silently discarded.                                                                          |
| Failed attempts              | A failed payment records a failure code and message and reconciles the attempt state.                                                                                              |
| Multiple accounts            | The data model supports a one-to-many account model where a provider requires it.                                                                                                  |
| Tax                          | The clinic is the tax merchant of record; for a provider without a tax engine, invoice tax is finalized before payment.                                                            |

## Data model deltas (additive)

- Add `ADYEN` to `enum PaymentProvider`.
- Add `activePaymentProvider` (default `STRIPE`), a provider-neutral `onboardingState`, and `onboardingUpdatedAt` to `OrganizationBilling`; retain `canAcceptPayments` as the cross-provider readiness gate; keep existing connect-shaped columns for backward compatibility behind the neutral rollup.
- Add a processed-webhook-event table keyed on provider plus provider event reference.
- Add a per-organisation provider-config table (Prisma-only, no Mongoose mirror, per repo convention) carrying the active provider, the second provider's account references, credentials reference, and an enabled or status flag for staged rollout.
- Add audit event and entity enum members for payment-configuration changes.
- Backfill existing rows from current columns; no external API calls.

## Phased delivery

- Phase 0: provider port, registry, the prerequisite hardening (idempotency and de-duplication store, currency-exponent helper, asynchronous refund and capture lifecycle, race-safe reconciliation, clinic-context refund settlement, distinct return URLs), and the Stripe adapter as a behaviour-preserving refactor on top of the direct-charge model. The direct-charge migration is its own issue and lands first. The largest and most valuable single piece even if the second provider never ships.
- Phase 1: second-provider payments (no payouts) in a sandbox merchant account, redirect client flow on web and mobile, behind a global enable flag and a per-organisation provider-config status, on one pilot organisation.
- Phase 2: second-provider connected accounts (onboarding, sub-merchant settlement, payout reconciliation).
- Phase 3: rollout, settings UI mirroring the existing Integrations page, per-organisation toggle, and operational dashboards.

## Testing and verification

A payments change moves money, so the test plan is first-class.

### Contract suite (the centerpiece)

One provider-agnostic contract test suite is run against every implementation: the Stripe adapter, the Adyen adapter, and an in-memory fake. Same assertions, three targets. The fake target runs per commit (fast, deterministic); the sandbox targets run nightly against test environments. This is what guarantees the two providers are interchangeable from the application's point of view.

### Layered tests

- Unit: each adapter method (request mapping, response normalization, error mapping); the minor-unit helper as property and table tests across the full currency-exponent matrix with golden cases for zero- and three-decimal currencies; webhook normalizers over recorded sandbox payloads.
- Signature and HMAC verification: valid passes; tampered body, wrong key, and missing signature fail; per-merchant key resolution is correct.
- Service and integration: full lifecycle against a real test database so Prisma writes and constraints are exercised (create, webhook success, invoice paid, refund pending then succeeded or failed), including the database uniqueness guards under concurrent duplicate webhooks.
- Webhook harness: de-duplication, out-of-order delivery, the create-versus-webhook race, batched notifications, fast acknowledgement even when business processing fails (with dead-lettering rather than an error response), and the off-thread handoff.
- Frontend and mobile: provider branch, redirect handling, the URL allowlist, return-status normalization, the onboarding component, and cancel-versus-error mapping on mobile.
- End-to-end (new): pay, refund, and onboarding against both sandboxes, in a nightly lane.
- Sandbox test-instrument matrix: success, insufficient funds, refused, expired, 3DS frictionless and challenge, refused-after-3DS, manual or pending capture, partial capture, partial and multiple refunds, refund failed, and charging blocked when onboarding is incomplete; plus merchant-of-record cases (the clinic is the settlement merchant, refund and chargeback settle from the clinic balance, payout lands in the clinic account).
- Concurrency and load: a webhook storm of duplicate and out-of-order deliveries must produce exactly-once effects; idempotency-key contention produces one provider object.
- Financial reconciliation: for a day of sandbox activity, captures minus refunds equals clinic payouts net of provider processing fees, per provider (the platform takes no fee); every capture maps to exactly one invoice transition; currency integrity holds.

### Edge-case traceability

Every correctness requirement above maps to a named test, so completeness is enforceable in CI rather than asserted.

### CI gates

- Per commit: unit, contract (fake target), and frontend and mobile tests, under the repo coverage and Sonar new-code gates, plus type-check and lint and the full backend suite.
- Nightly: contract against both sandboxes, end-to-end, the test-instrument matrix, load, and reconciliation.
- A payments code-owner and required-review rule so no payment change merges without the contract suite green.

### Pre-production verification

1. Shadow mode: run the second provider in parallel on a staging organisation with test instruments for at least one week; reconcile daily; require zero discrepancies.
2. Canary: one pilot organisation in production behind the enable flag and per-organisation provider-config status, with a low daily volume cap.
3. A production reconciliation job per provider with alerting on any drift.

### Observability, alerting, rollback

- Metrics per provider: authorization success rate, 3DS abandonment, webhook latency and lag, de-duplication drops, refund-pending age, reconciliation drift, payout success.
- Alerts: webhook processing failures, signature failures, refunds stuck pending beyond a threshold, reconciliation mismatch, and settlement-currency mismatch.
- Runbooks: webhook backlog, refund stuck, onboarding stuck on verification, switch an organisation's provider, and disable the second provider globally.
- Rollback: per-organisation flip back to Stripe is a configuration change; the global kill-switch is a tested path.

### Sign-off checklist (gate for enabling real money)

- [ ] Contract suite green on both sandboxes with identical assertions.
- [ ] Every correctness-requirement test green, including merchant-of-record (clinic is the seller on both providers, platform takes no fee).
- [ ] Minor-unit property tests green across zero-, two-, and three-decimal currencies.
- [ ] Webhook harness green for de-duplication, out-of-order, race, batching, fast acknowledgement, and async refund.
- [ ] Sandbox test-instrument matrix green including 3DS, refused, partial and multiple refunds, clinic-context refund settlement, and readiness-blocked.
- [ ] End-to-end pay, refund, and onboarding green on both providers.
- [ ] Reconciliation drift zero for a sandbox day per provider.
- [ ] Shadow-mode week on staging with zero discrepancies.
- [ ] Migration up and down, backfill, and a Stripe-unchanged regression green.
- [ ] Load test produces exactly-once effects.
- [ ] Per-organisation and global rollback tested.
- [ ] Frontend and mobile coverage at or above the repo target, Sonar gate green, full backend suite green.

## Open decisions

- Minimum capability set a second adapter must satisfy to be registerable.
- Redirect (hosted) versus embedded drop-in for the second provider on web and mobile.
- Per-organisation provider selection (assumed) versus per-checkout selection.
- Whether the asynchronous refund lifecycle is acceptable as the new behaviour for all providers.
- One sub-merchant per organisation versus a balance-account one-to-many model on Adyen.
- Org-owner-only versus delegated finance-admin onboarding for the new payment-config permissions.
- Whether to allow switching the active provider while an organisation has outstanding unsettled payment attempts.

## Settled decisions

- No platform fee, take-rate, or split on either provider.
- The clinic is the merchant of record and bears processing fees and chargebacks; the platform is software and governance only.
- Stripe uses Standard Connect with direct charges; Adyen uses the clinic as sub-merchant. The Stripe destination-to-direct migration is tracked in its own issue.
