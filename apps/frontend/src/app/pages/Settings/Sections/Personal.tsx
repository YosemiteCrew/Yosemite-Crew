import React from "react";
import ProfileCard from "../../Organization/Sections/ProfileCard";
import { useAuthStore } from "@/app/stores/authStore";

const BasicFields = [
  {
    label: "First name",
    key: "given_name",
    required: true,
    editable: false,
    type: "text",
  },
  {
    label: "Last name",
    key: "family_name",
    required: true,
    editable: false,
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

  if (!attributes) return null;

  return (
    <div className="flex flex-col gap-4">
      <ProfileCard
        title="Personal details"
        fields={BasicFields}
        org={attributes}
        showProfileUser
        editable={false}
      />
    </div>
  );
};

export default Personal;
