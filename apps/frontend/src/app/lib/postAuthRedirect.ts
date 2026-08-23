import { loadOrgs } from '@/app/features/organization/services/orgService';
import { loadProfiles } from '@/app/features/organization/services/profileService';
import { loadAvailability } from '@/app/features/organization/services/availabilityService';
import { loadInvites } from '@/app/features/organization/services/teamService';
import {
  resolveDefaultOpenScreenRoute,
  resolveDefaultOpenScreenRouteForProfile,
} from '@/app/lib/defaultOpenScreen';
import { computeTeamOnboardingStep } from '@/app/lib/teamOnboarding';
import { computeOrgOnboardingStep } from '@/app/lib/orgOnboarding';
import { useOrgStore } from '@/app/stores/orgStore';
import { useUserProfileStore } from '@/app/stores/profileStore';
import { useAvailabilityStore } from '@/app/stores/availabilityStore';

const normalizeRole = (role?: string | null) =>
  String(role ?? '')
    .trim()
    .toLowerCase();

const isDeveloperRole = (role?: string | null) => normalizeRole(role) === 'developer';
const isOwnerRole = (role?: string | null) => normalizeRole(role) === 'owner';

// Only same-origin, absolute-path destinations are safe post-auth targets;
// anything else (external URLs, protocol-relative //host) is dropped.
//
// Resolved against a fixed base rather than prefix-matched. A `startsWith('//')`
// style check is defeated by characters browsers strip from a URL before
// navigating: `/\t/evil.com` and `/\n/evil.com` are not literally `//...` but
// become protocol-relative once stripped, which is an open redirect straight off
// the sign-in page. Parsing normalises all of that, and comparing the resolved
// origin to the base is what actually proves the target is same-origin.
const SAME_ORIGIN_BASE = 'https://sanitize-next-path.invalid';

export const sanitizeNextPath = (value: string | null): string | undefined => {
  if (!value) return undefined;
  // Strip the characters a browser would drop, so the parse below sees what the
  // browser would actually navigate to.
  const stripped = value.replace(/[\t\n\r]/g, '');
  if (!stripped.startsWith('/') || stripped.startsWith('//')) return undefined;

  try {
    const url = new URL(stripped, SAME_ORIGIN_BASE);
    if (url.origin !== SAME_ORIGIN_BASE) return undefined;
    const resolved = `${url.pathname}${url.search}${url.hash}`;
    // Re-check the RESOLVED path: `/..//evil.com` parses as same-origin here but
    // normalises to `//evil.com`, which the router would treat as
    // protocol-relative all over again.
    return resolved.startsWith('//') ? undefined : resolved;
  } catch {
    return undefined;
  }
};

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
    const orgStep = computeOrgOnboardingStep(org);
    if (orgStep < 2) {
      return `/create-org?orgId=${orgId}`;
    }
  }

  try {
    await Promise.all([
      loadProfiles({ silent: true, orgId }),
      loadAvailability({ silent: true, orgId }),
    ]);
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

  // New user with no org — check for pending invites before sending to create-org
  if (orgIds.length === 0) {
    try {
      const invites = await loadInvites();
      if (invites.length > 0) {
        return '/organizations';
      }
    } catch {
      // Ignore invite fetch failures — fall through to create-org
    }
    return '/create-org';
  }

  // No primary org selected → org selection page (invited user with multiple orgs)
  if (!primaryOrgId) {
    return '/organizations';
  }

  return resolveOrgScopedRedirect({ orgId: primaryOrgId, fallbackRole });
};
