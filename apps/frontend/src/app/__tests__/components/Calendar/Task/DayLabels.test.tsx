import React from "react";
import { render, screen } from "@testing-library/react";
import DayLabels from "@/app/components/Calendar/Task/DayLabels";

describe("DayLabels", () => {
  it("renders weekday and date number for each day", () => {
    const days = [new Date(2025, 0, 6, 12), new Date(2025, 0, 7, 12)];

    render(<DayLabels days={days} />);

    expect(screen.getByText("Mon")).toBeInTheDocument();
    expect(screen.getByText("Tue")).toBeInTheDocument();
    expect(screen.getByText("6")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
  });
});
