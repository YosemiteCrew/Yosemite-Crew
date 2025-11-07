import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

jest.mock("@/app/components/ProtectedRoute", () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="protected-route">{children}</div>
  ),
}));

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
  <div data-testid="appointment-leaders" />
));
jest.mock("@/app/components/Stats/RevenueLeadersStat", () => () => (
  <div data-testid="revenue-leaders" />
));
jest.mock("@/app/components/Summary/AppointmentTask", () => () => (
  <div data-testid="appointment-task" />
));
jest.mock("@/app/components/Summary/Availability", () => () => (
  <div data-testid="availability-summary" />
));

import ProtectedDashboard from "@/app/pages/Dashboard/Dashboard";

describe("Dashboard page", () => {
  test("renders all dashboard modules inside protected route", () => {
    render(<ProtectedDashboard />);

    expect(screen.getByTestId("protected-route")).toBeInTheDocument();
    for (const testId of [
      "dashboard-profile",
      "videos-card",
      "explore-card",
      "appointment-stat",
      "revenue-stat",
      "appointment-leaders",
      "revenue-leaders",
      "appointment-task",
      "availability-summary",
    ]) {
      expect(screen.getByTestId(testId)).toBeInTheDocument();
    }
  });
});
