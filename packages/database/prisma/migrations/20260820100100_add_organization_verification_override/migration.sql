-- Manual verification override. NULL means "derive isVerified automatically"
-- (Stripe Connect status + compliance certificate); a non-NULL value is a
-- deliberate force set by the verification authority and wins over the
-- computed value.
ALTER TABLE "Organization" ADD COLUMN "verificationOverride" BOOLEAN;
