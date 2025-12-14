import { useEffect, useMemo } from "react";
import { loadProfiles } from "../services/profileService";
import { useOrgStore } from "../stores/orgStore";
import { useUserProfileStore } from "../stores/profileStore";
import { UserProfile } from "../types/profile";

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

export const usePrimaryOrgProfile = (): UserProfile | null => {
  const primaryOrgId = useOrgStore((s) => s.primaryOrgId);
  const profilesByOrgId = useUserProfileStore((s) => s.profilesByOrgId);

  return useMemo(() => {
    if (!primaryOrgId) return null;
    return profilesByOrgId[primaryOrgId] ?? null;
  }, [primaryOrgId, profilesByOrgId]);
};
