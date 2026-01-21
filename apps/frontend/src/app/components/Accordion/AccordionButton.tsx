import React, { useEffect, useState } from "react";
import { IoIosArrowDown, IoIosWarning } from "react-icons/io";
import { Primary, Secondary } from "../Buttons";
import { BillingSubscriptionInterval } from "@/app/types/billing";
import {
  getStripeBillingPortal,
  getUpgradeLink,
} from "@/app/services/billingService";
import { useSubscriptionForPrimaryOrg } from "@/app/hooks/useBilling";
import { usePermissions } from "@/app/hooks/usePermissions";
import { PERMISSIONS } from "@/app/utils/permissions";

interface AccordionButtonProps {
  title: string;
  children?: React.ReactNode;
  defaultOpen?: boolean;
  buttonTitle?: string;
  buttonClick?: any;
  showButton?: boolean;
  finance?: boolean;
}

const AccordionButton: React.FC<AccordionButtonProps> = ({
  title,
  children,
  defaultOpen = false,
  buttonTitle,
  buttonClick,
  showButton = true,
  finance = false,
}) => {
  const subscription = useSubscriptionForPrimaryOrg();
  const { can } = usePermissions();
  const canEditSubscription = can(PERMISSIONS.SUBSCRIPTION_EDIT_ANY);
  const plan = subscription?.plan;
  const hasStripeAccount = Boolean(subscription?.connectAccountId);
  const stripeCompleted = Boolean(subscription?.connectChargesEnabled);
  const orgId = subscription?.orgId;
  const subscriptionReady = Boolean(orgId);
  const [open, setOpen] = useState(defaultOpen);
  const [loadingPortal, setLoadingPortal] = useState(false);
  const [loadingUpgrade, setLoadingUpgrade] =
    useState<null | BillingSubscriptionInterval>(null);
  const [error, setError] = useState<string | null>(null);

  const handleBillingPortal = async () => {
    setError(null);
    setLoadingPortal(true);
    try {
      const url = await getStripeBillingPortal();
      globalThis.location.href = url;
    } catch (e: any) {
      setError(e?.message || "Failed to open billing portal");
    } finally {
      setLoadingPortal(false);
    }
  };

  const handleUpgrade = async () => {
    const interval: BillingSubscriptionInterval = "month";
    setError(null);
    setLoadingUpgrade(interval);
    try {
      const url = await getUpgradeLink(interval);
      globalThis.location.href = url;
    } catch (e: any) {
      setError(e?.message || "Failed to start upgrade");
    } finally {
      setLoadingUpgrade(null);
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
      className={`flex flex-col gap-3 rounded-2xl border border-card-border px-6 ${showButton || finance ? "py-2" : "py-[20px]"}`}
    >
      <div className="flex items-center justify-between">
        <button
          className="flex items-center gap-2"
          onClick={() => setOpen(!open)}
        >
          <IoIosArrowDown
            size={22}
            color="#302f2e"
            className={`text-black-text transition-transform ${
              open ? "rotate-0" : "-rotate-90"
            }`}
          />
          <div className="text-heading-3 text-text-primary">{title}</div>
        </button>
        <div className="flex items-center gap-3">
          {error && (
            <div
              className={`
                      flex items-center gap-1 px-4
                      text-caption-2 text-text-error
                    `}
            >
              <IoIosWarning className="text-text-error" size={14} />
              <span>{error}</span>
            </div>
          )}
          {showButton && buttonTitle && (
            <Secondary
              href="#"
              onClick={() => buttonClick(true)}
              text={buttonTitle}
            />
          )}
          {canEditSubscription && finance && (
            <div className="flex items-center gap-3">
              {plan === "business" && (
                <Secondary
                  href="#"
                  onClick={handleBillingPortal}
                  text={loadingPortal ? "Opening..." : "Billing portal"}
                  isDisabled={loadingPortal || loadingUpgrade !== null}
                />
              )}
              {stripeCompleted ? (
                <Primary
                  href="#"
                  onClick={handleUpgrade}
                  text={loadingUpgrade ? "Redirecting..." : "Upgrade"}
                  isDisabled={loadingPortal || loadingUpgrade !== null}
                />
              ) : (
                <Secondary
                  href={
                    subscriptionReady
                      ? `/stripe-onboarding?orgId=${orgId}`
                      : "#"
                  }
                  isDisabled={!subscriptionReady}
                  text={hasStripeAccount ? "Continue setup" : "Connect stripe"}
                />
              )}
            </div>
          )}
        </div>
      </div>

      {open && <div className={``}>{children}</div>}
    </div>
  );
};

export default AccordionButton;
