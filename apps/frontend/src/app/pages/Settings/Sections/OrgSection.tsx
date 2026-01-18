import React, { useEffect, useMemo, useState } from "react";
import ProfileCard from "../../Organization/Sections/ProfileCard";
import Availability from "@/app/components/Availability/Availability";
import { usePrimaryOrgWithMembership } from "@/app/hooks/useOrgSelectors";
import { Primary } from "@/app/components/Buttons";
import {
  ApiOverrides,
  AvailabilityState,
  convertAvailability,
  daysOfWeek,
  DEFAULT_INTERVAL,
  hasAtLeastOneAvailability,
} from "@/app/components/Availability/utils";
import { upsertAvailability } from "@/app/services/availability";
import { usePrimaryAvailability } from "@/app/hooks/useAvailabiities";
import { usePrimaryOrgProfile } from "@/app/hooks/useProfiles";
import { Gender, UserProfile } from "@/app/types/profile";
import { upsertUserProfile } from "@/app/services/profileService";
import { GenderOptions } from "@/app/types/companion";
import { EmploymentTypes, RoleOptions } from "../../Organization/types";

const ProfessionalFields = [
  {
    label: "LinkedIn",
    key: "linkedin",
    required: false,
    editable: true,
    type: "text",
  },
  {
    label: "Medical license number",
    key: "medicalLicenseNumber",
    required: false,
    editable: true,
    type: "text",
  },
  {
    label: "Years of experience",
    key: "yearsOfExperience",
    required: true,
    editable: true,
    type: "number",
  },
  {
    label: "Specialisation",
    key: "specialization",
    required: true,
    editable: true,
    type: "text",
  },
  {
    label: "Qualification (MBBS, MD,etc.)",
    key: "qualification",
    required: true,
    editable: true,
    type: "text",
  },
  {
    label: "Biography or short description",
    key: "biography",
    required: false,
    editable: true,
    type: "text",
  },
];

const AddressFields = [
  {
    label: "Address line",
    key: "addressLine",
    required: true,
    editable: true,
    type: "text",
  },
  {
    label: "State / Province",
    key: "state",
    required: true,
    editable: true,
    type: "text",
  },
  {
    label: "City",
    key: "city",
    required: true,
    editable: true,
    type: "text",
  },
  {
    label: "Postal code",
    key: "postalCode",
    required: true,
    editable: true,
    type: "text",
  },
];

const OrgRelatedFields = [
  {
    label: "Name",
    key: "name",
    required: false,
    editable: false,
    type: "text",
  },
  {
    label: "Role",
    key: "roleDisplay",
    required: false,
    editable: false,
    type: "select",
    options: RoleOptions
  },
  {
    label: "Employment type",
    key: "employmentType",
    required: false,
    editable: false,
    type: "select",
    options: EmploymentTypes
  },
  {
    label: "Gender",
    key: "gender",
    required: false,
    editable: true,
    type: "select",
    options: GenderOptions,
  },
  {
    label: "Date of birth",
    key: "dateOfBirth",
    required: true,
    editable: true,
    type: "dateString",
  },
  {
    label: "Phone number",
    key: "phoneNumber",
    required: false,
    editable: true,
    type: "text",
  },
  {
    label: "Country",
    key: "country",
    required: false,
    editable: true,
    type: "country",
  },
];

const OrgSection = () => {
  const { org, membership } = usePrimaryOrgWithMembership();
  const { availabilities } = usePrimaryAvailability();
  const profile = usePrimaryOrgProfile();
  const [availability, setAvailability] = useState<AvailabilityState>(
    daysOfWeek.reduce<AvailabilityState>((acc, day) => {
      const isWeekday =
        day === "Monday" ||
        day === "Tuesday" ||
        day === "Wednesday" ||
        day === "Thursday" ||
        day === "Friday";

      acc[day] = {
        enabled: isWeekday,
        intervals: [{ ...DEFAULT_INTERVAL }],
      };
      return acc;
    }, {} as AvailabilityState)
  );
  const [overides, setOverides] = useState<ApiOverrides[]>([]);

  const orgInfoData = useMemo(
    () => ({
      name: org?.name ?? "",
      roleDisplay: membership?.roleDisplay ?? "",
      employmentType: profile?.personalDetails?.employmentType ?? "",
      gender: profile?.personalDetails?.gender ?? "",
      dateOfBirth: profile?.personalDetails?.dateOfBirth ?? "",
      phoneNumber: profile?.personalDetails?.phoneNumber ?? "",
      country: profile?.personalDetails?.address?.country ?? "",
    }),
    [org, membership, profile]
  );

  const addressData = useMemo(
    () => ({
      addressLine: profile?.personalDetails?.address?.addressLine ?? "",
      state: profile?.personalDetails?.address?.state ?? "",
      city: profile?.personalDetails?.address?.city ?? "",
      postalCode: profile?.personalDetails?.address?.postalCode ?? "",
    }),
    [profile]
  );

  const professionalData = useMemo(
    () => ({
      linkedin: profile?.professionalDetails?.linkedin ?? "",
      medicalLicenseNumber:
        profile?.professionalDetails?.medicalLicenseNumber ?? "",
      yearsOfExperience: profile?.professionalDetails?.yearsOfExperience ?? "",
      specialization: profile?.professionalDetails?.specialization ?? "",
      qualification: profile?.professionalDetails?.qualification ?? "",
      biography: profile?.professionalDetails?.biography ?? "",
    }),
    [profile]
  );

  useEffect(() => {
    if (availabilities) {
      setAvailability(availabilities);
    }
  }, [availabilities]);

  const handleClick = async () => {
    try {
      const converted = convertAvailability(availability);
      if (!hasAtLeastOneAvailability(converted)) {
        console.log("No availability selected");
        return;
      }
      await upsertAvailability(converted, null);
    } catch (error) {
      console.log(error);
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
    } catch (error) {
      console.log(error);
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
    } catch (error) {
      console.log(error);
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
    } catch (error) {
      console.log(error);
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
      <div className="border border-card-border rounded-2xl">
        <div className="px-6! py-3! border-b border-b-card-border flex items-center justify-between">
          <div className="text-body-3 text-text-primary">
            Availability
          </div>
        </div>
        <div className="flex flex-col px-6! py-6! gap-6">
          <Availability
            availability={availability}
            setAvailability={setAvailability}
            overides={overides}
            setOverides={setOverides}
          />
          <div className="w-full flex justify-end!">
            <Primary
              href="#"
              text="Save"
              onClick={handleClick}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrgSection;
