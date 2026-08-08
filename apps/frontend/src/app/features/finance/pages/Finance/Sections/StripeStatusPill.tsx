'use client';
import React from 'react';
import { useSubscriptionForPrimaryOrg } from '@/app/hooks/useBilling';
import { usePermissions } from '@/app/hooks/usePermissions';
import { PERMISSIONS } from '@/app/lib/permissions';
import StatusPill from '@/app/ui/primitives/StatusPill/StatusPill';

/**
 * Connected-state Stripe indicator. Only shown once charges are enabled (the
 * not-connected state is handled by the page's "Connect Stripe" banner).
 */
const StripeStatusPill = () => {
  const subscription = useSubscriptionForPrimaryOrg();
  const { can } = usePermissions();

  if (!subscription?.orgId || !subscription.connectChargesEnabled) return null;

  const canManageStripe = can({
    allOf: [PERMISSIONS.ORG_EDIT, PERMISSIONS.SUBSCRIPTION_EDIT_ANY],
  });

  if (!canManageStripe) {
    return <StatusPill tone="success" label="Stripe · connected" showDot />;
  }

  return (
    <a
      href={`/stripe-onboarding?orgId=${subscription.orgId}`}
      aria-label="Stripe settings"
      className="inline-flex min-h-[38px] items-center rounded-full px-2 transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-brand"
    >
      <StatusPill tone="success" label="Stripe · settings" showDot />
    </a>
  );
};

export default StripeStatusPill;
