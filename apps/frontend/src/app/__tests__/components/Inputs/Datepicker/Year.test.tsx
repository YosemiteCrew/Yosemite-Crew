import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import Year from "@/app/components/Inputs/Datepicker/Year";

const mockYears = [2020, 2021, 2022, 2023, 2024];

describe("Year Component", () => {
  const mockSetViewYear = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- 1. Rendering ---

  it("renders the selected year correctly", () => {
    render(
      <Year viewYear={2022} years={mockYears} setViewYear={mockSetViewYear} />
    );

    // The main button should show "2022"
    const triggerButton = screen.getByRole("button", { name: "2022" });
    expect(triggerButton).toBeInTheDocument();

    // The dropdown should be closed initially
    expect(screen.queryByText("2023")).not.toBeInTheDocument();
  });

  // --- 2. Interaction (Open/Toggle) ---

  it("opens the dropdown when the button is clicked", () => {
    render(
      <Year viewYear={2022} years={mockYears} setViewYear={mockSetViewYear} />
    );

    const triggerButton = screen.getByRole("button", { name: "2022" });

    // Click to open
    fireEvent.click(triggerButton);

    // Now other years should be visible in the dropdown
    expect(screen.getByText("2020")).toBeInTheDocument();
    expect(screen.getByText("2024")).toBeInTheDocument();
  });

  it("closes the dropdown when the button is clicked again", () => {
    render(
      <Year viewYear={2022} years={mockYears} setViewYear={mockSetViewYear} />
    );

    const triggerButton = screen.getByRole("button", { name: "2022" });

    // Open
    fireEvent.click(triggerButton);
    expect(screen.getByText("2024")).toBeInTheDocument();

    // Close
    fireEvent.click(triggerButton);
    expect(screen.queryByText("2024")).not.toBeInTheDocument();
  });

  // --- 3. Selection Logic ---

  it("calls setViewYear with correct year and closes dropdown on selection", () => {
    render(
      <Year viewYear={2022} years={mockYears} setViewYear={mockSetViewYear} />
    );

    // Open dropdown
    fireEvent.click(screen.getByRole("button", { name: "2022" }));

    // Click "2024"
    const yearOption = screen.getByText("2024");
    fireEvent.click(yearOption);

    // Verify state update
    expect(mockSetViewYear).toHaveBeenCalledWith(2024);

    // Verify dropdown closed
    expect(screen.queryByText("2020")).not.toBeInTheDocument();
  });

  // --- 4. Click Outside (useEffect) ---

  it("closes the dropdown when clicking outside the component", () => {
    render(
      <div>
        <Year viewYear={2022} years={mockYears} setViewYear={mockSetViewYear} />
        <div data-testid="outside-element">Outside</div>
      </div>
    );

    // Open dropdown first
    fireEvent.click(screen.getByRole("button", { name: "2022" }));
    expect(screen.getByText("2024")).toBeInTheDocument();

    // Simulate click outside
    // The component listens for "mousedown", so we fire that specific event
    fireEvent.mouseDown(screen.getByTestId("outside-element"));

    // Dropdown should disappear
    expect(screen.queryByText("2024")).not.toBeInTheDocument();
  });

  it("does not close if clicking inside the dropdown container", () => {
    render(
      <Year viewYear={2022} years={mockYears} setViewYear={mockSetViewYear} />
    );

    // Open dropdown
    fireEvent.click(screen.getByRole("button", { name: "2022" }));

    const yearOption = screen.getByText("2024");

    // Simulate mousedown on an option (which is "inside")
    fireEvent.mouseDown(yearOption);

    // Should still be open (the actual closing happens on 'click', ensuring mousedown listener doesn't interfere)
    expect(yearOption).toBeInTheDocument();
  });
});
