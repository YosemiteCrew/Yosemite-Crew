"use client";
import ProtectedRoute from "@/app/components/ProtectedRoute";
import React from "react";
import Personal from "./Sections/Personal";
import Delete from "./Sections/Delete";
import OrgSection from "./Sections/OrgSection";

const Settings = () => {
  return (
    <div className="flex flex-col px-4! py-6! md:px-12! md:py-10! lg:px-10! lg:pb-20! lg:pr-20!">
      <div className="w-full flex flex-col gap-8 lg:gap-10">
        <Personal />
        <OrgSection />
        <Delete />
      </div>
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
