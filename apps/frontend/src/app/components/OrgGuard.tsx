"use client";

import React, { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";

import { useOrgStore } from "@/app/stores/orgStore";
import { useSpecialityStore } from "@/app/stores/specialityStore";
import { computeOrgOnboardingStep } from "@/app/utils/orgOnboarding";
import type { Organisation, Speciality } from "@yosemite-crew/types";
import { useLoadOrg } from "../hooks/useLoadOrg";
import { useLoadSpecialitiesForPrimaryOrg } from "../hooks/useSpecialities";
import { useLoadTeam } from "../hooks/useTeam";
import { useLoadProfiles } from "../hooks/useProfiles";
import { useUserProfileStore } from "../stores/profileStore";
import { computeTeamOnboardingStep } from "../utils/teamOnboarding";

type OrgGuardProps = {
  children: React.ReactNode;
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
const OrgGuard = ({ children }: OrgGuardProps) => {
  useLoadOrg();
  useLoadSpecialitiesForPrimaryOrg();
  useLoadTeam();
  useLoadProfiles();

  const router = useRouter();
  const pathname = usePathname();

  const orgStatus = useOrgStore((s) => s.status);
  const primaryOrgId = useOrgStore((s) => s.primaryOrgId);
  const primaryOrg = useOrgStore((s) =>
    primaryOrgId
      ? ((s.orgsById[primaryOrgId] as Organisation | undefined) ?? null)
      : null
  );
  const membership = useOrgStore((s) =>
    primaryOrgId ? (s.membershipsByOrgId[primaryOrgId] ?? null) : null
  );

  const getSpecialitiesByOrgId = useSpecialityStore(
    (s) => s.getSpecialitiesByOrgId
  );

  const profile = useUserProfileStore((s) =>
    primaryOrgId ? (s.profilesByOrgId[primaryOrgId] ?? null) : null
  );

  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (orgStatus === "idle" || orgStatus === "loading") {
      return;
    }

    if (!primaryOrgId || !primaryOrg || !membership) {
      if (pathname !== "/organizations") {
        router.replace("/organizations");
      }
      return;
    }

    const specialities: Speciality[] = getSpecialitiesByOrgId(primaryOrgId);
    const step = computeOrgOnboardingStep(primaryOrg, specialities);
    const profileStep = computeTeamOnboardingStep(profile, []);
    const isVerified = primaryOrg.isVerified;
    const role = membership.roleDisplay ?? membership.roleCode;
    let redirectTo: string | null = null;

    if (role.toLowerCase() === "owner") {
      if (!isVerified) {
        if (step < 3) {
          // onboarding step < 3 → force /create-org
          redirectTo = "/create-org?orgId=" + primaryOrgId;
        } else if (step === 3 && pathname !== "/dashboard") {
          // onboarding step === 3 → /dashboard
          redirectTo = "/dashboard";
        }
      }
    } else {
      // NON-OWNER LOGIC
      if (profileStep < 3) {
        if (pathname !== "/organizations") {
          redirectTo = "/team-onboarding?orgId=" + primaryOrgId;
        }
      }
    }

    if (redirectTo && redirectTo !== pathname) {
      router.replace(redirectTo);
      return;
    }

    setChecked(true);
  }, [primaryOrgId, primaryOrg, getSpecialitiesByOrgId, pathname, router, profile, orgStatus]);

  if (!checked) return null;

  return <>{children}</>;
};

export default OrgGuard;
