import AccordionButton from "@/app/components/Accordion/AccordionButton";
import React, { useState } from "react";
import ProfileCard from "../../Organization/Sections/ProfileCard";

const BasicFields = [
  {
    label: "First name",
    key: "firstName",
    required: true,
    editable: true,
    type: "text",
  },
  {
    label: "Last name",
    key: "lastName",
    required: true,
    editable: true,
    type: "text",
  },
  {
    label: "Email address",
    key: "email",
    required: true,
    editable: false,
    type: "text",
  },
  {
    label: "Role",
    key: "role",
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
    label: "Employment type",
    key: "employmentType",
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

const AddressFields = [
  {
    label: "Address line",
    key: "addressLine",
    required: true,
    editable: true,
    type: "text",
  },
  {
    label: "Area",
    key: "area",
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

const Personal = () => {
  const [org] = useState({});

  return (
    <AccordionButton title="Personal details" defaultOpen showButton={false}>
      <div className="flex flex-col gap-4">
        <ProfileCard title="Info" fields={BasicFields} org={org} showProfileUser />
        <ProfileCard title="Address" fields={AddressFields} org={org} />
      </div>
    </AccordionButton>
  );
};

export default Personal;
