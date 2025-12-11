import { useMemo } from "react";
import { useOrgStore } from "@/app/stores/orgStore";
import { UserProfile } from "../types/profile";
import {
  computeTeamOnboardingStep,
  TeamOnboardingStep,
} from "../utils/teamOnboarding";
import { useUserProfileStore } from "../stores/profileStore";
import { useAvailabilityStore } from "../stores/availabilityStore";
import { ApiDayAvailability } from "../components/Availability/utils";

export const useTeamOnboarding = (
  orgId: string | null
): {
  profile: UserProfile | null;
  step: TeamOnboardingStep;
  slots: ApiDayAvailability[];
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
  const availabilityStatus = useAvailabilityStore((s) => s.status);
  const availabilitiesById = useAvailabilityStore((s) => s.availabilitiesById);
  const availabilityIdsByOrgId = useAvailabilityStore(
    (s) => s.availabilityIdsByOrgId
  );

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
      if (
        orgStatus === "loading" ||
        orgStatus === "idle" ||
        availabilityStatus === "loading" ||
        availabilityStatus === "idle"
      ) {
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
      };
    }, [
      orgId,
      profile,
      membership,
      orgStatus,
      availabilityStatus,
      availabilitiesById,
      availabilityIdsByOrgId,
    ]);

  return {
    profile: effectiveprofile,
    slots: slots,
    step: step,
    shouldRedirectToOrganizations,
  };
};
