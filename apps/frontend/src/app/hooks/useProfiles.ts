import { useEffect, useMemo } from 'react';
import { loadProfiles } from '@/app/features/organization/services/profileService';
import { useOrgStore } from '@/app/stores/orgStore';
import { useUserProfileStore } from '@/app/stores/profileStore';
import { UserProfile } from '@/app/features/users/types/profile';

export const useLoadProfiles = () => {
  const profileStatus = useUserProfileStore((s) => s.status);
  const orgIds = useOrgStore((s) => s.orgIds);
  const profilesByOrgId = useUserProfileStore((s) => s.profilesByOrgId);

  useEffect(() => {
    if (!orgIds || orgIds.length === 0) return;
    const hasAllProfilesLoaded = orgIds.every((orgId) => Object.hasOwn(profilesByOrgId, orgId));
    if ((profileStatus === 'idle' || !hasAllProfilesLoaded) && profileStatus !== 'loading') {
      void loadProfiles();
    }
  }, [profileStatus, orgIds, profilesByOrgId]);
};

export const usePrimaryOrgProfile = (): UserProfile | null => {
  const primaryOrgId = useOrgStore((s) => s.primaryOrgId);
  const profilesByOrgId = useUserProfileStore((s) => s.profilesByOrgId);

  return useMemo(() => {
    if (!primaryOrgId) return null;
    return profilesByOrgId[primaryOrgId] ?? null;
  }, [primaryOrgId, profilesByOrgId]);
};
