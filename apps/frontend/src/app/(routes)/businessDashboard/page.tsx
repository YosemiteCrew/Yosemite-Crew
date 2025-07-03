// app/businessDashboard/page.tsx
"use client";

import React from "react";
import ProtectedRoute from "@/app/Components/ProtectedRoute";
import BusinessDashboard from "@/app/Pages/BusinessDashboard/BusinessDashboard";

export default function BusinessDashboardPage() {
  return (
    <ProtectedRoute allowedRoles={["Veterinary Business"]}>
      <BusinessDashboard />
    </ProtectedRoute>
  );
}
