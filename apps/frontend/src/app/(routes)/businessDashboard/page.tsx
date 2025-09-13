'use client';
import React from "react";
import BusinessDashboard from "@/app/Pages/BusinessDashboard/BusinessDashboard";
import { useOldAuthStore } from "@/app/stores/oldAuthStore";

function Page() {
  const userType = useOldAuthStore((state) => state.userType);
  return (
    <>
      {userType === "veterinaryBusiness" ? (
        <BusinessDashboard />
      ) : (
        "YOU ARE NOT ALLOWED TO ACCESS THIS PAGE"
      )}
    </>
  );
}

export default Page;