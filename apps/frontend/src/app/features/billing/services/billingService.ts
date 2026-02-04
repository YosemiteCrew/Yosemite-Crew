import { useOrgStore } from "@/app/stores/orgStore";
import { BillingSubscriptionInterval } from "@/app/features/billing/types/billing";
import { postData } from "@/app/services/axios";

export const getStripeBillingPortal = async (): Promise<string> => {
  const { primaryOrgId } = useOrgStore.getState();
  try {
    if (!primaryOrgId) {
      throw new Error("No primary organization selected.");
    }
    const res = await postData<{ url: string }>(
      "/v1/stripe/organisation/" + primaryOrgId + "/billing/portal",
    );
    const url = res.data.url;
    return url;
  } catch (err) {
    console.error("Failed to create service:", err);
    throw err;
  }
};

export const getUpgradeLink = async (
  interval: BillingSubscriptionInterval,
): Promise<string> => {
  const { primaryOrgId } = useOrgStore.getState();
  try {
    if (!primaryOrgId) {
      throw new Error("No primary organization selected.");
    }
    if (!interval) {
      throw new Error("No interval selected.");
    }
    const body = {
      interval,
    };
    const res = await postData<{ url: string }>(
      "/v1/stripe/organisation/" + primaryOrgId + "/billing/checkout",
      body,
    );
    const url = res.data.url;
    return url;
  } catch (err) {
    console.error("Failed to create service:", err);
    throw err;
  }
};

export const getCheckoutClientSecret = async (
  interval: BillingSubscriptionInterval,
): Promise<string> => {
  const { primaryOrgId } = useOrgStore.getState();
  if (!primaryOrgId) throw new Error("No primary organization selected.");
  if (!interval) throw new Error("No interval selected.");
  const body = { interval };
  const res = await postData<{ clientSecret: string }>(
    "/v1/stripe/organisation/" + primaryOrgId + "/billing/checkout",
    body,
  );
  const clientSecret = res.data.clientSecret;
  if (!clientSecret) throw new Error("No clientSecret returned from backend.");
  return clientSecret;
};
