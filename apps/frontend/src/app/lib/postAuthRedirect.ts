import { loadOrgs } from '@/app/features/organization/services/orgService';
import { loadProfiles } from '@/app/features/organization/services/profileService';
import { loadAvailability } from '@/app/features/organization/services/availabilityService';
import { loadSpecialitiesForOrg } from '@/app/features/organization/services/specialityService';
import { resolveDefaultOpenScreenRoute } from '@/app/lib/defaultOpenScreen';
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

  const { orgIds, primaryOrgId, orgsById, membershipsByOrgId } = useOrgStore.getState();

  // New user with no org → create org flow
  if (orgIds.length === 0) {
    return '/create-org';
  }

  // No primary org selected → org selection page (invited user with multiple orgs)
  if (!primaryOrgId) {
    return '/organizations';
  }

  const primaryOrg = orgsById[primaryOrgId];
  const membership = membershipsByOrgId[primaryOrgId];
  const effectiveRole = membership?.roleDisplay ?? membership?.roleCode ?? fallbackRole;

  // For unverified owner orgs: load specialities to accurately compute org onboarding step
  if (primaryOrg && !primaryOrg.isVerified && isOwnerRole(effectiveRole)) {
    try {
      await loadSpecialitiesForOrg({ silent: true, force: true });
    } catch {
      // Non-fatal — fall back conservatively
    }
    const specialities = useSpecialityStore.getState().getSpecialitiesByOrgId(primaryOrgId);
    const orgStep = computeOrgOnboardingStep(primaryOrg, specialities);
    if (orgStep < 3) {
      return `/create-org?orgId=${primaryOrgId}`;
    }
    // Org onboarding done (step 3) but not yet verified — fall through to profile check
  }

  // Load profile and availability in parallel to determine profile onboarding step
  try {
    await Promise.all([loadProfiles({ silent: true }), loadAvailability({ silent: true })]);
  } catch {
    // Non-fatal: fall back to role-based default
    return resolveDefaultOpenScreenRoute(effectiveRole);
  }

  const profilesByOrgId = useUserProfileStore.getState().profilesByOrgId;
  const availabilityIdsByOrgId = useAvailabilityStore.getState().availabilityIdsByOrgId;
  const availabilitiesById = useAvailabilityStore.getState().availabilitiesById;

  const profile = profilesByOrgId[primaryOrgId] ?? null;
  const availabilityIds = availabilityIdsByOrgId[primaryOrgId] ?? [];
  const availabilities = availabilityIds.map((id) => availabilitiesById[id]).filter(Boolean);

  const profileStep = computeTeamOnboardingStep(profile, availabilities);

  // Profile onboarding incomplete → go directly to team-onboarding
  if (profileStep < 3) {
    return `/team-onboarding?orgId=${primaryOrgId}`;
  }

  // Profile complete — send to role-based default landing screen
  return resolveDefaultOpenScreenRoute(effectiveRole);
};
