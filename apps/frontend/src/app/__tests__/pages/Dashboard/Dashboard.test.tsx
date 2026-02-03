import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import ProtectedDashboard from "@/app/features/dashboard/pages/Dashboard";

jest.mock("@/app/ui/layout/guards/ProtectedRoute", () => ({
  __esModule: true,
  default: ({ children }: any) => <div>{children}</div>,
}));

jest.mock("@/app/ui/layout/guards/OrgGuard", () => ({
  __esModule: true,
  default: ({ children }: any) => <div>{children}</div>,
}));

jest.mock("@/app/ui/layout/guards/PermissionGate", () => ({
  PermissionGate: ({ children }: any) => <div>{children}</div>,
}));

jest.mock("@/app/ui/widgets/DashboardProfile/DashboardProfile", () => () => (
  <div data-testid="dashboard-profile" />
));

jest.mock("@/app/ui/widgets/DashboardSteps", () => () => (
  <div data-testid="dashboard-steps" />
));

jest.mock("@/app/ui/cards/VideosCard/VideosCard", () => () => (
  <div data-testid="videos-card" />
));

jest.mock("@/app/ui/cards/ExploreCard/ExploreCard", () => () => (
  <div data-testid="explore-card" />
));

jest.mock("@/app/ui/widgets/Stats/AppointmentStat", () => () => (
  <div data-testid="appointment-stat" />
));

jest.mock("@/app/ui/widgets/Stats/RevenueStat", () => () => (
  <div data-testid="revenue-stat" />
));

jest.mock("@/app/ui/widgets/Stats/AppointmentLeadersStat", () => () => (
  <div data-testid="appointment-leaders" />
));

jest.mock("@/app/ui/widgets/Stats/RevenueLeadersStat", () => () => (
  <div data-testid="revenue-leaders" />
));

jest.mock("@/app/ui/widgets/Summary/AppointmentTask", () => () => (
  <div data-testid="appointment-task" />
));

jest.mock("@/app/ui/widgets/Summary/Availability", () => () => (
  <div data-testid="availability" />
));

describe("Dashboard page", () => {
  it("renders dashboard sections", () => {
    render(<ProtectedDashboard />);

    expect(screen.getByTestId("dashboard-profile")).toBeInTheDocument();
    expect(screen.getByTestId("dashboard-steps")).toBeInTheDocument();
    expect(screen.getByTestId("videos-card")).toBeInTheDocument();
    expect(screen.getByTestId("explore-card")).toBeInTheDocument();
    expect(screen.getByTestId("appointment-stat")).toBeInTheDocument();
    expect(screen.getByTestId("revenue-stat")).toBeInTheDocument();
    expect(screen.getByTestId("appointment-leaders")).toBeInTheDocument();
    expect(screen.getByTestId("revenue-leaders")).toBeInTheDocument();
    expect(screen.getByTestId("appointment-task")).toBeInTheDocument();
    expect(screen.getByTestId("availability")).toBeInTheDocument();
  });
});
