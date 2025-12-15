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
    <div className="flex flex-col px-4! py-6! md:px-12! md:py-10! lg:px-10! lg:pb-20! lg:pr-20!">
      <div className="w-full flex flex-col gap-8 lg:gap-10">
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
