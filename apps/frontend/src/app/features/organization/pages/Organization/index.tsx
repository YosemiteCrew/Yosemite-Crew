"use client";
import React from "react";
import ProtectedRoute from "@/app/ui/layout/guards/ProtectedRoute";
import {
  Profile,
  Specialities,
  Rooms,
  Team,
  Payment,
  Documents,
  DocumentESigning,
  LinkedMedicalDevices,
  DeleteOrg,
} from "@/app/features/organization/pages/Organization/Sections";
import { usePrimaryOrg } from "@/app/hooks/useOrgSelectors";
import OrgGuard from "@/app/ui/layout/guards/OrgGuard";

const Organization = () => {
  const primaryorg = usePrimaryOrg();

  if (!primaryorg) return null;

  return (
    <div className="flex flex-col gap-6 sm:gap-6 px-3! py-3! sm:px-12! lg:px-[60px]! sm:py-12!">
      <Profile primaryOrg={primaryorg} />
      <Specialities />
      {primaryorg.isVerified && (
        <>
          <Team />
          <Rooms />
          <Payment />
          <LinkedMedicalDevices />
          <Documents />
          <DocumentESigning />
        </>
      )}
      <DeleteOrg />
    </div>
  );
};

const ProtectedOrganizations = () => {
  return (
    <ProtectedRoute>
      <OrgGuard>
        <Organization />
      </OrgGuard>
    </ProtectedRoute>
  );
};

export default ProtectedOrganizations;
