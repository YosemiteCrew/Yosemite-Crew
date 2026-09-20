import type Stripe from "stripe";

/**
 * The Stripe API version every Stripe client in this service pins to.
 *
 * This is a deliberate pin, not a stale string. Stripe's API version selects the
 * request and webhook shapes the account is billed and reconciled against, so
 * moving it changes billing behaviour - amounts, tax objects, subscription
 * status transitions and event payloads can all differ across versions. That is
 * a change that needs its own pull request, its own reconciliation testing and
 * its own review. It is not something to carry along inside a dependency bump.
 *
 * The assertion below exists because `stripe` 22.6.2 moved
 * `Stripe.LatestApiVersion` past this string. Before that bump the literal was
 * checked against the SDK's own union, so a wrong version failed to compile;
 * afterwards any string compiles. In other words the bump did not merely make
 * the pin ugly, it made the pin invisible to the type system - which is why the
 * value lives here once instead of being asserted at each call site, and why
 * `test/config/stripe-api-version-pin.test.ts` holds the literal independently
 * and scans the source for clients that do not use this constant.
 *
 * Deleting the assertion and letting the string follow the SDK is an unreviewed
 * billing API migration. Do not do it as a cleanup.
 */
export const STRIPE_PINNED_API_VERSION =
  "2026-07-29.dahlia" as Stripe.LatestApiVersion;
