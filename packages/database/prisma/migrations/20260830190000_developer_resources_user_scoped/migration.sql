-- Developer API keys, subscriptions and usage belong to the DEVELOPER, not to a
-- practice.
--
-- These three tables were keyed on organisationId, while the portal's own
-- audience - someone who signs up through the developer door - never gets an
-- organisation at all: provisioning grants the `developer` role and nothing
-- else, and there is no developer entry in the RBAC role model. Every
-- key/billing/usage request from such an account therefore failed on the
-- org-scoped middleware. See issue #2551.
--
-- A rename, not an additive change. It is cheap only because the tables are
-- empty, which was re-confirmed against both projects immediately before this
-- was written: production 0/0/0, dev 0/1/0 with the single subscription row
-- holding no live Stripe subscription.

-- createdBy is NOT NULL and carries the SuperTokens user id on every row, so the
-- backfill is exact rather than inferred.
ALTER TABLE "DeveloperApiKeys" RENAME COLUMN "organisationId" TO "ownerUserId";
UPDATE "DeveloperApiKeys" SET "ownerUserId" = "createdBy";
ALTER INDEX "DeveloperApiKeys_organisationId_idx"
  RENAME TO "DeveloperApiKeys_ownerUserId_idx";

-- An org-keyed subscription carries no user handle, so it cannot be re-pointed
-- mechanically; inferring the org owner would move a Stripe billing identity by
-- guess. A row that never completed checkout holds at most an orphaned Stripe
-- customer and is safe to drop. A row WITH a live subscription must never be
-- deleted by a migration - abort the deploy instead and re-key it by hand.
DELETE FROM "DeveloperSubscriptions" WHERE "stripeSubscriptionId" IS NULL;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "DeveloperSubscriptions") THEN
    RAISE EXCEPTION
      'DeveloperSubscriptions holds row(s) with a live Stripe subscription. Re-key them by hand before deploying 20260830190000_developer_resources_user_scoped.';
  END IF;
END $$;
ALTER TABLE "DeveloperSubscriptions" RENAME COLUMN "organisationId" TO "ownerUserId";
ALTER INDEX "DeveloperSubscriptions_organisationId_key"
  RENAME TO "DeveloperSubscriptions_ownerUserId_key";

-- A per-org monthly counter has no meaning under a per-developer key, and a
-- stale row would be counted against a quota it never belonged to. No external
-- state: counters regenerate on the next call.
DELETE FROM "DeveloperApiUsage";
ALTER TABLE "DeveloperApiUsage" RENAME COLUMN "organisationId" TO "ownerUserId";
ALTER INDEX "DeveloperApiUsage_organisationId_billingPeriod_key"
  RENAME TO "DeveloperApiUsage_ownerUserId_billingPeriod_key";
