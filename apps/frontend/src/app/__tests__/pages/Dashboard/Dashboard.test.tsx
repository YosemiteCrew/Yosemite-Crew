import React from "react";
import { render, screen } from "@testing-library/react";
import ProtectedDashboard from "../../../pages/Dashboard/Dashboard";

// --- Mocks ---

// 1. Mock Guards (Wrappers)
jest.mock("@/app/components/ProtectedRoute", () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="protected-route">{children}</div>
  ),
}));

jest.mock("@/app/components/OrgGuard", () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="org-guard">{children}</div>
  ),
}));

// 2. Mock Dashboard Child Components
jest.mock("@/app/components/DashboardProfile/DashboardProfile", () => () => (
  <div data-testid="dashboard-profile" />
));
jest.mock("@/app/components/Cards/VideosCard/VideosCard", () => () => (
  <div data-testid="videos-card" />
));
jest.mock("@/app/components/Cards/ExploreCard/ExploreCard", () => () => (
  <div data-testid="explore-card" />
));
jest.mock("@/app/components/Stats/AppointmentStat", () => () => (
  <div data-testid="appointment-stat" />
));
jest.mock("@/app/components/Stats/RevenueStat", () => () => (
  <div data-testid="revenue-stat" />
));
jest.mock("@/app/components/Stats/AppointmentLeadersStat", () => () => (
  <div data-testid="appointment-leaders-stat" />
));
jest.mock("@/app/components/Stats/RevenueLeadersStat", () => () => (
  <div data-testid="revenue-leaders-stat" />
));
jest.mock("@/app/components/Summary/AppointmentTask", () => () => (
  <div data-testid="appointment-task" />
));
jest.mock("@/app/components/Summary/Availability", () => () => (
  <div data-testid="availability" />
));

describe("Dashboard Page", () => {
  it("renders the ProtectedDashboard wrapper and all inner Dashboard components", () => {
    render(<ProtectedDashboard />);

    // 1. Verify Guards (Structure Coverage)
    const protectedRoute = screen.getByTestId("protected-route");
    const orgGuard = screen.getByTestId("org-guard");

    expect(protectedRoute).toContainElement(orgGuard);

    // 2. Verify Child Components (Statements/Lines Coverage)
    // These checks ensure every line of JSX in the main component is executed
    expect(screen.getByTestId("dashboard-profile")).toBeInTheDocument();
    expect(screen.getByTestId("videos-card")).toBeInTheDocument();
    expect(screen.getByTestId("explore-card")).toBeInTheDocument();
    expect(screen.getByTestId("appointment-stat")).toBeInTheDocument();
    expect(screen.getByTestId("revenue-stat")).toBeInTheDocument();
    expect(screen.getByTestId("appointment-leaders-stat")).toBeInTheDocument();
    expect(screen.getByTestId("revenue-leaders-stat")).toBeInTheDocument();
    expect(screen.getByTestId("appointment-task")).toBeInTheDocument();
    expect(screen.getByTestId("availability")).toBeInTheDocument();
  });
});
