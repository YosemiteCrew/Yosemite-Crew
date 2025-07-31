import React from "react";
import BusinessDashboard from "@/app/Pages/BusinessDashboard/BusinessDashboard";
import { useAuthStore } from "@/app/stores/authStore";

function Page() {
  const userType = useAuthStore((state) => state.userType);
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