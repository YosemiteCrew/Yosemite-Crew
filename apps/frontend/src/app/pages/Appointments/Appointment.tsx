"use client";
import React, { useEffect, useState } from "react";

import ProtectedRoute from "@/app/components/ProtectedRoute";
import { getData } from "@/app/services/axios";
import { Primary } from "@/app/components/Buttons";
import OrgInvites from "../../components/DataTable/OrgInvites";
import OrganizationList from "../../components/DataTable/OrganizationList";
import CalendarView from "../../components/Calendar/Calendar";

const Appointments = () => {
  const [orgs, setOrgs] = useState<any[]>([]);
  const [invites, setInvites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  return (
    <div className="OperationsWrapper p-4">
      <div>
        <CalendarView />
      </div>

    </div>
  );
};

const ProtectedAppointments = () => {
  return (
    <ProtectedRoute>
      <Appointments />
    </ProtectedRoute>
  );
};

export default ProtectedAppointments;
