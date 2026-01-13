import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import LabelDropdown from "@/app/components/Inputs/Dropdown/LabelDropdown";

jest.mock("react-icons/fa6", () => ({
  FaCaretDown: () => <span data-testid="caret" />,
}));

jest.mock("react-icons/io", () => ({
  IoIosWarning: () => <span data-testid="warning" />,
}));

describe("LabelDropdown", () => {
  const options = [
    { key: "one", label: "One" },
    { key: "two", label: "Two" },
  ];

  it("renders placeholder and opens options", () => {
    const onSelect = jest.fn();
    render(
      <LabelDropdown
        placeholder="Select"
        options={options}
        onSelect={onSelect}
      />
    );

    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByText("One")).toBeInTheDocument();
    expect(screen.getByText("Two")).toBeInTheDocument();
  });

  it("selects option and calls onSelect", () => {
    const onSelect = jest.fn();
    render(
      <LabelDropdown
        placeholder="Select"
        options={options}
        onSelect={onSelect}
      />
    );

    fireEvent.click(screen.getByRole("button"));
    fireEvent.click(screen.getByText("Two"));

    expect(onSelect).toHaveBeenCalledWith(options[1]);
  });

  it("shows error when provided and no selection", () => {
    render(
      <LabelDropdown
        placeholder="Select"
        options={options}
        onSelect={jest.fn()}
        error="Required"
      />
    );

    expect(screen.getByText("Required")).toBeInTheDocument();
    expect(screen.getByTestId("warning")).toBeInTheDocument();
  });

  it("shows default selection when defaultOption is set", () => {
    render(
      <LabelDropdown
        placeholder="Select"
        options={options}
        defaultOption="two"
        onSelect={jest.fn()}
      />
    );

    expect(screen.getByText("Two")).toBeInTheDocument();
  });
});
