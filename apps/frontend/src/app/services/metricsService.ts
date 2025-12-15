import { useOrgStore } from "../stores/orgStore";
import { DashboardSummary, EMPTY_EXPLORE } from "../types/metrics";
import { getData } from "./axios";

export const getExploreMetrics = async (): Promise<DashboardSummary> => {
  const { primaryOrgId } = useOrgStore.getState();
  if (!primaryOrgId) {
    console.warn("No primary organization selected. Cannot load companions.");
    return EMPTY_EXPLORE;
  }
  try {
    const res = await getData<DashboardSummary>(
      "/v1/dashboard/summary/" + primaryOrgId
    );
    return res.data;
  } catch (err) {
    console.error("Failed to create service:", err);
    throw err;
  }
};
