import React, { useState } from "react";
import AccordionButton from "@/app/components/Accordion/AccordionButton";
import ProfileCard from "./ProfileCard";
import { Organisation } from "@yosemite-crew/types";

const BasicFields = [
  {
    label: "Organization type",
    key: "type",
    required: true,
    editable: false,
    type: "text",
  },
  {
    label: "Organization name",
    key: "name",
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
    key: "DUNSNumber",
    required: true,
    editable: true,
    type: "text",
  },
  {
    label: "Phone number",
    key: "phoneNo",
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

type ProfileProps = {
  primaryOrg: Organisation;
};

const Profile = ({ primaryOrg }: ProfileProps) => {
  const [formData, setFormData] = useState<Organisation>(primaryOrg);

  return (
    <AccordionButton
      title="Organization profile"
      defaultOpen
      showButton={false}
    >
      <div className="flex flex-col gap-4">
        <ProfileCard
          title="Organization"
          fields={BasicFields}
          org={{ ...primaryOrg, country: primaryOrg.address?.country }}
          showProfile
        />
        <ProfileCard
          title="Address"
          fields={AddressFields}
          org={{ ...primaryOrg.address }}
        />
      </div>
    </AccordionButton>
  );
};

export default Profile;
