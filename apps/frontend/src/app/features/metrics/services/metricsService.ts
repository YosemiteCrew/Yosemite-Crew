import { useOrgStore } from "@/app/stores/orgStore";
import { DashboardSummary, EMPTY_EXPLORE } from "@/app/features/metrics/types/metrics";
import { http } from "@/app/services/http";
import { logger } from "@/app/lib/logger";

export const getExploreMetrics = async (): Promise<DashboardSummary> => {
  const { primaryOrgId } = useOrgStore.getState();
  if (!primaryOrgId) {
    logger.warn("No primary organization selected. Cannot load companions.");
    return EMPTY_EXPLORE;
  }
  try {
    const res = await http.get<DashboardSummary>(
      "/v1/dashboard/summary/" + primaryOrgId,
    );
    return res.data;
  } catch (err) {
    logger.error("Failed to load metrics:", err);
    throw err;
  }
};
