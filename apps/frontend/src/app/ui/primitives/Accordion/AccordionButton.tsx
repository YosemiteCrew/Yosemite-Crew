import React, { useEffect, useState } from 'react';
import { IoIosArrowDown, IoIosWarning } from 'react-icons/io';
import { Secondary } from '@/app/ui/primitives/Buttons';
import { getStripeBillingPortal } from '@/app/features/billing/services/billingService';
import { getSafeStripeRedirectUrl } from '@/app/lib/urls';
import { useSubscriptionForPrimaryOrg } from '@/app/hooks/useBilling';
import { usePermissions } from '@/app/hooks/usePermissions';
import { PERMISSIONS } from '@/app/lib/permissions';
import Upgrade from '@/app/ui/widgets/Upgrade';

interface AccordionButtonProps {
  title: string;
  children?: React.ReactNode;
  defaultOpen?: boolean;
  buttonTitle?: string;
  buttonClick?: any;
  showButton?: boolean;
  finance?: boolean;
  keepMounted?: boolean;
  actions?: React.ReactNode;
}

type PaddingArgs = {
  finance: boolean;
  hasFinanceAction: boolean;
  hasCustomerId: boolean;
  plan?: string;
  showButton: boolean;
};

const getAccordionPaddingYClass = ({
  finance,
  hasFinanceAction,
  hasCustomerId,
  plan,
  showButton,
}: PaddingArgs): string => {
  if (showButton || hasFinanceAction) {
    return 'py-2';
  }

  if (finance) {
    // Keep finance accordions visually aligned with other sections.
    if (plan === 'free' || (plan === 'business' && hasCustomerId)) {
      return 'py-[20px]';
    }
  }
  return 'py-[20px]';
};

const AccordionButton: React.FC<AccordionButtonProps> = ({
  title,
  children,
  defaultOpen = false,
  buttonTitle,
  buttonClick,
  showButton = true,
  finance = false,
  keepMounted = false,
  actions,
}) => {
  const subscription = useSubscriptionForPrimaryOrg();
  const { can } = usePermissions();
  const canEditSubscription = can(PERMISSIONS.SUBSCRIPTION_EDIT_ANY);
  const plan = subscription?.plan;
  const hasCustomerId = Boolean(subscription?.stripeCustomerId);
  const hasFinanceAction = canEditSubscription && finance && (hasCustomerId || plan === 'free');
  const [open, setOpen] = useState(defaultOpen);
  const [loadingPortal, setLoadingPortal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const paddingYClass = getAccordionPaddingYClass({
    finance,
    hasFinanceAction,
    hasCustomerId,
    plan,
    showButton,
  });

  const handleBillingPortal = async () => {
    setError(null);
    setLoadingPortal(true);
    try {
      const url = await getStripeBillingPortal();
      const safeUrl = getSafeStripeRedirectUrl(url);
      if (!safeUrl) {
        throw new Error('Received an unexpected billing portal URL.');
      }
      globalThis.open(safeUrl, '_blank', 'noopener,noreferrer');
    } catch (e: any) {
      setError(e?.message || 'Failed to open billing portal');
    } finally {
      setLoadingPortal(false);
    }
  };

  useEffect(() => {
    if (!error) return;
    const t = globalThis.setTimeout(() => {
      setError(null);
    }, 5000);
    return () => globalThis.clearTimeout(t);
  }, [error]);

  return (
    <div
      className={`flex flex-col gap-3 rounded-2xl border border-card-border px-6 ${paddingYClass}`}
    >
      <div className="flex items-center gap-x-4 gap-y-2">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-2 text-left cursor-pointer"
          onClick={() => setOpen(!open)}
          aria-label={title}
          aria-expanded={open}
        >
          <IoIosArrowDown
            size={22}
            color="var(--color-neutral-900)"
            className={`text-black-text transition-transform shrink-0 ${open ? 'rotate-0' : '-rotate-90'}`}
          />
          <span className="text-heading-3 text-text-primary">{title}</span>
        </button>
        <div className="flex shrink-0 items-center gap-3 flex-wrap">
          {error && (
            <div className="flex items-center gap-1 px-4 text-caption-2 text-text-error">
              <IoIosWarning className="text-text-error" size={14} />
              <span>{error}</span>
            </div>
          )}
          {showButton && buttonTitle && (
            <Secondary href="#" onClick={() => buttonClick(true)} text={buttonTitle} />
          )}
          {actions}
          {canEditSubscription && finance && (
            <div className="flex items-center gap-3 flex-wrap">
              {hasCustomerId && (
                <Secondary
                  href="#"
                  onClick={handleBillingPortal}
                  text={loadingPortal ? 'Opening...' : 'Billing portal'}
                  isDisabled={loadingPortal}
                />
              )}
              {plan === 'free' && <Upgrade />}
            </div>
          )}
        </div>
      </div>

      {(open || keepMounted) && (
        <div
          className={open ? 'cursor-default' : 'hidden'}
          aria-hidden={!open}
          data-accordion-click-ignore="true"
        >
          {children}
        </div>
      )}
    </div>
  );
};

export default AccordionButton;
