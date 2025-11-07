import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import CardHeader from "@/app/components/Cards/CardHeader/CardHeader";

describe("CardHeader", () => {
  const options = ["Last week", "Last month", "Last 6 months"];

  test("renders title and default option", () => {
    render(<CardHeader title="Explore" options={options} />);

    expect(screen.getByText("Explore")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Last week/i })
    ).toBeInTheDocument();
  });

  test("updates selection when option is clicked", () => {
    render(<CardHeader title="Explore" options={options} />);

    const toggle = screen.getByRole("button", { name: /Last week/i });
    fireEvent.click(toggle);

    const newOption = screen.getByRole("button", { name: "Last month" });
    fireEvent.click(newOption);

    expect(
      screen.getByRole("button", { name: /Last month/i })
    ).toBeInTheDocument();
  });

  test("closes dropdown when clicking outside", () => {
    render(<CardHeader title="Explore" options={options} />);

    const toggle = screen.getByRole("button", { name: /Last week/i });
    fireEvent.click(toggle);
    expect(screen.getByText("Last 6 months")).toBeInTheDocument();

    fireEvent.mouseDown(document.body);
    expect(screen.queryByText("Last 6 months")).not.toBeInTheDocument();
  });
});
