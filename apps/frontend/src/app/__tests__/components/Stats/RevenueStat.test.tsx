import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import RevenueStat from "@/app/ui/widgets/Stats/RevenueStat";
import CardHeader from "@/app/ui/cards/CardHeader/CardHeader";
import DynamicChartCard from "@/app/ui/widgets/DynamicChart/DynamicChartCard";

jest.mock("@/app/ui/cards/CardHeader/CardHeader", () => ({
  __esModule: true,
  default: jest.fn(({ title }: any) => (
    <div data-testid="card-header">{title}</div>
  )),
}));

jest.mock("@/app/ui/widgets/DynamicChart/DynamicChartCard", () => ({
  __esModule: true,
  default: jest.fn(({ data, keys }: any) => (
    <div data-testid="chart" data-points={data.length} data-keys={keys.length} />
  )),
}));

describe("RevenueStat", () => {
  it("renders header and chart data", () => {
    render(<RevenueStat />);

    expect(screen.getByTestId("card-header")).toHaveTextContent("Revenue");
    expect(screen.getByTestId("chart")).toHaveAttribute("data-points", "6");
    expect(screen.getByTestId("chart")).toHaveAttribute("data-keys", "2");
    expect(CardHeader).toHaveBeenCalled();
    expect(DynamicChartCard).toHaveBeenCalled();
  });
});
