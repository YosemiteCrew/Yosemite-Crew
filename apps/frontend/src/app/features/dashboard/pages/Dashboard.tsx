'use client';
import React from 'react';
import dynamic from 'next/dynamic';
import ProtectedRoute from '@/app/ui/layout/guards/ProtectedRoute';
import DashboardProfile from '@/app/ui/widgets/DashboardProfile/DashboardProfile';
import OrgGuard from '@/app/ui/layout/guards/OrgGuard';
import PageSkeleton from '@/app/ui/layout/PageSkeleton';
import { PermissionGate } from '@/app/ui/layout/guards/PermissionGate';
import { PERMISSIONS } from '@/app/lib/permissions';

const DashboardStatSkeleton = () => (
  <div className="min-h-64 rounded-2xl bg-card-hover animate-pulse" aria-hidden="true" />
);

const DashboardCardSkeleton = () => (
  <div className="min-h-40 rounded-2xl bg-card-hover animate-pulse" aria-hidden="true" />
);

const DashboardSteps = dynamic(() => import('@/app/ui/widgets/DashboardSteps'), {
  loading: () => <DashboardCardSkeleton />,
});
const VideosCard = dynamic(() => import('@/app/ui/cards/VideosCard/VideosCard'), {
  loading: () => <DashboardCardSkeleton />,
});
const Explorecard = dynamic(() => import('@/app/ui/cards/ExploreCard/ExploreCard'), {
  loading: () => <DashboardCardSkeleton />,
});
const AppointmentTask = dynamic(() => import('@/app/ui/widgets/Summary/AppointmentTask'), {
  loading: () => <DashboardCardSkeleton />,
});
const Availability = dynamic(() => import('@/app/ui/widgets/Summary/Availability'), {
  loading: () => <DashboardCardSkeleton />,
});

const AppointmentStat = dynamic(() => import('@/app/ui/widgets/Stats/AppointmentStat'), {
  loading: () => <DashboardStatSkeleton />,
});
const RevenueStat = dynamic(() => import('@/app/ui/widgets/Stats/RevenueStat'), {
  loading: () => <DashboardStatSkeleton />,
});
const AppointmentLeadersStat = dynamic(
  () => import('@/app/ui/widgets/Stats/AppointmentLeadersStat'),
  { loading: () => <DashboardStatSkeleton /> }
);
const RevenueLeadersStat = dynamic(() => import('@/app/ui/widgets/Stats/RevenueLeadersStat'), {
  loading: () => <DashboardStatSkeleton />,
});
const AnnualInventoryTurnoverStat = dynamic(
  () => import('@/app/ui/widgets/Stats/AnnualInventoryTurnoverStat'),
  { loading: () => <DashboardStatSkeleton /> }
);
const IndividualProductTurnoverStat = dynamic(
  () => import('@/app/ui/widgets/Stats/IndividualProductTurnoverStat'),
  { loading: () => <DashboardStatSkeleton /> }
);

const Dashboard = () => {
  return (
    <div className="flex flex-col gap-6 pl-3! pr-3! pt-3! pb-3! md:pl-5! md:pr-5! md:pt-5! md:pb-5! lg:pl-5! lg:pr-5! lg:pt-5! lg:pb-5!">
      <DashboardProfile />
      <DashboardSteps />
      <VideosCard />
      <PermissionGate allOf={[PERMISSIONS.ANALYTICS_VIEW_ANY]}>
        <Explorecard />
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-3">
          <AppointmentStat />
          <RevenueStat />
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-3 mb-2 md:mb-4">
          <AppointmentLeadersStat />
          <RevenueLeadersStat />
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-3 mb-2 md:mb-4">
          <AnnualInventoryTurnoverStat />
          <IndividualProductTurnoverStat />
        </div>
      </PermissionGate>
      <AppointmentTask />
      <Availability />
    </div>
  );
};

const ProtectedDashboard = () => {
  return (
    <ProtectedRoute skeleton={<PageSkeleton variant="dashboard" />}>
      <OrgGuard skeleton={<PageSkeleton variant="dashboard" />}>
        <Dashboard />
      </OrgGuard>
    </ProtectedRoute>
  );
};

export default ProtectedDashboard;
