import { useCounterStore } from "../stores/counterStore";
import { useSubscriptionStore } from "../stores/subscriptionStore";
import { BillingCounter, BillingSubscription } from "../types/billing";
import { getData, postData } from "./axios";

export type CheckStatusResponse = {
  orgBilling: BillingSubscription;
  orgUsage: BillingCounter;
};

export const checkStatus = async (orgId: string | null) => {
  const { setSubscriptionForOrg } = useSubscriptionStore.getState();
  const { setCounterForOrg } = useCounterStore.getState();
  if (!orgId) {
    throw new Error("OrgId does not exist");
  }
  try {
    const res = await getData<CheckStatusResponse>(
      "/v1/stripe/organisation/" + orgId + "/account/status",
    );
    const data = res.data;
    setSubscriptionForOrg(orgId, data.orgBilling);
    setCounterForOrg(orgId, data.orgUsage);
    return data;
  } catch (err: any) {
    console.error("Failed to load orgs:", err);
    throw err;
  }
};

export const createConnectedAccount = async (orgId: string | null) => {
  if (!orgId) {
    throw new Error("OrgId does not exist");
  }
  try {
    const res = await postData<{ accountId: string }>(
      "/v1/stripe/organisation/" + orgId + "/account",
    );
    return res.data.accountId;
  } catch (err: any) {
    console.error("Failed to load orgs:", err);
    throw err;
  }
};

export const onBoardConnectedAccount = async (orgId: string | null) => {
  if (!orgId) {
    throw new Error("OrgId does not exist");
  }
  try {
    const res = await postData<{ client_secret: string }>(
      "/v1/stripe/organisation/" + orgId + "/onboarding",
    );
    return res.data.client_secret;
  } catch (err: any) {
    console.error("Failed to load orgs:", err);
    throw err;
  }
};
