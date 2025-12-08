import { useMemo } from "react";
import { useOrgStore } from "@/app/stores/orgStore";
import { useSpecialityStore } from "@/app/stores/specialityStore";
import {
  computeOrgOnboardingStep,
  OnboardingStep,
} from "@/app/utils/orgOnboarding";
import type { Organisation, Speciality } from "@yosemite-crew/types";

export const usePrimaryOrgOnboarding = (): {
  org: Organisation | null;
  step: OnboardingStep;
  specialities: Speciality[];
} => {
  const primaryOrgId = useOrgStore((s) => s.primaryOrgId);
  const org = useOrgStore((s) =>
    primaryOrgId
      ? ((s.orgsById[primaryOrgId] as Organisation | undefined) ?? null)
      : null
  );
  const membership = useOrgStore((s) =>
    primaryOrgId ? (s.membershipsByOrgId[primaryOrgId] ?? null) : null
  );

  const specialitiesById = useSpecialityStore((s) => s.specialitiesById);
  const specialityIdsByOrgId = useSpecialityStore(
    (s) => s.specialityIdsByOrgId
  );

  const { step, specialities, effectiveOrg } = useMemo(() => {
    if (!primaryOrgId || !org) {
      return {
        step: 0 as OnboardingStep,
        specialities: [] as Speciality[],
        effectiveOrg: null as Organisation | null,
      };
    }
    if (!membership) {
      return {
        step: 0 as OnboardingStep,
        specialities: [] as Speciality[],
        effectiveOrg: null as Organisation | null,
      };
    }

    const role = (
      membership.roleDisplay ??
      membership.roleCode ??
      ""
    ).toLowerCase();
    const isOwner = role === "owner";

    if (!isOwner) {
      // Non-owner → cannot access prefill
      return {
        step: 0 as OnboardingStep,
        specialities: [] as Speciality[],
        effectiveOrg: null as Organisation | null,
      };
    }

    const ids = specialityIdsByOrgId[primaryOrgId] ?? [];
    const specialities = ids
      .map((id) => specialitiesById[id])
      .filter((s): s is Speciality => s != null);

    const step = computeOrgOnboardingStep(org, specialities);

    if (step === 3) {
      return {
        step: 0 as OnboardingStep,
        specialities: [] as Speciality[],
        effectiveOrg: null as Organisation | null,
      };
    }

    return { step, specialities, effectiveOrg: org };
  }, [primaryOrgId, org, specialitiesById, specialityIdsByOrgId]);

  return {
    org: effectiveOrg,
    step,
    specialities,
  };
};
