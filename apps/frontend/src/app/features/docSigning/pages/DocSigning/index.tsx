"use client";
import React from "react";
import ProtectedRoute from "@/app/ui/layout/guards/ProtectedRoute";
import OrgGuard from "@/app/ui/layout/guards/OrgGuard";
import { useLoadOrg } from "@/app/hooks/useLoadOrg";
import DocSigningPortal from "@/app/features/docSigning/components/DocSigningPortal";

const DocSigning = () => {
  useLoadOrg();

  return (
    <ProtectedRoute>
      <OrgGuard>
        <div className="flex flex-col gap-6 w-full h-full">
          <DocSigningPortal />
        </div>
      </OrgGuard>
    </ProtectedRoute>
  );
};

export default DocSigning;
