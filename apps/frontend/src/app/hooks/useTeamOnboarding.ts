import { useMemo } from 'react';
import { useOrgStore } from '@/app/stores/orgStore';
import { UserProfile } from '@/app/features/users/types/profile';
import { computeTeamOnboardingStep, TeamOnboardingStep } from '@/app/lib/teamOnboarding';
import { useUserProfileStore } from '@/app/stores/profileStore';
import { useAvailabilityStore } from '@/app/stores/availabilityStore';
import { ApiDayAvailability } from '@/app/features/appointments/components/Availability/utils';

export const useTeamOnboarding = (
  orgId: string | null
): {
  profile: UserProfile | null;
  step: TeamOnboardingStep;
  slots: ApiDayAvailability[];
  shouldRedirectToOrganizations: boolean;
  isReady: boolean;
} => {
  const profileStatus = useUserProfileStore((s) => s.status);
  const profile = useUserProfileStore((s) =>
    orgId ? ((s.profilesByOrgId[orgId] as UserProfile | undefined) ?? null) : null
  );
  const membership = useOrgStore((s) => (orgId ? (s.membershipsByOrgId[orgId] ?? null) : null));
  const orgStatus = useOrgStore((s) => s.status);
  const availabilityStatus = useAvailabilityStore((s) => s.status);
  const availabilitiesById = useAvailabilityStore((s) => s.availabilitiesById);
  const availabilityIdsByOrgId = useAvailabilityStore((s) => s.availabilityIdsByOrgId);

  const { step, slots, effectiveprofile, shouldRedirectToOrganizations, isReady } = useMemo(() => {
    if (!orgId) {
      return {
        step: 0 as TeamOnboardingStep,
        slots: [] as any[],
        effectiveprofile: null as UserProfile | null,
        shouldRedirectToOrganizations: true,
        isReady: true,
      };
    }
    if (
      orgStatus === 'loading' ||
      orgStatus === 'idle' ||
      profileStatus === 'loading' ||
      profileStatus === 'idle' ||
      availabilityStatus === 'loading' ||
      availabilityStatus === 'idle'
    ) {
      return {
        step: 0 as TeamOnboardingStep,
        slots: [],
        effectiveprofile: null,
        shouldRedirectToOrganizations: false,
        isReady: false,
      };
    }
    if (!membership) {
      return {
        step: 0 as TeamOnboardingStep,
        slots: [] as any[],
        effectiveprofile: null as UserProfile | null,
        shouldRedirectToOrganizations: true,
        isReady: true,
      };
    }
    const role = (membership.roleDisplay ?? membership.roleCode ?? '').toLowerCase();
    const isOwner = role === 'owner';

    if (isOwner) {
      return {
        step: 3 as TeamOnboardingStep,
        slots: [] as any[],
        effectiveprofile: null as UserProfile | null,
        shouldRedirectToOrganizations: false,
        isReady: true,
      };
    }

    if (!profile) {
      return {
        step: 0 as TeamOnboardingStep,
        slots: [] as any[],
        effectiveprofile: null as UserProfile | null,
        shouldRedirectToOrganizations: false,
        isReady: true,
      };
    }

    const ids = availabilityIdsByOrgId[orgId] ?? [];
    const availabilities = ids
      .map((id) => availabilitiesById[id])
      .filter((s): s is ApiDayAvailability => s != null);

    const step = computeTeamOnboardingStep(profile, availabilities);

    return {
      step,
      effectiveprofile: profile,
      slots: availabilities,
      shouldRedirectToOrganizations: false,
      isReady: true,
    };
  }, [
    orgId,
    profile,
    membership,
    orgStatus,
    profileStatus,
    availabilityStatus,
    availabilitiesById,
    availabilityIdsByOrgId,
  ]);

  return {
    profile: effectiveprofile,
    slots: slots,
    step: step,
    shouldRedirectToOrganizations,
    isReady,
  };
};
