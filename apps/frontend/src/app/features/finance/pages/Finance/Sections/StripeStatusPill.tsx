'use client';
import React from 'react';
import { useSubscriptionForPrimaryOrg } from '@/app/hooks/useBilling';
import { usePermissions } from '@/app/hooks/usePermissions';
import { PERMISSIONS } from '@/app/lib/permissions';

import '@/app/features/finance/pages/Finance/finance.css';

const PILL_CLASS =
  'inline-flex items-center gap-2 h-[38px] px-4 rounded-full! border border-[var(--divider)] text-[12.5px] font-semibold text-[var(--ink-body)]';

const Dot = () => (
  <span
    aria-hidden="true"
    className="yc-finance-pulse-dot size-[7px] shrink-0 rounded-full bg-[var(--success)]"
  />
);

/**
 * The design's connected-state Stripe indicator: a pill with a pulsing --success
 * dot reading "Stripe · settings". Only shown once Charges are enabled (the
 * not-connected state is handled by the page's "Connect Stripe" banner). When
 * the viewer can manage billing the pill is a link to the Stripe settings; if
 * not, it is a plain status pill.
 */
const StripeStatusPill = () => {
  const subscription = useSubscriptionForPrimaryOrg();
  const { can } = usePermissions();

  if (!subscription?.orgId || !subscription.connectChargesEnabled) return null;

  const canManageStripe = can({
    allOf: [PERMISSIONS.ORG_EDIT, PERMISSIONS.SUBSCRIPTION_EDIT_ANY],
  });

  if (!canManageStripe) {
    return (
      <span className={PILL_CLASS}>
        <Dot />
        Stripe · connected
      </span>
    );
  }

  return (
    <a
      href={`/stripe-onboarding?orgId=${subscription.orgId}`}
      aria-label="Stripe settings"
      className={`${PILL_CLASS} transition-colors hover:bg-[var(--inset)]`}
    >
      <Dot />
      Stripe · settings
    </a>
  );
};

export default StripeStatusPill;
