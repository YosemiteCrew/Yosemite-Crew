import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import StatCard from "@/app/components/StatCard/StatCard"; 

jest.mock("@iconify/react/dist/iconify.js", () => ({
  Icon: ({ icon, width, height }: { icon: string; width: number; height: number }) => (
    <div data-testid="mock-icon" data-icon={icon} style={{ width, height }} />
  ),
}));

describe("StatCard Component", () => {
  it("should render the title, value, and icon passed as props", () => {
    const testProps = {
      icon: "mdi:star",
      title: "Total Reviews",
      value: 125,
    };

    render(<StatCard {...testProps} />);

    expect(screen.getByText("Total Reviews")).toBeInTheDocument();

    expect(screen.getByRole("heading", { name: "125" })).toBeInTheDocument();

    const iconElement = screen.getByTestId("mock-icon");
    expect(iconElement).toBeInTheDocument();

    expect(iconElement).toHaveAttribute("data-icon", "mdi:star");
  });

  it("should correctly render when the value is a string", () => {
    const testProps = {
      icon: "mdi:clock-time-four-outline",
      title: "Avg. Response Time",
      value: "2 hours",
    };

    render(<StatCard {...testProps} />);

    expect(screen.getByText("Avg. Response Time")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "2 hours" })).toBeInTheDocument();

    const iconElement = screen.getByTestId("mock-icon");
    expect(iconElement).toBeInTheDocument();
    expect(iconElement).toHaveAttribute("data-icon", "mdi:clock-time-four-outline");
  });
});
