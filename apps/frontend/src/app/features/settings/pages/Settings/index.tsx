"use client";
import ProtectedRoute from "@/app/ui/layout/guards/ProtectedRoute";
import React from "react";
import Personal from "@/app/features/settings/pages/Settings/Sections/Personal";
import DeleteProfile from "@/app/features/settings/pages/Settings/Sections/DeleteProfile";
import OrgSection from "@/app/features/settings/pages/Settings/Sections/OrgSection";

const Settings = () => {
  return (
    <div className="flex flex-col gap-6 px-3! py-3! sm:px-12! lg:px-[60px]! sm:py-12!">
      <Personal />
      <OrgSection />
      <DeleteProfile />
    </div>
  );
};

const ProtectedSettings = () => {
  return (
    <ProtectedRoute>
      <Settings />
    </ProtectedRoute>
  );
};

export default ProtectedSettings;
