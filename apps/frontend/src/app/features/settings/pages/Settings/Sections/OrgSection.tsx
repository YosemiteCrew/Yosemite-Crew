import React, { useEffect, useMemo, useState } from 'react';
import { flushSync } from 'react-dom';
import ProfileCard from '@/app/features/organization/pages/Organization/Sections/ProfileCard';
import Availability from '@/app/features/appointments/components/Availability/Availability';
import { usePrimaryOrgWithMembership } from '@/app/hooks/useOrgSelectors';
import { Primary } from '@/app/ui/primitives/Buttons';
import {
  AvailabilityState,
  convertAvailability,
  daysOfWeek,
  DEFAULT_INTERVAL,
  hasAtLeastOneAvailability,
} from '@/app/features/appointments/components/Availability/utils';
import { upsertAvailability } from '@/app/features/organization/services/availabilityService';
import { usePrimaryAvailability } from '@/app/hooks/useAvailabiities';
import { usePrimaryOrgProfile } from '@/app/hooks/useProfiles';
import { Gender, UserProfile } from '@/app/features/users/types/profile';
import { upsertUserProfile } from '@/app/features/organization/services/profileService';
import { GenderOptions } from '@/app/features/companions/types/companion';
import { EmploymentTypes, RoleOptions } from '@/app/features/organization/pages/Organization/types';
import { useNotify } from '@/app/hooks/useNotify';
import { resolveTimezoneFromCountry, setPreferredTimeZone } from '@/app/lib/timezone';

const ProfessionalFields = [
  {
    label: 'LinkedIn',
    key: 'linkedin',
    required: false,
    editable: true,
    type: 'text',
  },
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
  {
    label: 'Specialisation',
    key: 'specialization',
    required: true,
    editable: true,
    type: 'text',
  },
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

const AddressFields = [
  {
    label: 'Address line',
    key: 'addressLine',
    required: true,
    editable: true,
    type: 'googleAddress',
  },
  {
    label: 'State / Province',
    key: 'state',
    required: true,
    editable: true,
    type: 'text',
  },
  {
    label: 'City',
    key: 'city',
    required: true,
    editable: true,
    type: 'text',
  },
  {
    label: 'Postal code',
    key: 'postalCode',
    required: true,
    editable: true,
    type: 'text',
  },
];

const OrgRelatedFields = [
  {
    label: 'Name',
    key: 'name',
    required: false,
    editable: false,
    type: 'text',
  },
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
    options: EmploymentTypes,
  },
  {
    label: 'Gender',
    key: 'gender',
    required: false,
    editable: true,
    type: 'select',
    options: GenderOptions,
  },
  {
    label: 'Date of birth',
    key: 'dateOfBirth',
    required: true,
    editable: true,
    type: 'dateString',
  },
  {
    label: 'Phone number',
    key: 'phoneNumber',
    required: false,
    editable: true,
    type: 'text',
  },
  {
    label: 'Country',
    key: 'country',
    required: false,
    editable: true,
    type: 'country',
  },
];

const OrgSection = () => {
  const { org, membership } = usePrimaryOrgWithMembership();
  const { availabilities } = usePrimaryAvailability();
  const { notify } = useNotify();
  const profile = usePrimaryOrgProfile();
  const [availability, setAvailability] = useState<AvailabilityState>(
    daysOfWeek.reduce<AvailabilityState>((acc, day) => {
      const isWeekday =
        day === 'Monday' ||
        day === 'Tuesday' ||
        day === 'Wednesday' ||
        day === 'Thursday' ||
        day === 'Friday';

      acc[day] = {
        enabled: isWeekday,
        intervals: [{ ...DEFAULT_INTERVAL }],
      };
      return acc;
    }, {} as AvailabilityState)
  );
  const [isSavingAvailability, setIsSavingAvailability] = useState(false);
  const orgInfoData = useMemo(
    () => ({
      name: org?.name ?? '',
      roleDisplay: membership?.roleDisplay ?? '',
      employmentType: profile?.personalDetails?.employmentType ?? '',
      gender: profile?.personalDetails?.gender ?? '',
      dateOfBirth: profile?.personalDetails?.dateOfBirth ?? '',
      phoneNumber: profile?.personalDetails?.phoneNumber ?? '',
      country: profile?.personalDetails?.address?.country ?? '',
    }),
    [org, membership, profile]
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

  useEffect(() => {
    if (availabilities) {
      setAvailability(availabilities);
    }
  }, [availabilities]);

  const handleClick = async () => {
    if (isSavingAvailability) return;
    try {
      flushSync(() => {
        setIsSavingAvailability(true);
      });
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 0);
      });
      const converted = convertAvailability(availability);
      if (!hasAtLeastOneAvailability(converted)) {
        console.log('No availability selected');
        return;
      }
      await upsertAvailability(converted, null);
      notify('success', {
        title: 'Availability updated',
        text: 'Availability have been updated successfully.',
      });
    } catch (error) {
      console.log(error);
      notify('error', {
        title: 'Unable to update availability details',
        text: 'Failed to update availability details. Please try again.',
      });
    } finally {
      setIsSavingAvailability(false);
    }
  };

  if (!org || !membership) return null;

  const updateOrgFields = async (values: any) => {
    try {
      if (!profile) return;
      const payload: UserProfile = {
        ...profile,
        _id: profile?._id,
        personalDetails: {
          ...profile?.personalDetails,
          gender: values.gender as Gender,
          dateOfBirth: values.dateOfBirth,
          phoneNumber: values.phoneNumber,
          address: {
            ...profile?.personalDetails?.address,
            country: values.country,
          },
        },
      };
      await upsertUserProfile(payload);
      const resolvedTimezone = resolveTimezoneFromCountry(values.country);
      if (resolvedTimezone) {
        setPreferredTimeZone(resolvedTimezone);
      }
      notify('success', {
        title: 'Personal details updated',
        text: resolvedTimezone
          ? `Personal details have been updated successfully. Timezone set to ${resolvedTimezone}.`
          : 'Personal details have been updated successfully.',
      });
    } catch (error) {
      console.log(error);
      notify('error', {
        title: 'Unable to update personal details',
        text: 'Failed to update personal details. Please try again.',
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

  return (
    <div className="flex flex-col gap-6">
      <ProfileCard
        title="Org Details"
        fields={OrgRelatedFields}
        org={orgInfoData}
        onSave={updateOrgFields}
      />
      <div className="border border-card-border rounded-2xl">
        <div className="px-6! py-3! border-b border-b-card-border flex items-center justify-between">
          <div className="text-body-3 text-text-primary">Availability</div>
        </div>
        <div className="flex flex-col px-6! py-6! gap-6">
          <Availability
            availability={availability}
            setAvailability={setAvailability}
            twoColumnLayout
          />
          <div className="w-full flex justify-end!">
            <Primary
              href="#"
              text={isSavingAvailability ? 'Saving...' : 'Save'}
              onClick={handleClick}
              isDisabled={isSavingAvailability}
            />
          </div>
        </div>
      </div>
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

export default OrgSection;
