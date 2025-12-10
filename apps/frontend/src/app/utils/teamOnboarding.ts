import { UserProfile } from "../types/profile";

export type TeamOnboardingStep = 0 | 1 | 2 | 3;

export const computeTeamOnboardingStep = (
  profile: UserProfile | null | undefined,
  slots: any[]
): TeamOnboardingStep => {
  if (!profile) return 0;

  const personal = profile.personalDetails;
  const professional = profile.professionalDetails;

  const hasStep1 =
    !!personal?.dateOfBirth &&
    !!personal?.gender &&
    !!personal?.phoneNumber &&
    !!personal?.address?.addressLine &&
    !!personal?.address?.city &&
    !!personal?.address?.state &&
    !!personal?.address?.postalCode &&
    !!personal?.address?.country;

  if (!hasStep1) return 0;

  const hasStep2 =
    !!professional?.qualification &&
    !!professional?.yearsOfExperience &&
    !!professional?.specialization;

  if (!hasStep2) return 1;

  const hasStep3 = slots.length > 0;

  if (!hasStep3) return 2;

  return 3;
};
