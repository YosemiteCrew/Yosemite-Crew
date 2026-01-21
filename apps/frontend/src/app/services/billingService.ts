import { useOrgStore } from "../stores/orgStore";
import { BillingSubscriptionInterval } from "../types/billing";
import { postData } from "./axios";

export const getStripeBillingPortal = async (): Promise<string> => {
  const { primaryOrgId } = useOrgStore.getState();
  try {
    if (!primaryOrgId) {
      throw new Error(
        "No primary organization selected."
      );
    }
    const res = await postData<{ url: string }>(
      "/v1/stripe/organisation/" + primaryOrgId + "/billing/portal"
    );
    const url = res.data.url;
    return url;
  } catch (err) {
    console.error("Failed to create service:", err);
    throw err;
  }
};

export const getUpgradeLink = async (
  interval: BillingSubscriptionInterval
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
      body
    );
    const url = res.data.url;
    return url;
  } catch (err) {
    console.error("Failed to create service:", err);
    throw err;
  }
};
