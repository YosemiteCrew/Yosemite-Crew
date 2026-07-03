import React from 'react';
import { Secondary } from '@/app/ui/primitives/Buttons';
import { useSubscriptionForPrimaryOrg } from '@/app/hooks/useBilling';
import { usePermissions } from '@/app/hooks/usePermissions';
import { PERMISSIONS } from '@/app/lib/permissions';

type StripeSettingsButtonProps = {
  className?: string;
};

const StripeSettingsButton = ({ className }: StripeSettingsButtonProps) => {
  const subscription = useSubscriptionForPrimaryOrg();
  const { can } = usePermissions();
  const canManageStripe = can({
    allOf: [PERMISSIONS.ORG_EDIT, PERMISSIONS.SUBSCRIPTION_EDIT_ANY],
  });

  if (!subscription?.orgId || !canManageStripe || subscription.connectChargesEnabled) return null;

  return (
    <Secondary
      href={`/stripe-onboarding?orgId=${subscription.orgId}`}
      text="Settings"
      ariaLabel="Stripe settings"
      className={className}
    />
  );
};

export default StripeSettingsButton;
