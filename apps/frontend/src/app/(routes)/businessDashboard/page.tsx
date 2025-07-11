// app/businessDashboard/page.tsx
"use client";

import React from "react";
import BusinessDashboard from "@/app/Pages/BusinessDashboard/BusinessDashboard";

function page() {
  return (
    <ProtectedRoute allowedRoles={["Veterinary Business"]}>
      <BusinessDashboard />
    </ProtectedRoute>
  );
}

export default page
