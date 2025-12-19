import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import SelectLabel from "@/app/components/Inputs/SelectLabel";

// --- Test Data ---

const mockOptions = [
  { name: "Option 1", key: "opt1" },
  { name: "Option 2", key: "opt2" },
  { name: "Option 3", key: "opt3" },
];

describe("SelectLabel Component", () => {
  const mockSetOption = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- 1. Rendering ---

  it("renders title and options correctly", () => {
    render(
      <SelectLabel
        title="Select Preference"
        options={mockOptions}
        activeOption="opt1"
        setOption={mockSetOption}
      />
    );

    // Title
    expect(screen.getByText("Select Preference")).toBeInTheDocument();

    // Options
    expect(screen.getByText("Option 1")).toBeInTheDocument();
    expect(screen.getByText("Option 2")).toBeInTheDocument();
    expect(screen.getByText("Option 3")).toBeInTheDocument();
  });

  // --- 2. Interaction ---

  it("calls setOption with the correct key when an option is clicked", () => {
    render(
      <SelectLabel
        title="Test"
        options={mockOptions}
        activeOption="opt1"
        setOption={mockSetOption}
      />
    );

    const option2 = screen.getByRole("button", { name: "Option 2" });
    fireEvent.click(option2);

    expect(mockSetOption).toHaveBeenCalledWith("opt2");
  });

  // --- 3. Styling & Layout Types ---

  it("applies active styles to the selected option", () => {
    render(
      <SelectLabel
        title="Test"
        options={mockOptions}
        activeOption="opt2" // Option 2 is active
        setOption={mockSetOption}
      />
    );

    const option1 = screen.getByRole("button", { name: "Option 1" });
    const option2 = screen.getByRole("button", { name: "Option 2" });

    // Active Style Logic: "border-blue-text! bg-blue-light! text-blue-text!"
    expect(option2.className).toContain("bg-blue-light!");
    expect(option2.className).toContain("text-blue-text!");

    // Inactive Style Logic: "border-black-text! text-black-text"
    expect(option1.className).toContain("border-black-text!");
    expect(option1.className).not.toContain("bg-blue-light!");
  });

  it("renders correct layout classes for default (row) type", () => {
    const { container } = render(
      <SelectLabel
        title="Row Layout"
        options={mockOptions}
        activeOption="opt1"
        setOption={mockSetOption}
        // type undefined -> default row logic
      />
    );

    // Container should match `type !== "coloumn" ? "flex-row items-center" : ...`
    const mainContainer = container.firstChild;
    expect(mainContainer).toHaveClass("flex-row");
    expect(mainContainer).toHaveClass("items-center");

    // Button container should match `type !== "coloumn" ? "flex-1" : ...`
    // The second div inside main container holds the buttons
    const buttonContainer = mainContainer?.childNodes[1];
    expect(buttonContainer).toHaveClass("flex-1");
    expect(buttonContainer).not.toHaveClass("flex-wrap");

    // Buttons should have "flex-1"
    const buttons = screen.getAllByRole("button");
    expect(buttons[0]).toHaveClass("flex-1");
  });

  it("renders correct layout classes for 'coloumn' type", () => {
    const { container } = render(
      <SelectLabel
        title="Column Layout"
        options={mockOptions}
        activeOption="opt1"
        setOption={mockSetOption}
        type="coloumn" // Typo 'coloumn' matches source code
      />
    );

    const mainContainer = container.firstChild;
    expect(mainContainer).toHaveClass("flex-col");
    expect(mainContainer).not.toHaveClass("items-center");

    const buttonContainer = mainContainer?.childNodes[1];
    expect(buttonContainer).toHaveClass("flex-wrap");
    expect(buttonContainer).not.toHaveClass("flex-1");

    const buttons = screen.getAllByRole("button");
    // Buttons should NOT have "flex-1" in column mode
    expect(buttons[0]).not.toHaveClass("flex-1");
  });
});
