"use client";
import React from "react";
import ProtectedRoute from "@/app/components/ProtectedRoute";
import DashboardProfile from "@/app/components/DashboardProfile/DashboardProfile";
import VideosCard from "@/app/components/Cards/VideosCard/VideosCard";
import Explorecard from "@/app/components/Cards/ExploreCard/ExploreCard";
import AppointmentStat from "@/app/components/Stats/AppointmentStat";
import RevenueStat from "@/app/components/Stats/RevenueStat";
import AppointmentLeadersStat from "@/app/components/Stats/AppointmentLeadersStat";
import RevenueLeadersStat from "@/app/components/Stats/RevenueLeadersStat";
import AppointmentTask from "@/app/components/Summary/AppointmentTask";
import Availability from "@/app/components/Summary/Availability";
import OrgGuard from "@/app/components/OrgGuard";
import DashboardSteps from "@/app/components/DashboardSteps";
import { PermissionGate } from "@/app/components/PermissionGate";
import { PERMISSIONS } from "@/app/utils/permissions";

const Dashboard = () => {
  return (
    <div className="flex flex-col gap-6 px-3! py-3! sm:px-12! lg:px-[60px]! sm:py-12!">
      <DashboardProfile />
      <DashboardSteps />
      <VideosCard />
      <PermissionGate allOf={[PERMISSIONS.ANALYTICS_VIEW_ANY]}>
        <Explorecard />
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-3">
          <AppointmentStat />
          <RevenueStat />
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-3">
          <AppointmentLeadersStat />
          <RevenueLeadersStat />
        </div>
      </PermissionGate>
      <AppointmentTask />
      <Availability />
    </div>
  );
};

const ProtectedDashboard = () => {
  return (
    <ProtectedRoute>
      <OrgGuard>
        <Dashboard />
      </OrgGuard>
    </ProtectedRoute>
  );
};

export default ProtectedDashboard;
