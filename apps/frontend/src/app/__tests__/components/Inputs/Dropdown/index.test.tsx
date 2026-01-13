import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import Dropdown from "@/app/components/Inputs/Dropdown";

jest.mock("react-icons/fa6", () => ({
  FaCaretDown: () => <span data-testid="caret" />,
}));

jest.mock("react-icons/io", () => ({
  IoIosWarning: () => <span data-testid="warning" />,
}));

describe("Dropdown (index)", () => {
  const options = [
    { key: "day", label: "Day" },
    { key: "week", label: "Week" },
  ];

  it("renders placeholder and toggles options", () => {
    render(
      <Dropdown placeholder="View" options={options} onSelect={jest.fn()} />
    );

    fireEvent.click(screen.getByText("View").closest("button")!);
    expect(screen.getByText("Day")).toBeInTheDocument();
    expect(screen.getByText("Week")).toBeInTheDocument();

    fireEvent.click(screen.getByText("View").closest("button")!);
    expect(screen.queryByText("Day")).not.toBeInTheDocument();
  });

  it("selects option and calls onSelect", () => {
    const onSelect = jest.fn();
    render(
      <Dropdown placeholder="View" options={options} onSelect={onSelect} />
    );

    fireEvent.click(screen.getByText("View").closest("button")!);
    fireEvent.click(screen.getByText("Week"));

    expect(onSelect).toHaveBeenCalledWith(options[1]);
    expect(screen.queryByText("Day")).not.toBeInTheDocument();
  });

  it("shows error message", () => {
    render(
      <Dropdown
        placeholder="View"
        options={options}
        onSelect={jest.fn()}
        error="Required"
      />
    );

    expect(screen.getByText("Required")).toBeInTheDocument();
    expect(screen.getByTestId("warning")).toBeInTheDocument();
  });
});
