import React, { useState } from "react";
import AccordionButton from "@/app/components/Accordion/AccordionButton";
import ProfileCard from "./ProfileCard";
import { Organisation } from "@yosemite-crew/types";
import { updateOrg } from "@/app/services/orgService";

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
    required: false,
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

type ProfileProps = {
  primaryOrg: Organisation;
};

const Profile = ({ primaryOrg }: ProfileProps) => {
  const [formData, setFormData] = useState<Organisation>(primaryOrg);

  const handleOrgSave = async (values: Record<string, string>) => {
    const updated: Organisation = {
      ...formData,
      ...values,
      address: {
        ...formData.address,
        ...(values.country ? { country: values.country } : {}),
      },
    };
    try {
      await updateOrg(formData);
      setFormData(updated);
    } catch (error: any) {
      console.error("Error updating organization:", error);
    }
  };

  const handleAddressSave = async (values: Record<string, string>) => {
    const updated: Organisation = {
      ...formData,
      address: {
        ...formData.address,
        ...values,
      },
    };
    setFormData(updated);
    try {
      await updateOrg(formData);
    } catch (error: any) {
      console.error("Error updating organization:", error);
    }
  };

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
          org={{ ...formData, country: formData.address?.country }}
          showProfile
          onSave={handleOrgSave}
        />
        <ProfileCard
          title="Address"
          fields={AddressFields}
          org={{ ...formData.address }}
          onSave={handleAddressSave}
        />
      </div>
    </AccordionButton>
  );
};

export default Profile;
