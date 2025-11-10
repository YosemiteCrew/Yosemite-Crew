import type {User} from '@/features/auth/types';
import type {ParentProfileSummary} from '@/features/profile/services/profileService';

const mapAddress = (
  address?: ParentProfileSummary['address'],
): User['address'] | undefined => {
  if (!address) {
    return undefined;
  }

  if (
    !address.addressLine &&
    !address.city &&
    !address.state &&
    !address.postalCode &&
    !address.country
  ) {
    return undefined;
  }

  return {
    addressLine: address.addressLine,
    city: address.city,
    stateProvince: address.state,
    postalCode: address.postalCode,
    country: address.country,
  };
};

export const mergeUserWithParentProfile = (
  base: User,
  parent?: ParentProfileSummary,
): User => {
  if (!parent) {
    return base;
  }

  const profileImage = parent.profileImageUrl ?? base.profilePicture;

  return {
    ...base,
    firstName: parent.firstName ?? base.firstName,
    lastName: parent.lastName ?? base.lastName,
    phone: parent.phoneNumber ?? base.phone,
    dateOfBirth: parent.birthDate ?? base.dateOfBirth,
    profilePicture: profileImage ?? base.profilePicture,
    profileToken: profileImage ?? base.profileToken,
    address: mapAddress(parent.address) ?? base.address,
    profileCompleted: parent.isComplete ?? base.profileCompleted,
  };
};
