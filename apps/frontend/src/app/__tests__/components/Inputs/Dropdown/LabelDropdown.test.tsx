import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import LabelDropdown from "@/app/components/Inputs/Dropdown/LabelDropdown";

jest.mock("react-icons/fa6", () => ({
  FaCaretDown: () => <span data-testid="icon-caret" />,
}));

jest.mock("react-icons/io", () => ({
  IoIosWarning: () => <span data-testid="icon-warning" />,
}));

describe("LabelDropdown", () => {
  const options = [
    { label: "Dog", value: "dog" },
    { label: "Cat", value: "cat" },
  ];

  it("renders placeholder and error when no selection", () => {
    render(
      <LabelDropdown
        placeholder="Species"
        options={options}
        onSelect={jest.fn()}
        error="Required"
      />
    );

    expect(screen.getByText("Species")).toBeInTheDocument();
    expect(screen.getByText("Required")).toBeInTheDocument();
    expect(screen.getByTestId("icon-warning")).toBeInTheDocument();
  });

  it("opens and selects an option", () => {
    const onSelect = jest.fn();
    render(
      <LabelDropdown
        placeholder="Species"
        options={options}
        onSelect={onSelect}
      />
    );

    // Click on the placeholder text to open the dropdown
    fireEvent.click(screen.getByText("Species"));
    fireEvent.click(screen.getByText("Cat"));

    expect(onSelect).toHaveBeenCalledWith({ label: "Cat", value: "cat" });
    expect(screen.getByText("Cat")).toBeInTheDocument();
  });

  it("preselects default option", () => {
    render(
      <LabelDropdown
        placeholder="Species"
        options={options}
        defaultOption="dog"
        onSelect={jest.fn()}
      />
    );

    expect(screen.getByText("Dog")).toBeInTheDocument();
  });
});
