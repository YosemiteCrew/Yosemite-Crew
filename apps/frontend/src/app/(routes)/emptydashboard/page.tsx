import React from "react";

import ProtectedRoute from "@/app/Components/ProtectedRoute";
import AdminDashboardEmpty from "@/app/Pages/AdminDashboardEmpty/AdminDashboardEmpty";

function page() {
  return (
    <>
      <ProtectedRoute rolesAllowed={["owner"]}>
        <AdminDashboardEmpty />
      </ProtectedRoute>
    </>
  );
}

export default page;
