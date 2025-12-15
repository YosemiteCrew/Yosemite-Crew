import type { Organisation, Speciality } from "@yosemite-crew/types";

export type OnboardingStep = 0 | 1 | 2 | 3;

export const computeOrgOnboardingStep = (
  org: Organisation | null | undefined,
  specialities: Speciality[]
): OnboardingStep => {
  if (!org) return 0;

  const hasStep1 =
    !!org.name && !!org.taxId && !!org.phoneNo && !!org.address?.country;

  if (!hasStep1) return 0;

  const hasStep2 =
    !!org.address?.addressLine &&
    !!org.address?.city &&
    !!org.address?.postalCode &&
    !!org.address?.state;
  if (!hasStep2) return 1;

  const hasStep3 = specialities.length > 0;
  if (!hasStep3) return 2;

  return 3;
};
