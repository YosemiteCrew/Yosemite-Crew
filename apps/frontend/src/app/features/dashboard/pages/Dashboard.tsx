"use client";
import React from "react";
import ProtectedRoute from "@/app/ui/layout/guards/ProtectedRoute";
import DashboardProfile from "@/app/ui/widgets/DashboardProfile/DashboardProfile";
import VideosCard from "@/app/ui/cards/VideosCard/VideosCard";
import Explorecard from "@/app/ui/cards/ExploreCard/ExploreCard";
import AppointmentStat from "@/app/ui/widgets/Stats/AppointmentStat";
import RevenueStat from "@/app/ui/widgets/Stats/RevenueStat";
import AppointmentLeadersStat from "@/app/ui/widgets/Stats/AppointmentLeadersStat";
import RevenueLeadersStat from "@/app/ui/widgets/Stats/RevenueLeadersStat";
import AppointmentTask from "@/app/ui/widgets/Summary/AppointmentTask";
import Availability from "@/app/ui/widgets/Summary/Availability";
import OrgGuard from "@/app/ui/layout/guards/OrgGuard";
import DashboardSteps from "@/app/ui/widgets/DashboardSteps";
import { PermissionGate } from "@/app/ui/layout/guards/PermissionGate";
import { PERMISSIONS } from "@/app/lib/permissions";

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
