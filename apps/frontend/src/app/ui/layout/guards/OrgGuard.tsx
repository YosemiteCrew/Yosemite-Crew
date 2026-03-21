'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';

import { useOrgStore } from '@/app/stores/orgStore';
import { useSpecialityStore } from '@/app/stores/specialityStore';
import { computeOrgOnboardingStep } from '@/app/lib/orgOnboarding';
import type { Organisation, Speciality, UserOrganization } from '@yosemite-crew/types';
import type { UserProfile } from '@/app/features/users/types/profile';
import { useLoadTeam } from '@/app/hooks/useTeam';
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
import { resolveDefaultOpenScreenRoute } from '@/app/lib/defaultOpenScreen';

type OrgGuardProps = {
  children: React.ReactNode;
};

const isStatusPending = (status?: string) => status === 'idle' || status === 'loading';

type RedirectParams = {
  pathname: string;
  primaryOrgId: string;
  primaryOrg: Organisation;
  membership: UserOrganization;
  profile: UserProfile | null | undefined;
  specialities: Speciality[];
  availabilities: ApiDayAvailability[];
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
  const isVerified = primaryOrg.isVerified;
  const role = membership.roleDisplay ?? membership.roleCode;

  if (role.toLowerCase() === 'owner') {
    if (!isVerified) {
      if (step < 3) {
        return `/create-org?orgId=${primaryOrgId}`;
      }
      if (step === 3) {
        if (pathname === '/organization' || pathname === '/book-onboarding') {
          return '';
        }
        return '/dashboard';
      }
    }
    return null;
  }

  if (profileStep < 3 && pathname !== '/organizations') {
    return `/team-onboarding?orgId=${primaryOrgId}`;
  }

  return null;
};

const shouldWaitForOrgGuardData = (
  availabilityStatus: string,
  specialityStatus: string,
  profileStatus: string
) =>
  isStatusPending(availabilityStatus) ||
  isStatusPending(specialityStatus) ||
  isStatusPending(profileStatus);

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
const OrgGuard = ({ children }: OrgGuardProps) => {
  useLoadSubscriptionCounterForPrimaryOrg();
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

  // Check if auth guard is disabled via environment variable
  const isAuthGuardDisabled = process.env.NEXT_PUBLIC_DISABLE_AUTH_GUARD === 'true';

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
  const getSpecialitiesByOrgId = useSpecialityStore((s) => s.getSpecialitiesByOrgId);

  const availabilityStatus = useAvailabilityStore((s) => s.status);
  const getAvailabilitiesByOrgId = useAvailabilityStore((s) => s.getAvailabilitiesByOrgId);

  const profile = useUserProfileStore((s) =>
    primaryOrgId ? (s.profilesByOrgId[primaryOrgId] ?? null) : null
  );
  const profileStatus = useUserProfileStore((s) => s.status);

  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (isAuthGuardDisabled) {
      setChecked(true);
      return;
    }
    if (isStatusPending(orgStatus)) {
      return;
    }
    if (!primaryOrgId) {
      if (pathname !== '/organizations') {
        router.replace('/organizations');
        return;
      }
      setChecked(true);
      return;
    }
    if (shouldWaitForOrgGuardData(availabilityStatus, specialityStatus, profileStatus)) {
      return;
    }

    if (!primaryOrg || !membership) {
      if (pathname !== '/organizations') {
        router.replace('/organizations');
      }
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

    const role = membership.roleDisplay ?? membership.roleCode;
    const preferredLanding = resolveDefaultOpenScreenRoute(role);
    const shouldEvaluateLanding = pathname === '/dashboard' || pathname === '/appointments';
    const landingAppliedKey = `yc_default_landing_applied:${primaryOrgId}`;
    const isLandingAlreadyApplied =
      globalThis.window?.sessionStorage.getItem(landingAppliedKey) === '1';

    if (shouldEvaluateLanding && preferredLanding !== pathname && !isLandingAlreadyApplied) {
      globalThis.window?.sessionStorage.setItem(landingAppliedKey, '1');
      router.replace(preferredLanding);
      return;
    }
    if (shouldEvaluateLanding) {
      globalThis.window?.sessionStorage.setItem(landingAppliedKey, '1');
    }

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
  ]);

  if (!checked) return null;

  return <>{children}</>;
};

export default OrgGuard;
