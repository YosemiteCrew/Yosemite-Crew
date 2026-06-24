import { useEffect, useMemo } from 'react';
import { loadProfiles } from '@/app/features/organization/services/profileService';
import { useOrgStore } from '@/app/stores/orgStore';
import { useUserProfileStore } from '@/app/stores/profileStore';
import { UserProfile } from '@/app/features/users/types/profile';
import { useAuthStore } from '@/app/stores/authStore';

export const useLoadProfiles = () => {
  const authStatus = useAuthStore((s) => s.status);
  const primaryOrgId = useOrgStore((s) => s.primaryOrgId);
  const isAuthed = authStatus === 'authenticated' || authStatus === 'signin-authenticated';

  useEffect(() => {
    if (!isAuthed) return;
    if (!primaryOrgId) return;
    const state = useUserProfileStore.getState();
    if (state.status === 'loading') return;
    if (Object.hasOwn(state.profilesByOrgId ?? {}, primaryOrgId)) return;
    void loadProfiles({ silent: true, orgId: primaryOrgId });
  }, [isAuthed, primaryOrgId]);
};

export const usePrimaryOrgProfile = (): UserProfile | null => {
  const primaryOrgId = useOrgStore((s) => s.primaryOrgId);
  const profilesByOrgId = useUserProfileStore((s) => s.profilesByOrgId);

  return useMemo(() => {
    if (!primaryOrgId) return null;
    return profilesByOrgId[primaryOrgId] ?? null;
  }, [primaryOrgId, profilesByOrgId]);
};
