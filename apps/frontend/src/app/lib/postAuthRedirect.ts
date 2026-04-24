import { loadOrgs } from '@/app/features/organization/services/orgService';
import { loadProfiles } from '@/app/features/organization/services/profileService';
import { loadAvailability } from '@/app/features/organization/services/availabilityService';
import { loadSpecialitiesForOrg } from '@/app/features/organization/services/specialityService';
import {
  resolveDefaultOpenScreenRoute,
  resolveDefaultOpenScreenRouteForProfile,
} from '@/app/lib/defaultOpenScreen';
import { computeTeamOnboardingStep } from '@/app/lib/teamOnboarding';
import { computeOrgOnboardingStep } from '@/app/lib/orgOnboarding';
import { useOrgStore } from '@/app/stores/orgStore';
import { useUserProfileStore } from '@/app/stores/profileStore';
import { useAvailabilityStore } from '@/app/stores/availabilityStore';
import { useSpecialityStore } from '@/app/stores/specialityStore';

const normalizeRole = (role?: string | null) =>
  String(role ?? '')
    .trim()
    .toLowerCase();

const isDeveloperRole = (role?: string | null) => normalizeRole(role) === 'developer';
const isOwnerRole = (role?: string | null) => normalizeRole(role) === 'owner';

type ResolvePostAuthRedirectOptions = {
  fallbackRole?: string | null;
  redirectPath?: string;
  isDeveloper?: boolean;
};

type ResolveOrgScopedRedirectOptions = {
  orgId: string;
  fallbackRole?: string | null;
};

export const resolveOrgScopedRedirect = async ({
  orgId,
  fallbackRole,
}: ResolveOrgScopedRedirectOptions): Promise<string> => {
  const orgState = useOrgStore.getState();
  const org = orgState.orgsById[orgId];
  const membership = orgState.membershipsByOrgId[orgId];

  if (!org || !membership) {
    return '/organizations';
  }

  const effectiveRole = membership.roleDisplay ?? membership.roleCode ?? fallbackRole;

  if (!org.isVerified && isOwnerRole(effectiveRole)) {
    try {
      await loadSpecialitiesForOrg({ silent: true, force: true, orgId });
    } catch {
      // Ignore speciality refresh failures and use cached state.
    }

    const specialities = useSpecialityStore.getState().getSpecialitiesByOrgId(orgId);
    const orgStep = computeOrgOnboardingStep(org, specialities);
    if (orgStep < 3) {
      return `/create-org?orgId=${orgId}`;
    }
  }

  try {
    await Promise.all([loadProfiles({ silent: true }), loadAvailability({ silent: true })]);
  } catch {
    return resolveDefaultOpenScreenRoute(effectiveRole);
  }

  const profilesByOrgId = useUserProfileStore.getState().profilesByOrgId;
  const availabilityIdsByOrgId = useAvailabilityStore.getState().availabilityIdsByOrgId;
  const availabilitiesById = useAvailabilityStore.getState().availabilitiesById;

  const profile = profilesByOrgId[orgId] ?? null;
  const availabilityIds = availabilityIdsByOrgId[orgId] ?? [];
  const availabilities = availabilityIds.map((id) => availabilitiesById[id]).filter(Boolean);
  const profileStep = computeTeamOnboardingStep(profile, availabilities);

  if (profileStep < 3) {
    return `/team-onboarding?orgId=${orgId}`;
  }

  return resolveDefaultOpenScreenRouteForProfile({
    profile,
    orgType: org.type,
    role: effectiveRole,
  });
};

export const resolvePostAuthRedirect = async ({
  fallbackRole,
  redirectPath,
  isDeveloper = false,
}: ResolvePostAuthRedirectOptions): Promise<string> => {
  if (redirectPath) {
    return redirectPath;
  }

  if (isDeveloper || isDeveloperRole(fallbackRole)) {
    return '/developers/home';
  }

  // Load orgs first — everything else depends on it
  try {
    await loadOrgs({ silent: true });
  } catch {
    return resolveDefaultOpenScreenRoute(fallbackRole);
  }

  const { orgIds, primaryOrgId } = useOrgStore.getState();

  // New user with no org → create org flow
  if (orgIds.length === 0) {
    return '/create-org';
  }

  // No primary org selected → org selection page (invited user with multiple orgs)
  if (!primaryOrgId) {
    return '/organizations';
  }

  return resolveOrgScopedRedirect({ orgId: primaryOrgId, fallbackRole });
};
