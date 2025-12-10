import { useMemo } from "react";
import { useOrgStore } from "@/app/stores/orgStore";
import { UserProfile } from "../types/profile";
import {
  computeTeamOnboardingStep,
  TeamOnboardingStep,
} from "../utils/teamOnboarding";
import { useUserProfileStore } from "../stores/profileStore";

export const useTeamOnboarding = (
  orgId: string | null
): {
  profile: UserProfile | null;
  step: TeamOnboardingStep;
  slots: any[];
  shouldRedirectToOrganizations: boolean;
} => {
  const profile = useUserProfileStore((s) =>
    orgId
      ? ((s.profilesByOrgId[orgId] as UserProfile | undefined) ?? null)
      : null
  );
  const membership = useOrgStore((s) =>
    orgId ? (s.membershipsByOrgId[orgId] ?? null) : null
  );
  const orgStatus = useOrgStore((s) => s.status);

  const { step, slots, effectiveprofile, shouldRedirectToOrganizations } =
    useMemo(() => {
      if (!orgId) {
        return {
          step: 0 as TeamOnboardingStep,
          slots: [] as any[],
          effectiveprofile: null as UserProfile | null,
          shouldRedirectToOrganizations: true,
        };
      }
      if (orgStatus === "loading" || orgStatus === "idle") {
        return {
          step: 0 as TeamOnboardingStep,
          slots: [],
          effectiveprofile: null,
          shouldRedirectToOrganizations: false,
        };
      }
      if (!membership) {
        return {
          step: 0 as TeamOnboardingStep,
          slots: [] as any[],
          effectiveprofile: null as UserProfile | null,
          shouldRedirectToOrganizations: true,
        };
      }
      const role = (
        membership.roleDisplay ??
        membership.roleCode ??
        ""
      ).toLowerCase();
      const isOwner = role === "owner";

      if (isOwner) {
        return {
          step: 3 as TeamOnboardingStep,
          slots: [] as any[],
          effectiveprofile: null as UserProfile | null,
          shouldRedirectToOrganizations: false,
        };
      }

      if (!profile) {
        return {
          step: 0 as TeamOnboardingStep,
          slots: [] as any[],
          effectiveprofile: null as UserProfile | null,
          shouldRedirectToOrganizations: false,
        };
      }

      const step = computeTeamOnboardingStep(profile, []);

      return {
        step,
        effectiveprofile: profile,
        slots: [],
        shouldRedirectToOrganizations: false,
      };
    }, [orgId, profile, membership, orgStatus]);

  return {
    profile: effectiveprofile,
    slots: slots,
    step: step,
    shouldRedirectToOrganizations,
  };
};
