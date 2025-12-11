import { useEffect } from "react";
import { loadProfiles } from "../services/profileService";
import { useOrgStore } from "../stores/orgStore";
import { useUserProfileStore } from "../stores/profileStore";

export const useLoadProfiles = () => {
  const profileStatus = useUserProfileStore((s) => s.status);
  const orgIds = useOrgStore((s) => s.orgIds);

  useEffect(() => {
    if (!orgIds || orgIds.length === 0) return;
    if (profileStatus === "idle") {
      void loadProfiles();
    }
  }, [profileStatus, orgIds]);
};
