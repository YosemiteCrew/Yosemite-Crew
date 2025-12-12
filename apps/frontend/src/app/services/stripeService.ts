import { getData, postData } from "./axios";

export const checkStatus = async (orgId: string | null) => {
  if (!orgId) {
    throw new Error("OrgId does not exist");
  }
  try {
    const res = await getData(
      "/v1/stripe/organisation/" + orgId + "/account/status"
    );
    return res.data;
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
      "/v1/stripe/organisation/" + orgId + "/account"
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
      "/v1/stripe/organisation/" + orgId + "/onboarding"
    );
    return res.data.client_secret;
  } catch (err: any) {
    console.error("Failed to load orgs:", err);
    throw err;
  }
};
