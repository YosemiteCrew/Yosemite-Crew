# Developer Portal - Marketplace Monetization (Paid Template Packs / Plugin Rev-Share)

## Document Status

- Owner: Developer portal workstream (epic #1582)
- Scope: Decision framing only. Touches, when implemented: `packages/database` (reserved fields on registry models), `apps/backend` (billing flows), `apps/frontend` (pricing UI in registry and publisher portal)
- Depends on: [plugin registry plan](./developer-portal-plugin-registry.md) (the thing being monetized; its open question 1 is this document), [ADR 0002](../adr/0002-stripe-direct-charges-merchant-of-record.md) (the payments posture this collides with)
- Status: Proposed - **explicitly gated on a maintainer decision (section 6); nothing here is scheduled for implementation**

---

## 1. Posture: free-first launch

The registry launches with every plugin free, as the [plugin registry plan](./developer-portal-plugin-registry.md) states. This document exists so that decision is a posture, not an accident: it names what gets reserved now (section 4), the money-flow problem that must be decided before anything is charged (sections 2-3), and the split options (section 5). It is deliberately short and decision-focused.

## 2. Why ADR 0002 does not answer this

[ADR 0002](../adr/0002-stripe-direct-charges-merchant-of-record.md) settled clinic payments: Stripe Standard Connect, direct charges on the clinic's own account, clinic is merchant of record, platform takes no fee and never holds funds. That decision was possible because the money flow is two-party: pet owner pays clinic.

A paid plugin is a **different money flow with three parties**: a clinic pays for a developer's plugin, and the developer must be paid their share. Someone has to collect the clinic's payment, split it, remit the developer's cut, and handle tax, refunds, and disputes for a digital-goods sale. Whoever does that is a payments intermediary - exactly the role ADR 0002 was written to avoid for clinical payments. The clinic-is-MoR principle does not transfer: the clinic is the _buyer_ here, not the merchant. Developer payouts therefore need their own decision, made consciously, not inherited.

## 3. The payout-rails decision that must be made

Three realistic options, none of which preserve the "platform never touches money" property while also giving buyers a decent experience:

| Option                                                                         | Money flow                                                                                                                                                  | Platform obligations                                                                                         | Trade-off                                                                                                                                                                |
| ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **A. Platform as marketplace merchant** (Stripe Connect payouts to developers) | Clinic pays the platform account; platform pays developers via Connect **Express** (or Custom) accounts using transfers/payouts                             | MoR for plugin sales: VAT/sales-tax collection (Stripe Tax), refunds, chargebacks, payout KYC for developers | Standard app-store model, best buyer UX; but the platform becomes a payments intermediary and takes on tax nexus                                                         |
| **B. Developer as merchant** (mirror of ADR 0002)                              | Each developer connects their own Stripe Standard account; clinic pays the developer directly; platform invoices the developer for its rev-share separately | None on the money path; rev-share collection becomes accounts-receivable against developers                  | Preserves no-custody purity; buyer UX fragments across N merchants, small developers face full Stripe/tax burden themselves, rev-share is enforceable only contractually |
| **C. Third-party merchant of record** (Paddle / Lemon Squeezy style)           | MoR vendor sells the plugin, handles all tax/refunds, remits to platform and/or developer                                                                   | Contract management; least engineering                                                                       | Highest fees, least control, and a second PSP relationship alongside Stripe                                                                                              |

If the maintainers accept becoming an intermediary for this flow (option A), the concrete sub-decisions are:

- **Express vs Custom Connect accounts for developers.** Express recommended: Stripe-hosted onboarding and dashboards, Stripe carries most of the KYC/identity burden, minimal platform liability surface. Custom buys white-label polish the developer audience does not need at the cost of the platform owning onboarding UX and compliance updates.
- **Charge topology.** Destination charges with an `application_fee_amount` vs separate charges and transfers. Separate charges recommended: they cleanly decouple the clinic's purchase from the developer's payout schedule, allow holding a payout window for fraud review, and simplify refunds (refund the charge, reverse the transfer independently).
- **Tax.** Stripe Tax with the platform as seller of record for plugin sales; registration thresholds monitored per market before enabling paid listings in that market.
- **Refunds and chargebacks.** Platform refunds the buyer and reverses/claws back the developer's share from the next payout; disputes on plugin charges land on the platform account and are the platform's to fight, priced into the platform share (section 5).

Two flows explicitly not changed by any option here:

- **Developer-tier subscriptions** (free/pro/enterprise API billing from PR #1696) are platform revenue on the platform's own Stripe account - no payout leg, unaffected.
- **Clinic clinical payments** stay exactly as ADR 0002 decided, on the clinic's own Standard account, regardless of what happens to plugin money.

## 4. Reserved fields on registry models

Reserved now, shipped nullable and inert in registry v1, so charging later needs no backfill migration and free-era rows are unambiguous (`pricingModel: free`):

**Plugin** (extends the [plugin registry plan](./developer-portal-plugin-registry.md) section 8 model)

- pricingModel (free | one_time | subscription; default free)
- priceAmount (integer, minor units, nullable), priceCurrency (nullable)
- revShareBps (nullable; platform default applies when null, per-plugin override for negotiated deals)

**PluginInstall**

- billingStatus (nullable: none | trialing | active | past_due | canceled)
- billingRef (nullable, opaque reference to the PSP-side subscription/charge; no PSP internals beyond an id)

**DeveloperPayoutAccount** (new model, only if option A is chosen; listed so the shape is on record)

- id, developerOrganisationId, provider (stripe), providerAccountRef, onboardingStatus (pending | complete | blocked), payoutsEnabled (boolean), createdAt, updatedAt

The registry UI shows nothing for these fields while `pricingModel` is `free`. No price is displayed, collected, or promised anywhere until section 6 resolves.

## 5. Rev-share split options

To be decided together with the rails, not before:

- **85/15** (developer/platform) - recommended starting point: competitive with modern app stores, and at plausible plugin prices the 15% roughly covers PSP fees plus review/hosting cost without looking extractive.
- **80/20** - defensible if review overhead proves heavy (every version passes human review per the registry plan).
- **70/30** - legacy app-store rate; not recommended, hostile signal to the small developer ecosystem this platform is trying to grow.
- Plus a per-transaction floor (e.g. minimum fee in minor units) so micro-priced items do not transact below PSP cost, and `revShareBps` on `Plugin` allows negotiated exceptions either direction.

Free plugins pay nothing and are never charged a listing fee in any option under consideration.

## 5a. What free-first still requires now

Three cheap things keep the paid door open without building any of it:

- **Publisher terms.** The developer agreement accepted at first publish must already reserve the right to introduce paid listings and a rev-share, so existing publishers are not re-papered later. One clause, written once.
- **Install analytics accuracy.** The registry plan's open question about billing-grade install counts resolves to: not needed yet. `PluginInstall` rows are the eventual billing anchor either way; per-install event history can be reconstructed from them when charging starts.
- **The reserved columns** (section 4), shipped with the registry models on day one.

## 6. The gate

**Implementation of any paid-marketplace capability is gated on an explicit maintainer decision to become a payments intermediary for developer payouts (or to deliberately choose option B or C instead).** That decision:

- contradicts nothing in [ADR 0002](../adr/0002-stripe-direct-charges-merchant-of-record.md) - clinic clinical payments keep the clinic as merchant of record regardless - but it does end the blanket claim "the platform never holds or moves funds", so it must be recorded as its own ADR when made;
- carries regulatory homework that must be done before, not after: money-transmission exposure of holding developer funds between charge and payout, VAT/sales-tax registration thresholds in target markets, and payout KYC;
- has a sequencing dependency worth naming: option A rides on the `PaymentProviderPort` abstraction ADR 0002 mentions (branch `feat/payment-provider-port`, unmerged) staying provider-agnostic - a payout leg is a second Stripe surface, and hard-wiring it outside the port would repeat the coupling that port exists to remove;
- is not urgent. Free-first is the launch posture, and section 4's reservations mean deferring costs one nullable-fields migration now and zero rework later.

Until that ADR exists, the only work this document authorizes is adding the reserved nullable fields alongside the registry models when they are first created.

## 7. Open questions for the reviewer

1. Confirm free-first with reserved fields (section 4) as the registry v1 posture, so the registry PR can include the columns.
2. When monetization is picked up: does pricing gate at install time only, or do subscription plugins stop materialising updates on lapse (`billingStatus: past_due`)? Installed drafts are the clinic's data either way - clawing back config on non-payment is not on the table.
3. Are paid **template packs** (one-time purchases of the registry's form/template contributions) the deliberate first paid product - simpler than subscriptions: one charge, one payout, no dunning?
4. Who owns the tax/money-transmission legal review, and does it happen before or after the rails ADR is drafted?
