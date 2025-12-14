import { useEffect, useState } from "react";
import { useOrgStore } from "../stores/orgStore";
import { DashboardSummary, EMPTY_EXPLORE } from "../types/metrics";
import { getExploreMetrics } from "../services/metricsService";

export const useExploreMetrics = () => {
  const primaryOrgId = useOrgStore((s) => s.primaryOrgId);
  const [data, setData] = useState<DashboardSummary>(EMPTY_EXPLORE);

  useEffect(() => {
    if (!primaryOrgId) {
      setData(EMPTY_EXPLORE);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await getExploreMetrics();
        if (!cancelled) setData(res);
      } catch (e) {
        console.log(e);
        if (!cancelled) setData(EMPTY_EXPLORE);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [primaryOrgId]);

  return data;
};
