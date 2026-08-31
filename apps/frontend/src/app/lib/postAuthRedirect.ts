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
import { getStorageItem } from '@/app/lib/browserStorage';

const normalizeRole = (role?: string | null) =>
  String(role ?? '')
    .trim()
    .toLowerCase();

/**
 * The one definition of "this role is a developer role".
 *
 * Exported so callers that need the same question answered - SignIn, deciding
 * whether the developer form matched the account - cannot drift into a second,
 * subtly different normalization.
 */
export const isDeveloperRole = (role?: string | null) => normalizeRole(role) === 'developer';
const isOwnerRole = (role?: string | null) => normalizeRole(role) === 'owner';

/**
 * True when ANY role the account holds is the developer role.
 *
 * One account can be both a practice member and a platform developer, so
 * "is this a developer" is a question about the whole set, not about the one
 * role `/v1/auth/me` happens to surface as `role`.
 */
export const hasDeveloperRole = (roles?: readonly (string | null | undefined)[] | null) =>
  (roles ?? []).some((role) => isDeveloperRole(role));

/**
 * The role set to reason about, given both what the API sent and the single
 * role callers already had.
 *
 * `roles` is empty for a session stored before the API served it, and for a
 * sign-up whose provisioning call has not landed yet. Treating that emptiness
 * as "holds nothing" told real developers they were not developers, so an
 * empty list always falls back to the one role that is known rather than
 * answering no.
 */
/**
 * True when the developer role is the ONLY role this account holds.
 *
 * `hasDeveloperRole` answers "does this account have developer access", which
 * is the right question when deciding whether the portal is reachable at all.
 * It is the wrong question for a fallback that has to choose a destination
 * without being told which product the person asked for: a dual-role account
 * answers yes to it and still belongs in its practice.
 */
const holdsOnlyDeveloperRole = (roles: readonly string[]) =>
  roles.length > 0 && roles.every(isDeveloperRole);

export const resolveHeldRoles = (
  roles?: readonly (string | null | undefined)[] | null,
  singleRole?: string | null
): readonly string[] => {
  // A list of only blanks is the same as no list: fall back rather than
  // reporting that the account holds a role with no name.
  const named = (roles ?? []).filter((role): role is string => typeof role === 'string');
  if (named.length > 0) return named;
  return singleRole ? [singleRole] : [];
};

/**
 * Whether this session was started from the developer sign-in or sign-up form.
 *
 * `devAuth` is already written at every authentication entry point for
 * `DevRouteGuard`, so it is the existing record of which door was used rather
 * than a second source of truth invented here. Absent (a fresh tab, or a
 * session restored by the shell) reads as "not the developer door", which
 * sends dual-role accounts to their practice - the safer default, because a
 * developer with no practice is still routed to the portal below.
 */
const enteredThroughDeveloperDoor = () => getStorageItem('session', 'devAuth') === 'true';

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
  /**
   * Every role the account holds. Supplied by callers that read the auth
   * store; `fallbackRole` alone is used when it is absent, which is the
   * single-role behaviour that predates dual-role accounts.
   */
  roles?: readonly string[] | null;
  redirectPath?: string;
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
  roles,
  redirectPath,
}: ResolvePostAuthRedirectOptions): Promise<string> => {
  if (redirectPath) {
    return redirectPath;
  }

  const heldRoles = resolveHeldRoles(roles, fallbackRole);
  const isDeveloper = hasDeveloperRole(heldRoles);

  /*
   * Holding the developer role no longer means the developer portal is the
   * only place this account can go.
   *
   * The role used to short-circuit here unconditionally, which made the two
   * memberships mutually exclusive in practice: an account that was both a
   * practice member and a developer could never reach its practice, because
   * this returned before any organization was ever loaded. The portal is the
   * destination when the person actually asked for it by using the developer
   * door; otherwise the account is routed by its practice membership like any
   * other, and a developer with no practice still lands in the portal below.
   *
   * Coming through the developer door WITHOUT the role deliberately does not
   * land here - SignIn reports that mismatch rather than routing on into a
   * page DevRouteGuard would immediately reject.
   */
  if (isDeveloper && enteredThroughDeveloperDoor()) {
    return '/developers/home';
  }

  // Load orgs first — everything else depends on it
  try {
    await loadOrgs({ silent: true });
  } catch {
    /*
     * A transient org load failure carries no information about which product
     * the person asked for, so it must not change where they land.
     *
     * Execution only reaches here when the developer door was NOT used - the
     * check above returns first when it was - so a dual-role account that
     * signed in at the practice door is on its way to its practice. Keying
     * this on `isDeveloper` sent it to the portal instead, undoing the very
     * routing the door check exists to provide, and it did so only when the
     * network happened to fail. Only an account whose sole role is developer
     * has nowhere else to land.
     */
    return holdsOnlyDeveloperRole(heldRoles)
      ? '/developers/home'
      : resolveDefaultOpenScreenRoute(fallbackRole);
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
    /* A developer with no practice has nothing to create yet, so the portal is
       their home rather than the practice-onboarding wizard. */
    return isDeveloper ? '/developers/home' : '/create-org';
  }

  // No primary org selected → org selection page (invited user with multiple orgs)
  if (!primaryOrgId) {
    return '/organizations';
  }

  return resolveOrgScopedRedirect({ orgId: primaryOrgId, fallbackRole });
};
