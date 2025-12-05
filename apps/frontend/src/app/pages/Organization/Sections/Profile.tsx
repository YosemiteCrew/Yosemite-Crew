import React, { useState } from "react";
import AccordionButton from "@/app/components/Accordion/AccordionButton";
import ProfileCard from "./ProfileCard";

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
    label: "Organization type",
    key: "orgType",
    required: true,
    editable: false,
    type: "text",
  },
  {
    label: "Organization name",
    key: "orgName",
    required: true,
    editable: false,
    type: "text",
  },
  {
    label: "Tax ID",
    key: "taxId",
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
  {
    label: "DUNS number",
    key: "duns",
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

const DemoOrg = {
  status: "Verified",
  firstName: "Suryansh",
  lastName: "Sharma",
  email: "suryansh@yosemitecrew.com",
  orgType: "HOSPITAL",
  orgName: "Dog Hospital",
  taxId: "",
  country: "India",
  duns: "",
  phone: "+91 9315566594",
  addressLine: "",
  area: "",
  state: "",
  city: "",
  postalCode: "",
};

const Profile = () => {
  const [org] = useState(DemoOrg);

  return (
    <AccordionButton
      title="Organization profile"
      defaultOpen
      showButton={false}
    >
      <div className="flex flex-col gap-4">
        <ProfileCard title="Organization" fields={BasicFields} org={org} showProfile />
        <ProfileCard title="Address" fields={AddressFields} org={org} />
      </div>
    </AccordionButton>
  );
};

export default Profile;
