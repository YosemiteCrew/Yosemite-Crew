'use client';
import React from 'react';
import dynamic from 'next/dynamic';
import ProtectedRoute from '@/app/ui/layout/guards/ProtectedRoute';
import DashboardProfile from '@/app/ui/widgets/DashboardProfile/DashboardProfile';
import OrgGuard from '@/app/ui/layout/guards/OrgGuard';
import PageSkeleton from '@/app/ui/layout/PageSkeleton';
import { PermissionGate } from '@/app/ui/layout/guards/PermissionGate';
import Fallback from '@/app/ui/overlays/Fallback';
import { PERMISSIONS } from '@/app/lib/permissions';

const DASHBOARD_PAGE_SKELETON = <PageSkeleton variant="dashboard" />;

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
    <div className="yc-page-content">
      <DashboardProfile />
      <DashboardSteps />
      <VideosCard />
      <PermissionGate
        allOf={[PERMISSIONS.ANALYTICS_VIEW_ANY]}
        fallback={<Fallback resource="practice analytics" />}
      >
        <Explorecard />
        {/* Vertical day charts: tablet (>=768) and desktop only. The 390px phone
            frames omit them and jump from the stat tiles straight to the schedule. */}
        <div className="hidden md:grid md:grid-cols-2 md:gap-3 xl:gap-3.5">
          <AppointmentStat />
          <RevenueStat />
        </div>
      </PermissionGate>
      {/* Schedule follows the charts row, matching the design scroll order
          (explore -> charts -> schedule -> leaders -> turnover -> availability). */}
      <AppointmentTask />
      <PermissionGate
        allOf={[PERMISSIONS.ANALYTICS_VIEW_ANY]}
        fallback={<Fallback resource="practice analytics" />}
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-3 xl:gap-3.5">
          <AppointmentLeadersStat />
          <RevenueLeadersStat />
        </div>
        {/* Inventory turnover: tablet and desktop only; omitted on the phone frames. */}
        <div className="hidden md:grid md:grid-cols-2 md:gap-3 xl:gap-3.5">
          <AnnualInventoryTurnoverStat />
          <IndividualProductTurnoverStat />
        </div>
      </PermissionGate>
      <Availability />
    </div>
  );
};

const ProtectedDashboard = () => {
  return (
    <ProtectedRoute skeleton={DASHBOARD_PAGE_SKELETON}>
      <OrgGuard skeleton={DASHBOARD_PAGE_SKELETON}>
        <Dashboard />
      </OrgGuard>
    </ProtectedRoute>
  );
};

export default ProtectedDashboard;
