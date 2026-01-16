"use client";
import ProtectedRoute from "@/app/components/ProtectedRoute";
import React from "react";
import Personal from "./Sections/Personal";
import DeleteProfile from "./Sections/DeleteProfile";
import OrgSection from "./Sections/OrgSection";

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
