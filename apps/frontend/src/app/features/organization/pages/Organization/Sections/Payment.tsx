import React from 'react';
import Link from 'next/link';
import { IoCardOutline } from 'react-icons/io5';
import { useSubscriptionForPrimaryOrg } from '@/app/hooks/useBilling';
import { PermissionGate } from '@/app/ui/layout/guards/PermissionGate';
import Fallback from '@/app/ui/overlays/Fallback';
import { PERMISSIONS } from '@/app/lib/permissions';
import { usePermissions } from '@/app/hooks/usePermissions';

type PaymentStatus = {
  connected: boolean;
  text: string;
};

const resolveStatus = (chargesEnabled?: boolean, payoutsEnabled?: boolean): PaymentStatus => {
  if (chargesEnabled) {
    return {
      connected: true,
      /*
       * "payouts weekly" was invented. `payoutsEnabled` mirrors Stripe's
       * `account.payouts_enabled`, a capability boolean carrying no schedule,
       * and nothing in the product reads a payout interval. The claim was wrong
       * for any clinic on Stripe's rolling daily default, or on a monthly or
       * manual schedule - and it sat beside a live status dot, so it read as
       * account state rather than copy.
       */
      text: payoutsEnabled ? 'Charges and payouts enabled' : 'Charges enabled',
    };
  }
  return { connected: false, text: 'Not connected yet' };
};

const Payment = () => {
  const subscription = useSubscriptionForPrimaryOrg();
  const { can } = usePermissions();
  const canManageStripe = can({
    allOf: [PERMISSIONS.ORG_EDIT, PERMISSIONS.SUBSCRIPTION_EDIT_ANY],
  });

  const status = resolveStatus(
    subscription?.connectChargesEnabled,
    subscription?.connectPayoutsEnabled
  );
  const orgId = subscription?.orgId;
  const showManage = canManageStripe && !!orgId;

  return (
    <PermissionGate
      allOf={[PERMISSIONS.SUBSCRIPTION_VIEW_ANY]}
      fallback={<Fallback resource="billing and subscription" />}
    >
      <div className="flex items-center gap-3 yc-card-surface px-5! py-[15px]!">
        <span className="flex size-9 flex-none items-center justify-center rounded-[11px] bg-[var(--blue-soft)] text-[var(--blue-text)]">
          <IoCardOutline size={16} aria-hidden="true" />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-[13.5px] font-bold text-[var(--ink)]">Payments · Stripe</span>
          <span className="flex items-center gap-[5px] text-[11.5px] text-[var(--ink-faint)]">
            <span
              className={`size-[6px] flex-none rounded-full ${
                status.connected ? 'bg-[var(--success)] animate-pulse' : 'bg-[var(--ink-faint2)]'
              }`}
              aria-hidden="true"
            />
            {status.text}
          </span>
        </span>
        {showManage && (
          <Link
            href={`/stripe-onboarding?orgId=${orgId}`}
            className="flex-none text-[12px] font-semibold text-[var(--blue-text)] hover:text-[var(--nav-active)] transition-colors"
          >
            {status.connected ? 'Manage' : 'Connect'}
          </Link>
        )}
      </div>
    </PermissionGate>
  );
};

export default Payment;
