import React, { useState } from "react";
import ProfileCard from "@/app/features/organization/pages/Organization/Sections/ProfileCard";
import { Organisation } from "@yosemite-crew/types";
import { updateOrg } from "@/app/features/organization/services/orgService";
import { BusinessOptions } from "@/app/features/organization/types/org";
import { PermissionGate } from "@/app/ui/layout/guards/PermissionGate";
import { PERMISSIONS } from "@/app/lib/permissions";
import { usePermissions } from "@/app/hooks/usePermissions";
import { useNotify } from "@/app/hooks/useNotify";

type FieldType = "text" | "select" | "country" | "date";

export type ProfileField = {
  label: string;
  key: string;
  required: boolean;
  editable: boolean;
  type: FieldType;
  options?: { label: string; value: string }[];
};

export const field = (
  label: string,
  key: string,
  type: FieldType = "text",
  editable: boolean = true,
  required: boolean = true,
  options?: { label: string; value: string }[],
): ProfileField => ({ label, key, type, editable, required, options });

const BasicFields: ProfileField[] = [
  field("Organization type", "type", "select", false, true, BusinessOptions),
  field("Organization name", "name", "text", false),
  field("Tax ID", "taxId"),
  field("Country", "country", "country"),
  field("DUNS number", "DUNSNumber", "text", true, false),
  field("Phone number", "phoneNo"),
];

const AddressFields: ProfileField[] = [
  field("Address line", "addressLine"),
  field("State / Province", "state"),
  field("City", "city"),
  field("Postal code", "postalCode"),
];

type ProfileProps = {
  primaryOrg: Organisation;
};

const Profile = ({ primaryOrg }: ProfileProps) => {
  const [formData, setFormData] = useState<Organisation>(primaryOrg);
  const { can } = usePermissions();
  const canEditOrg = can(PERMISSIONS.ORG_EDIT);
  const { notify } = useNotify();

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
      notify("success", {
        title: "Organization updated",
        text: "Organization details have been updated successfully.",
      });
    } catch (error: any) {
      console.error("Error updating organization:", error);
      notify("error", {
        title: "Unable to update organization",
        text: "Failed to update organization. Please try again.",
      });
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
      notify("success", {
        title: "Organization updated",
        text: "Organization details have been updated successfully.",
      });
    } catch (error: any) {
      console.error("Error updating organization:", error);
      notify("error", {
        title: "Unable to update organization",
        text: "Failed to update organization. Please try again.",
      });
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
