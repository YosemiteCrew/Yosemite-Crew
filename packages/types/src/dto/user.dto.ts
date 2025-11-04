import type { Practitioner } from "@yosemite-crew/fhirtypes";
import type { User } from "../user";
import type { UserProfile } from "../userProfile";
import { toFHIRPractitioner } from "../user";

export type UserResponseDTO = Practitioner;

export interface ToUserResponseDTOParams {
  user: User;
  profile?: UserProfile;
}

export const toUserResponseDTO = ({
  user,
  profile,
}: ToUserResponseDTOParams): UserResponseDTO => toFHIRPractitioner(user, profile);
