import { useEffect, useMemo } from 'react';
import { loadProfiles } from '@/app/features/organization/services/profileService';
import { useOrgStore } from '@/app/stores/orgStore';
import { useUserProfileStore } from '@/app/stores/profileStore';
import { UserProfile } from '@/app/features/users/types/profile';

export const useLoadProfiles = () => {
  const primaryOrgId = useOrgStore((s) => s.primaryOrgId);
  const profilesByOrgId = useUserProfileStore((s) => s.profilesByOrgId);

  useEffect(() => {
    if (!primaryOrgId) return;
    const isLoaded = Object.hasOwn(profilesByOrgId, primaryOrgId);
    if (!isLoaded && useUserProfileStore.getState().status !== 'loading') {
      void loadProfiles({ silent: true, orgId: primaryOrgId });
    }
  }, [primaryOrgId, profilesByOrgId]);
};

export const usePrimaryOrgProfile = (): UserProfile | null => {
  const primaryOrgId = useOrgStore((s) => s.primaryOrgId);
  const profilesByOrgId = useUserProfileStore((s) => s.profilesByOrgId);

  return useMemo(() => {
    if (!primaryOrgId) return null;
    return profilesByOrgId[primaryOrgId] ?? null;
  }, [primaryOrgId, profilesByOrgId]);
};
