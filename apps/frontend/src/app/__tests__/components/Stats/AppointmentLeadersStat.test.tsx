import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import AppointmentLeadersStat from "@/app/components/Stats/AppointmentLeadersStat";
import CardHeader from "@/app/components/Cards/CardHeader/CardHeader";
import DynamicChartCard from "@/app/components/DynamicChart/DynamicChartCard";

jest.mock("@/app/components/Cards/CardHeader/CardHeader", () => ({
  __esModule: true,
  default: jest.fn(({ title }: any) => (
    <div data-testid="card-header">{title}</div>
  )),
}));

jest.mock("@/app/components/DynamicChart/DynamicChartCard", () => ({
  __esModule: true,
  default: jest.fn(({ layout, hideKeys }: any) => (
    <div data-testid="chart" data-layout={layout} data-hide={String(hideKeys)} />
  )),
}));

describe("AppointmentLeadersStat", () => {
  it("renders leader chart with vertical layout", () => {
    render(<AppointmentLeadersStat />);

    expect(screen.getByTestId("card-header")).toHaveTextContent(
      "Appointment leaders"
    );
    expect(screen.getByTestId("chart")).toHaveAttribute("data-layout", "vertical");
    expect(screen.getByTestId("chart")).toHaveAttribute("data-hide", "true");
    expect(CardHeader).toHaveBeenCalled();
    expect(DynamicChartCard).toHaveBeenCalled();
  });
});
