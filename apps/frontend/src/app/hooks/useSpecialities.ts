import { useEffect } from "react";
import { useOrgStore } from "@/app/stores/orgStore";
import { useSpecialityStore } from "@/app/stores/specialityStore";
import { loadSpecialitiesForOrg } from "@/app/services/specialityService";

export const useLoadSpecialitiesForPrimaryOrg = () => {
  const primaryOrgId = useOrgStore((s) => s.primaryOrgId);

  const hasSpecialitiesForOrg = useSpecialityStore((s) => {
    if (!primaryOrgId) return false;
    const ids = s.specialityIdsByOrgId[primaryOrgId] ?? [];
    return ids.length > 0;
  });

  useEffect(() => {
    if (!primaryOrgId) return;
    if (hasSpecialitiesForOrg) return;
    void loadSpecialitiesForOrg();
  }, [primaryOrgId, hasSpecialitiesForOrg]);
};
