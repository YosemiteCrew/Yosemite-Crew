# 0002. Stripe Standard Connect with direct charges; clinic as merchant of record

**Status:** Accepted
**Date:** 2026-06-25

## Context

Yosemite Crew processes payments on behalf of independent veterinary clinics. The platform's stated model is "software and governance only" — it is not a payment facilitator and does not want to sit between the clinic and its money as a regulated intermediary. This ruled out any charge model where the platform account is the initial recipient of funds (destination charges) or where the platform takes on payment-facilitator obligations.

The team also explored Adyen for Platforms as a second payment provider alongside Stripe. Adyen for Platforms requires the platform to act as the regulatory principal for its sub-merchants — this directly conflicted with the "clinic is merchant of record, platform has no financial custody" principle, so Adyen was dropped rather than integrated.

## Decision

- Use Stripe **Standard Connect accounts** per clinic, with **direct charges**: the payment intent/checkout session is created *on the clinic's connected account* (`stripeAccount: organisation.stripeAccountId`), not on the platform account. The clinic is the merchant of record; it bears processing fees, disputes, and refund liability directly with Stripe. The platform takes **no platform fee / application fee**.
- Drop Adyen. For clinics that need financing/point-of-care lending rather than a second card processor, integrate **CareCredit** and **Scratchpay** instead — both are financing partners with a direct clinic-to-provider relationship, so they don't require the platform to become a regulatory principal.
- Introduce a `PaymentProviderPort` abstraction (in progress, branch `feat/payment-provider-port`, not yet merged to `dev`) so Stripe is one implementation behind a provider-agnostic interface rather than hard-wired throughout the backend, ahead of adding CareCredit/Scratchpay.

## Consequences

**Good:**
- The platform never holds or moves clinic funds, keeping it out of payment-facilitator/money-transmitter regulatory scope.
- Clinics keep their own Stripe dashboard, their own dispute/refund relationship with Stripe, and portable payment history if they ever leave the platform.
- No platform take-rate to justify, explain, or reconcile.

**Bad / accepted trade-offs:**
- Every clinic must complete Stripe Connect onboarding (KYC) before accepting payments — there is no "instant" platform-mediated path.
- The platform has less visibility/control over the payment flow than it would with destination charges (e.g. it cannot unilaterally hold or redirect funds).
- The `PaymentProviderPort` abstraction is not yet merged; until it lands, Stripe-specific code exists directly in backend services rather than behind the port.

## Alternatives considered

- **Stripe destination charges** (platform account receives funds, then transfers to clinic): rejected — makes the platform the initial recipient and increases regulatory/liability exposure; migrated away from this model as of the June 2026 payment refactor.
- **Adyen for Platforms as a second PSP**: rejected — makes the platform the regulatory principal for sub-merchants, conflicting with the merchant-of-record-is-the-clinic principle. Superseded by CareCredit/Scratchpay for the financing use case Adyen would have partly served.
