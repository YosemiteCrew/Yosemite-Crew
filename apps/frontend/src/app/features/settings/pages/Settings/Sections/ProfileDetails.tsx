import React, { useMemo } from 'react';
import ProfileCard from '@/app/features/organization/pages/Organization/Sections/ProfileCard';
import { usePrimaryOrgWithMembership } from '@/app/hooks/useOrgSelectors';
import { usePrimaryOrgProfile } from '@/app/hooks/useProfiles';
import {
  Gender,
  UserProfile,
  UserEmploymentTypeOptions,
  UserGenderOptions,
} from '@/app/features/users/types/profile';
import { upsertUserProfile } from '@/app/features/organization/services/profileService';
import { updateUser } from '@/app/features/users/services/userService';
import { RoleOptions } from '@/app/features/organization/pages/Organization/types';
import { useNotify } from '@/app/hooks/useNotify';
import { resolveTimezoneFromCountry, setPreferredTimeZone } from '@/app/lib/timezone';
import { useAuthStore } from '@/app/stores/authStore';

const UserOrgProfileFields = [
  { label: 'First name', key: 'given_name', required: true, editable: true, type: 'text' },
  { label: 'Last name', key: 'family_name', required: true, editable: true, type: 'text' },
  { label: 'Email address', key: 'email', required: true, editable: false, type: 'text' },
  { label: 'Org name', key: 'name', required: false, editable: false, type: 'text' },
  {
    label: 'Role',
    key: 'roleDisplay',
    required: false,
    editable: false,
    type: 'select',
    options: RoleOptions,
  },
  {
    label: 'Employment type',
    key: 'employmentType',
    required: false,
    editable: false,
    type: 'select',
    options: UserEmploymentTypeOptions,
  },
  { label: '', key: '_sep1', required: false, editable: false, type: 'separator' },
  {
    label: 'Gender',
    key: 'gender',
    required: false,
    editable: true,
    type: 'select',
    options: UserGenderOptions,
  },
  {
    label: 'Date of birth',
    key: 'dateOfBirth',
    required: true,
    editable: true,
    type: 'dateString',
  },
  { label: 'Phone number', key: 'phoneNumber', required: false, editable: true, type: 'text' },
  { label: 'Country', key: 'country', required: false, editable: true, type: 'country' },
];

const AddressFields = [
  {
    label: 'Address line',
    key: 'addressLine',
    required: true,
    editable: true,
    type: 'googleAddress',
  },
  { label: 'State / Province', key: 'state', required: true, editable: true, type: 'text' },
  { label: 'City', key: 'city', required: true, editable: true, type: 'text' },
  { label: 'Postal code', key: 'postalCode', required: true, editable: true, type: 'text' },
];

const ProfessionalFields = [
  { label: 'LinkedIn', key: 'linkedin', required: false, editable: true, type: 'text' },
  {
    label: 'Medical license number',
    key: 'medicalLicenseNumber',
    required: false,
    editable: true,
    type: 'text',
  },
  {
    label: 'Years of experience',
    key: 'yearsOfExperience',
    required: true,
    editable: true,
    type: 'number',
  },
  { label: 'Specialisation', key: 'specialization', required: true, editable: true, type: 'text' },
  {
    label: 'Qualification (MBBS, MD,etc.)',
    key: 'qualification',
    required: true,
    editable: true,
    type: 'text',
  },
  {
    label: 'Biography or short description',
    key: 'biography',
    required: false,
    editable: true,
    type: 'text',
  },
];

/**
 * The three editable personal-profile cards (identity, address, professional
 * details) that live behind the Settings "Edit profile" affordance. Split out of
 * the old inline OrgSection so they can sit inside the profile modal without the
 * availability editor, which now has its own "Edit hours" modal.
 */
const ProfileDetails = () => {
  const attributes = useAuthStore((s) => s.attributes);
  const { org, membership } = usePrimaryOrgWithMembership();
  const { notify } = useNotify();
  const profile = usePrimaryOrgProfile();

  const userOrgProfileData = useMemo(
    () => ({
      given_name: attributes?.given_name ?? '',
      family_name: attributes?.family_name ?? '',
      email: attributes?.email ?? '',
      name: org?.name ?? '',
      roleDisplay: membership?.roleDisplay ?? '',
      employmentType: profile?.personalDetails?.employmentType ?? '',
      gender: profile?.personalDetails?.gender ?? '',
      dateOfBirth: profile?.personalDetails?.dateOfBirth ?? '',
      phoneNumber: profile?.personalDetails?.phoneNumber ?? '',
      country: profile?.personalDetails?.address?.country ?? '',
    }),
    [attributes, org, membership, profile]
  );

  const addressData = useMemo(
    () => ({
      addressLine: profile?.personalDetails?.address?.addressLine ?? '',
      state: profile?.personalDetails?.address?.state ?? '',
      city: profile?.personalDetails?.address?.city ?? '',
      postalCode: profile?.personalDetails?.address?.postalCode ?? '',
    }),
    [profile]
  );

  const professionalData = useMemo(
    () => ({
      linkedin: profile?.professionalDetails?.linkedin ?? '',
      medicalLicenseNumber: profile?.professionalDetails?.medicalLicenseNumber ?? '',
      yearsOfExperience: profile?.professionalDetails?.yearsOfExperience ?? '',
      specialization: profile?.professionalDetails?.specialization ?? '',
      qualification: profile?.professionalDetails?.qualification ?? '',
      biography: profile?.professionalDetails?.biography ?? '',
    }),
    [profile]
  );

  const updateUserOrgProfileFields = async (values: any) => {
    try {
      await updateUser(values.given_name, values.family_name);
      if (profile) {
        const payload: UserProfile = {
          ...profile,
          _id: profile._id,
          personalDetails: {
            ...profile.personalDetails,
            gender: values.gender as Gender,
            dateOfBirth: values.dateOfBirth,
            phoneNumber: values.phoneNumber,
            address: {
              ...profile.personalDetails?.address,
              country: values.country,
            },
          },
        };
        await upsertUserProfile(payload);
        const resolvedTimezone = resolveTimezoneFromCountry(values.country);
        if (resolvedTimezone) setPreferredTimeZone(resolvedTimezone);
      }
      notify('success', {
        title: 'Profile updated',
        text: 'User profile has been updated successfully.',
      });
    } catch (error) {
      console.log(error);
      notify('error', {
        title: 'Unable to update profile',
        text: 'Failed to update user profile. Please try again.',
      });
    }
  };

  const updateAddressFields = async (values: any) => {
    try {
      if (!profile) return;
      const payload: UserProfile = {
        ...profile,
        _id: profile?._id,
        personalDetails: {
          ...profile?.personalDetails,
          address: {
            ...profile?.personalDetails?.address,
            addressLine: values.addressLine,
            state: values.state,
            city: values.city,
            postalCode: values.postalCode,
          },
        },
      };
      await upsertUserProfile(payload);
      notify('success', {
        title: 'Address details updated',
        text: 'Address details have been updated successfully.',
      });
    } catch (error) {
      console.log(error);
      notify('error', {
        title: 'Unable to update address details',
        text: 'Failed to update address details. Please try again.',
      });
    }
  };

  const updateProfessionalFields = async (values: any) => {
    try {
      if (!profile) return;
      const payload: UserProfile = {
        ...profile,
        _id: profile?._id,
        professionalDetails: {
          ...profile?.professionalDetails,
          linkedin: values.linkedin,
          medicalLicenseNumber: values.medicalLicenseNumber,
          specialization: values.specialization,
          qualification: values.qualification,
          biography: values.biography,
          yearsOfExperience: values.yearsOfExperience,
        },
      };
      await upsertUserProfile(payload);
      notify('success', {
        title: 'Professional details updated',
        text: 'Professional details have been updated successfully.',
      });
    } catch (error) {
      console.log(error);
      notify('error', {
        title: 'Unable to update professional details',
        text: 'Failed to update professional details. Please try again.',
      });
    }
  };

  if (!attributes || !org || !membership) return null;

  return (
    <div className="flex flex-col gap-4">
      <ProfileCard
        title="User profile"
        fields={UserOrgProfileFields}
        org={userOrgProfileData}
        showProfileUser
        onSave={updateUserOrgProfileFields}
      />
      <ProfileCard
        title="Address"
        fields={AddressFields}
        org={addressData}
        onSave={updateAddressFields}
      />
      <ProfileCard
        title="Professional details"
        fields={ProfessionalFields}
        org={professionalData}
        onSave={updateProfessionalFields}
      />
    </div>
  );
};

export default ProfileDetails;
