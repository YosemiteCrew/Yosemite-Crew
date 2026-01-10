"use client";
import React from "react";
import ProtectedRoute from "@/app/components/ProtectedRoute";
import {
  Profile,
  Specialities,
  Rooms,
  Team,
  Payment,
  Documents,
  Delete,
} from "./Sections/index";
import { usePrimaryOrg } from "@/app/hooks/useOrgSelectors";
import OrgGuard from "@/app/components/OrgGuard";

const Organization = () => {
  const primaryorg = usePrimaryOrg();

  if (!primaryorg) return null;

  return (
    <div className="flex flex-col gap-6 px-3! py-3! sm:px-12! lg:px-[60px]! sm:py-12!">
      <div className="w-full flex flex-col gap-3">
        <Profile primaryOrg={primaryorg} />
        <Specialities />
        {primaryorg.isVerified && (
          <>
            <Team />
            <Rooms />
            <Payment />
            <Documents />
          </>
        )}
        <Delete />
      </div>
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
