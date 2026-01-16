import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import UserLabels from "@/app/components/Calendar/Task/UserLabels";

const team = [
  { name: "Avery" },
  { name: "Blake" },
] as any;

describe("UserLabels", () => {
  it("renders team names with the current date", () => {
    const currentDate = new Date("2024-04-15T10:00:00Z");

    render(<UserLabels team={team} currentDate={currentDate} />);

    expect(screen.getByText("Avery")).toBeInTheDocument();
    expect(screen.getByText("Blake")).toBeInTheDocument();

    const weekday = currentDate.toLocaleDateString("en-US", { weekday: "short" });
    expect(screen.getAllByText(weekday)).toHaveLength(2);

    expect(screen.getAllByText(String(currentDate.getDate()))).toHaveLength(2);
  });
});
