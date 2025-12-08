import AccordionButton from "@/app/components/Accordion/AccordionButton";
import React from "react";
import ProfileCard from "../../Organization/Sections/ProfileCard";
import Availability from "@/app/components/Availability/Availability";
import { usePrimaryOrgWithMembership } from "@/app/hooks/useOrgSelectors";

const ProfessionalFields = [
  {
    label: "LinkedIn",
    key: "linkedIn",
    required: true,
    editable: true,
    type: "text",
  },
  {
    label: "Medical license number",
    key: "license",
    required: true,
    editable: true,
    type: "text",
  },
  {
    label: "Years of experience",
    key: "experience",
    required: true,
    editable: true,
    type: "text",
  },
  {
    label: "Specialisation",
    key: "specialisation",
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
    required: true,
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
    required: true,
    editable: false,
    type: "text",
  },
  {
    label: "Role",
    key: "roleDisplay",
    required: true,
    editable: false,
    type: "text",
  },
  {
    label: "Department",
    key: "department",
    required: true,
    editable: false,
    type: "text",
  },
  {
    label: "Employment type",
    key: "employmentType",
    required: true,
    editable: false,
    type: "text",
  },
  {
    label: "Gender",
    key: "gender",
    required: true,
    editable: true,
    type: "text",
  },
  {
    label: "Date of birth",
    key: "dob",
    required: true,
    editable: true,
    type: "text",
  },
  {
    label: "Phone number",
    key: "phone",
    required: true,
    editable: true,
    type: "text",
  },
  {
    label: "Country",
    key: "country",
    required: true,
    editable: true,
    type: "text",
  },
];

const OrgSection = () => {
  const { org, membership } = usePrimaryOrgWithMembership();

  if (!org || !membership) return null;

  return (
    <AccordionButton title="Org Details" defaultOpen showButton={false}>
      <div className="flex flex-col gap-4">
        <ProfileCard
          title="Info"
          fields={OrgRelatedFields}
          org={{ ...org, ...membership }}
        />
        <ProfileCard
          title="Address"
          fields={AddressFields}
          org={{ ...org, ...membership }}
        />
        <ProfileCard
          title="Professional details"
          fields={ProfessionalFields}
          org={{ ...org, ...membership }}
        />
        <div className="border border-grey-light rounded-2xl">
          <div className="px-6! py-4! border-b border-b-grey-light flex items-center justify-between">
            <div className="font-grotesk font-medium text-black-text text-[19px]">
              Availability
            </div>
          </div>
          <div className="px-10! py-10!">
            <Availability />
          </div>
        </div>
      </div>
    </AccordionButton>
  );
};

export default OrgSection;
