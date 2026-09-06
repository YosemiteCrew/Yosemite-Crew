import React, { useEffect, useState } from 'react';
import { IoIosWarning } from 'react-icons/io';
import { Primary, Secondary } from '@/app/ui/primitives/Buttons';
import { getStripeBillingPortal } from '@/app/features/billing/services/billingService';
import { getSafeStripeRedirectUrl } from '@/app/lib/urls';
import { useSubscriptionForPrimaryOrg } from '@/app/hooks/useBilling';
import { usePermissions } from '@/app/hooks/usePermissions';
import { PERMISSIONS } from '@/app/lib/permissions';
import Upgrade from '@/app/ui/widgets/Upgrade';

interface SectionCardProps {
  title: string;
  children?: React.ReactNode;
  buttonTitle?: string;
  /** Leading icon for the section action, e.g. the design's `+` on an "Add" pill. */
  buttonIcon?: React.ReactNode;
  buttonClick?: any;
  showButton?: boolean;
  finance?: boolean;
  actions?: React.ReactNode;
}

/**
 * A titled section of the organisation page. The design lays these out flat -
 * every section open, its title a plain heading - so this deliberately has no
 * collapse: it replaced an accordion whose chevron was the only thing standing
 * between the page and the design.
 */
const SectionCard: React.FC<SectionCardProps> = ({
  title,
  children,
  buttonTitle,
  buttonIcon,
  buttonClick,
  showButton = true,
  finance = false,
  actions,
}) => {
  const subscription = useSubscriptionForPrimaryOrg();
  const { can } = usePermissions();
  const canEditSubscription = can(PERMISSIONS.SUBSCRIPTION_EDIT_ANY);
  const plan = subscription?.plan;
  const hasCustomerId = Boolean(subscription?.stripeCustomerId);
  const [loadingPortal, setLoadingPortal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // An action in the header used to collapse the whole card to py-2 (8px) while
  // an actionless one sat at 20px, so two adjacent sections could differ by 12px
  // for a reason the reader cannot see. The action button carries its own height;
  // the card keeps one padding either way.
  const paddingYClass = 'py-[18px]';

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
    // Carries the same card surface as the Settings PreferenceGroup: --screen
    // ground, hairline border, 18px radius and the two-layer shadow. Without the
    // ground and shadow this rendered as a bare frame, which is why four
    // consumers had each grown their OWN inner card to compensate - stacking two
    // visible borders. The surface belongs to the primitive, once.
    <div className={`yc-surface flex flex-col gap-3 px-6 ${paddingYClass}`}>
      <div className="flex items-center gap-x-4 gap-y-2">
        <h2 className="min-w-0 flex-1 text-heading-3 text-text-primary">{title}</h2>
        <div className="flex shrink-0 items-center gap-3 flex-wrap">
          {error && (
            <div className="flex items-center gap-1 px-4 text-caption-2 text-text-error">
              <IoIosWarning className="text-text-error" size={14} />
              <span>{error}</span>
            </div>
          )}
          {/* Design: the section action is a filled --cta pill, not an outlined one. */}
          {showButton && buttonTitle && (
            <Primary
              href="#"
              onClick={() => buttonClick(true)}
              text={buttonTitle}
              icon={buttonIcon}
            />
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

      <div>{children}</div>
    </div>
  );
};

export default SectionCard;
