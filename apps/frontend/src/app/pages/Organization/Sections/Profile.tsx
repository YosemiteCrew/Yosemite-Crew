import React, { useState } from "react";
import ProfileCard from "./ProfileCard";
import { Organisation } from "@yosemite-crew/types";
import { updateOrg } from "@/app/services/orgService";
import { BusinessOptions } from "@/app/types/org";
import { PermissionGate } from "@/app/components/PermissionGate";
import { PERMISSIONS } from "@/app/utils/permissions";
import { usePermissions } from "@/app/hooks/usePermissions";

const BasicFields = [
  {
    label: "Organization type",
    key: "type",
    required: true,
    editable: false,
    type: "select",
    options: BusinessOptions,
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
    type: "country",
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
  const { can } = usePermissions();
  const canEditOrg = can(PERMISSIONS.ORG_EDIT);

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
      await updateOrg(updated);
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
    try {
      await updateOrg(updated);
      setFormData(updated);
    } catch (error: any) {
      console.error("Error updating organization:", error);
    }
  };

  return (
    <PermissionGate allOf={[PERMISSIONS.ORG_VIEW]}>
      <div className="flex flex-col gap-6">
        <ProfileCard
          title="Organization"
          fields={BasicFields}
          org={{ ...formData, country: formData.address?.country }}
          showProfile
          onSave={canEditOrg ? handleOrgSave : undefined}
        />
        <ProfileCard
          title="Address"
          fields={AddressFields}
          org={{ ...formData.address }}
          onSave={canEditOrg ? handleAddressSave : undefined}
        />
      </div>
    </PermissionGate>
  );
};

export default Profile;
