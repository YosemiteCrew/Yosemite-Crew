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

import "./Dashboard.css";

const Dashboard = () => {
  return (
    <div className="dashboard-container">
      <DashboardProfile />
      <VideosCard />
      <Explorecard />
      <div className="dashboard-stats-two">
        <AppointmentStat />
        <RevenueStat />
      </div>
      <div className="dashboard-stats-two">
        <AppointmentLeadersStat />
        <RevenueLeadersStat />
      </div>
      <AppointmentTask />
      <Availability />
    </div>
  );
};

const ProtectedDashboard = () => {
  return (
    <ProtectedRoute>
      <Dashboard />
    </ProtectedRoute>
  );
};

export default ProtectedDashboard;
