import { useMemo } from "react";
import { useOrgStore } from "@/app/stores/orgStore";
import { useSpecialityStore } from "@/app/stores/specialityStore";
import {
  computeOrgOnboardingStep,
  OnboardingStep,
} from "@/app/utils/orgOnboarding";
import type { Organisation, Speciality } from "@yosemite-crew/types";

export const useOrgOnboarding = (
  orgId: string | null
): {
  org: Organisation | null;
  step: OnboardingStep;
  specialities: Speciality[];
} => {
  const org = useOrgStore((s) =>
    orgId ? ((s.orgsById[orgId] as Organisation | undefined) ?? null) : null
  );
  const membership = useOrgStore((s) =>
    orgId ? (s.membershipsByOrgId[orgId] ?? null) : null
  );

  const specialitiesById = useSpecialityStore((s) => s.specialitiesById);
  const specialityIdsByOrgId = useSpecialityStore(
    (s) => s.specialityIdsByOrgId
  );

  const { step, specialities, effectiveOrg } = useMemo(() => {
    if (!orgId || !org || !membership) {
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
      return {
        step: 0 as OnboardingStep,
        specialities: [] as Speciality[],
        effectiveOrg: null as Organisation | null,
      };
    }

    const ids = specialityIdsByOrgId[orgId] ?? [];
    const specialities = ids
      .map((id) => specialitiesById[id])
      .filter((s): s is Speciality => s != null);

    const step = computeOrgOnboardingStep(org, specialities);

    return { step, specialities, effectiveOrg: org };
  }, [orgId, org, specialitiesById, specialityIdsByOrgId, membership]);

  return {
    org: effectiveOrg,
    step,
    specialities,
  };
};
