import React from "react";
import ProfileCard from "@/app/features/organization/pages/Organization/Sections/ProfileCard";
import { useAuthStore } from "@/app/stores/authStore";
import { updateUser } from "@/app/features/users/services/userService";
import { useNotify } from "@/app/hooks/useNotify";

const BasicFields = [
  {
    label: "First name",
    key: "given_name",
    required: true,
    editable: true,
    type: "text",
  },
  {
    label: "Last name",
    key: "family_name",
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
];

const Personal = () => {
  const attributes = useAuthStore((s) => s.attributes);
  const { notify } = useNotify();

  if (!attributes) return null;

  const handleSave = async (values: any) => {
    try {
      const firstName = values.given_name;
      const lastName = values.family_name;
      await updateUser(firstName, lastName);
      notify("success", {
        title: "Personal details updated",
        text: "Personal details have been updated successfully.",
      });
    } catch (error) {
      console.log(error);
      notify("error", {
        title: "Unable to update personal details",
        text: "Failed to update personal details. Please try again.",
      });
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <ProfileCard
        title="Personal details"
        fields={BasicFields}
        org={attributes}
        showProfileUser
        onSave={handleSave}
      />
    </div>
  );
};

export default Personal;
