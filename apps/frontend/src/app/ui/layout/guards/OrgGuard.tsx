'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';

import { useFullscreenLoader } from '@/app/hooks/useFullscreenLoader';
import { useOrgStore } from '@/app/stores/orgStore';
import { useSpecialityStore } from '@/app/stores/specialityStore';
import { computeOrgOnboardingStep } from '@/app/lib/orgOnboarding';
import type { Organisation, Speciality, UserOrganization } from '@yosemite-crew/types';
import type { UserProfile } from '@/app/features/users/types/profile';
import { useLoadTeam } from '@/app/hooks/useTeam';
import { useTeamStore } from '@/app/stores/teamStore';
import { useUserProfileStore } from '@/app/stores/profileStore';
import { computeTeamOnboardingStep } from '@/app/lib/teamOnboarding';
import { useAvailabilityStore } from '@/app/stores/availabilityStore';
import { ApiDayAvailability } from '@/app/features/appointments/components/Availability/utils';
import { useLoadRoomsForPrimaryOrg } from '@/app/hooks/useRooms';
import { useLoadAppointmentsForPrimaryOrg } from '@/app/hooks/useAppointments';
import { useLoadCompanionsForPrimaryOrg } from '@/app/hooks/useCompanion';
import { useLoadDocumentsForPrimaryOrg } from '@/app/hooks/useDocuments';
import { useLoadFormsForPrimaryOrg } from '@/app/hooks/useForms';
import { useInventoryModule } from '@/app/hooks/useInventory';
import { BusinessType } from '@/app/features/organization/types/org';
import { useLoadTasksForPrimaryOrg } from '@/app/hooks/useTask';
import { useLoadSubscriptionCounterForPrimaryOrg } from '@/app/hooks/useBilling';
import { useLoadInvoicesForPrimaryOrg } from '@/app/hooks/useInvoices';
import { useLoadIntegrationsForPrimaryOrg } from '@/app/hooks/useIntegrations';
import { resolveDefaultOpenScreenRouteForProfile } from '@/app/lib/defaultOpenScreen';
import { useLoadSpecialitiesForPrimaryOrg } from '@/app/hooks/useSpecialities';
import { getStorage, getStorageItem, setStorageItem } from '@/app/lib/browserStorage';
import {
  canAccessPathByPermissions,
  resolveFirstAccessibleAppRoute,
} from '@/app/lib/routePermissions';
import { appRoutes } from '@/app/constants/routes';

type OrgGuardProps = {
  children: React.ReactNode;
  skeleton?: React.ReactNode;
};

const isLocalGuardBypassEnabled = () => {
  if (process.env.NEXT_PUBLIC_DISABLE_AUTH_GUARD !== 'true') return false;
  const hostname = (
    process.env.YC_TEST_HOSTNAME ?? globalThis.window?.location?.hostname
  )?.toLowerCase();
  return hostname === 'localhost' || hostname === '127.0.0.1';
};

const isStatusPending = (status?: string) => status === 'idle' || status === 'loading';

const ORG_GUARD_KEY_PREFIX = 'yc_org_guard_passed:';
const orgGuardPassedKey = (orgId: string) => `${ORG_GUARD_KEY_PREFIX}${orgId}`;
const readOrgGuardPassed = (orgId: string): boolean =>
  getStorageItem('session', orgGuardPassedKey(orgId)) === '1';
const writeOrgGuardPassed = (orgId: string) =>
  setStorageItem('session', orgGuardPassedKey(orgId), '1');

// Returns true if ANY org has previously passed the guard in this session.
// Used as the fast-path initial state before primaryOrgId is known from the store.
const readAnyOrgGuardPassed = (): boolean => {
  const ss = getStorage('session');
  if (!ss) return false;
  for (let i = 0; i < ss.length; i++) {
    const key = ss.key(i);
    if (key?.startsWith(ORG_GUARD_KEY_PREFIX) && ss.getItem(key) === '1') return true;
  }
  return false;
};

type RedirectParams = {
  pathname: string;
  primaryOrgId: string;
  primaryOrg: Organisation;
  membership: UserOrganization;
  profile: UserProfile | null | undefined;
  specialities: Speciality[];
  availabilities: ApiDayAvailability[];
};

const isUnverifiedPathAllowed = (pathname: string): boolean =>
  pathname === '/book-onboarding' ||
  pathname === '/team-onboarding' ||
  pathname === '/guides' ||
  pathname.startsWith('/guides/') ||
  appRoutes.some(
    (route) =>
      route.verify === false && (pathname === route.href || pathname.startsWith(`${route.href}/`))
  );

const resolveUnverifiedOwnerRedirect = (
  step: number,
  profileStep: number,
  pathname: string,
  primaryOrgId: string
): string | null => {
  if (step < 3) return `/create-org?orgId=${primaryOrgId}`;
  if (profileStep < 3 && pathname !== '/team-onboarding') {
    return `/team-onboarding?orgId=${primaryOrgId}`;
  }
  if (isUnverifiedPathAllowed(pathname)) return '';
  return '/dashboard';
};

const resolveOrgRedirect = ({
  pathname,
  primaryOrgId,
  primaryOrg,
  membership,
  profile,
  specialities,
  availabilities,
}: RedirectParams): string | null => {
  const step = computeOrgOnboardingStep(primaryOrg, specialities);
  const profileStep = computeTeamOnboardingStep(profile, availabilities);
  const role = membership.roleDisplay ?? membership.roleCode;

  if (role.toLowerCase() === 'owner') {
    if (!primaryOrg.isVerified) {
      return resolveUnverifiedOwnerRedirect(step, profileStep, pathname, primaryOrgId);
    }
    if (profileStep < 3 && pathname !== '/team-onboarding') {
      return `/team-onboarding?orgId=${primaryOrgId}`;
    }
    return null;
  }

  if (profileStep < 3 && pathname !== '/organizations' && pathname !== '/team-onboarding') {
    return `/team-onboarding?orgId=${primaryOrgId}`;
  }

  return null;
};

const shouldWaitForOrgGuardData = (
  availabilityStatus: string,
  specialityStatus: string,
  profileStatus: string,
  teamStatus: string,
  hasTeamDataForOrg: boolean
) =>
  isStatusPending(availabilityStatus) ||
  isStatusPending(specialityStatus) ||
  isStatusPending(profileStatus) ||
  (isStatusPending(teamStatus) && !hasTeamDataForOrg);

const getOrgFallbackRedirect = (pathname: string): string | null => {
  return pathname === '/organizations' ? null : '/organizations';
};

const getPermissionsFallbackRedirect = (
  pathname: string,
  effectivePermissions: string[]
): string | null => {
  if (canAccessPathByPermissions(pathname, effectivePermissions)) return null;
  const fallbackRoute = resolveFirstAccessibleAppRoute(effectivePermissions);
  if (fallbackRoute === pathname) return null;
  return fallbackRoute;
};

const applyDefaultLandingRedirect = (
  pathname: string,
  primaryOrgId: string,
  preferredLanding: string
): string | null => {
  const shouldEvaluateLanding = pathname === '/dashboard' || pathname === '/appointments';
  if (!shouldEvaluateLanding) return null;

  const landingAppliedKey = `yc_default_landing_applied:${primaryOrgId}`;
  const isLandingAlreadyApplied = getStorageItem('session', landingAppliedKey) === '1';

  if (preferredLanding !== pathname && !isLandingAlreadyApplied) {
    setStorageItem('session', landingAppliedKey, '1');
    return preferredLanding;
  }

  setStorageItem('session', landingAppliedKey, '1');
  return null;
};

/**
 * Guard for org-scoped routes.
 *
 * Rules:
 * - If no primary org → /organizations
 * - Owner:
 *    - isVerified === true:
 *        - if on /create-org → /dashboard
 *    - isVerified === false:
 *        - onboarding step < 3 → force /create-org
 *        - onboarding step === 3 → /dashboard
 * - Member:
 *    - isOnboarded === false → force /complete-profile
 *    - isOnboarded === true:
 *        - if on /complete-profile → /dashboard
 */
const OrgGuard = ({ children, skeleton = null }: OrgGuardProps) => {
  useLoadSubscriptionCounterForPrimaryOrg();
  useLoadSpecialitiesForPrimaryOrg();
  useLoadTeam();
  useLoadRoomsForPrimaryOrg();
  useLoadCompanionsForPrimaryOrg();
  useLoadAppointmentsForPrimaryOrg();
  useLoadInvoicesForPrimaryOrg();
  useLoadTasksForPrimaryOrg();
  useLoadDocumentsForPrimaryOrg();
  useLoadFormsForPrimaryOrg();
  useLoadIntegrationsForPrimaryOrg();

  const router = useRouter();
  const pathname = usePathname();

  const isAuthGuardDisabled = isLocalGuardBypassEnabled();

  const orgStatus = useOrgStore((s) => s.status);
  const primaryOrgId = useOrgStore((s) => s.primaryOrgId);
  const primaryOrg = useOrgStore((s) =>
    primaryOrgId ? ((s.orgsById[primaryOrgId] as Organisation | undefined) ?? null) : null
  );
  const resolvedBusinessType: BusinessType = primaryOrg?.type ?? 'GROOMER';
  useInventoryModule(resolvedBusinessType);
  const membership = useOrgStore((s) =>
    primaryOrgId ? (s.membershipsByOrgId[primaryOrgId] ?? null) : null
  );

  const specialityStatus = useSpecialityStore((s) => s.status);
  const specialityIdsByOrgId = useSpecialityStore((s) => s.specialityIdsByOrgId);
  const getSpecialitiesByOrgId = useSpecialityStore((s) => s.getSpecialitiesByOrgId);

  const availabilityStatus = useAvailabilityStore((s) => s.status);
  const getAvailabilitiesByOrgId = useAvailabilityStore((s) => s.getAvailabilitiesByOrgId);
  const teamStatus = useTeamStore((s) => s.status);
  const teamIdsByOrgId = useTeamStore((s) => s.teamIdsByOrgId);

  const profile = useUserProfileStore((s) =>
    primaryOrgId ? (s.profilesByOrgId[primaryOrgId] ?? null) : null
  );
  const profileStatus = useUserProfileStore((s) => s.status);

  const [checked, setChecked] = useState(
    () =>
      isLocalGuardBypassEnabled() ||
      (primaryOrgId ? readOrgGuardPassed(primaryOrgId) : readAnyOrgGuardPassed())
  );
  useFullscreenLoader('org-guard', !isAuthGuardDisabled && !checked);

  useEffect(() => {
    if (primaryOrgId && readOrgGuardPassed(primaryOrgId)) {
      setChecked(true);
    } else {
      setChecked(false);
    }
  }, [primaryOrgId]);

  useEffect(() => {
    if (isAuthGuardDisabled) {
      setChecked(true);
      return;
    }
    if (isStatusPending(orgStatus)) {
      return;
    }
    if (!primaryOrgId) {
      const orgFallbackRedirect = getOrgFallbackRedirect(pathname);
      if (orgFallbackRedirect) {
        router.replace(orgFallbackRedirect);
        return;
      }
      setChecked(true);
      return;
    }
    const hasTeamDataForOrg = !teamIdsByOrgId || Object.hasOwn(teamIdsByOrgId, primaryOrgId);
    if (
      shouldWaitForOrgGuardData(
        availabilityStatus,
        specialityStatus,
        profileStatus,
        teamStatus,
        hasTeamDataForOrg
      )
    ) {
      return;
    }

    if (!primaryOrg || !membership) {
      const orgFallbackRedirect = getOrgFallbackRedirect(pathname);
      if (orgFallbackRedirect) {
        router.replace(orgFallbackRedirect);
      }
      return;
    }

    const role = membership.roleDisplay ?? membership.roleCode;
    const shouldWaitForSpecialitiesForOrg =
      role.toLowerCase() === 'owner' &&
      !primaryOrg.isVerified &&
      specialityStatus !== 'error' &&
      !Object.hasOwn(specialityIdsByOrgId, primaryOrgId);
    if (shouldWaitForSpecialitiesForOrg) {
      return;
    }

    const specialities = getSpecialitiesByOrgId(primaryOrgId);
    const availabilities = getAvailabilitiesByOrgId(primaryOrgId);
    const redirectTo = resolveOrgRedirect({
      pathname,
      primaryOrgId,
      primaryOrg,
      membership,
      profile,
      specialities,
      availabilities,
    });

    if (redirectTo && redirectTo !== pathname) {
      router.replace(redirectTo);
      return;
    }

    const effectivePermissions = membership.effectivePermissions ?? [];
    const permissionsFallbackRedirect = getPermissionsFallbackRedirect(
      pathname,
      effectivePermissions
    );
    if (permissionsFallbackRedirect) {
      router.replace(permissionsFallbackRedirect);
      return;
    }

    const preferredLanding = resolveDefaultOpenScreenRouteForProfile({
      profile,
      orgType: primaryOrg.type,
      role,
    });
    const landingRedirect = applyDefaultLandingRedirect(pathname, primaryOrgId, preferredLanding);
    if (landingRedirect) {
      router.replace(landingRedirect);
      return;
    }

    writeOrgGuardPassed(primaryOrgId);
    setChecked(true);
  }, [
    isAuthGuardDisabled,
    primaryOrgId,
    primaryOrg,
    getSpecialitiesByOrgId,
    pathname,
    router,
    profile,
    orgStatus,
    getAvailabilitiesByOrgId,
    specialityStatus,
    availabilityStatus,
    profileStatus,
    membership,
    specialityIdsByOrgId,
    teamStatus,
    teamIdsByOrgId,
  ]);

  if (!checked) return <>{skeleton}</>;

  return <>{children}</>;
};

export default OrgGuard;
