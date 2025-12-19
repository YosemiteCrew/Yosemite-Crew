import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import Month from "@/app/components/Inputs/Datepicker/Month";

const mockMonthNames = ["January", "February", "March", "April"];

describe("Month Component", () => {
  const mockSetViewMonth = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- 1. Rendering ---

  it("renders the selected month name correctly", () => {
    render(
      <Month
        viewMonth={0} // January
        monthNames={mockMonthNames}
        setViewMonth={mockSetViewMonth}
      />
    );

    // The main button should show "January"
    const triggerButton = screen.getByRole("button", { name: "January" });
    expect(triggerButton).toBeInTheDocument();

    // The dropdown should be closed initially, so "February" shouldn't be visible
    expect(screen.queryByText("February")).not.toBeInTheDocument();
  });

  // --- 2. Interaction (Open/Toggle) ---

  it("opens the dropdown when the button is clicked", () => {
    render(
      <Month
        viewMonth={0}
        monthNames={mockMonthNames}
        setViewMonth={mockSetViewMonth}
      />
    );

    const triggerButton = screen.getByRole("button", { name: "January" });

    // Click to open
    fireEvent.click(triggerButton);

    // Now other months should be visible in the dropdown
    expect(screen.getByText("February")).toBeInTheDocument();
    expect(screen.getByText("March")).toBeInTheDocument();
  });

  it("closes the dropdown when the button is clicked again", () => {
    render(
      <Month
        viewMonth={0}
        monthNames={mockMonthNames}
        setViewMonth={mockSetViewMonth}
      />
    );

    const triggerButton = screen.getByRole("button", { name: "January" });

    // Open
    fireEvent.click(triggerButton);
    expect(screen.getByText("February")).toBeInTheDocument();

    // Close
    fireEvent.click(triggerButton);
    expect(screen.queryByText("February")).not.toBeInTheDocument();
  });

  // --- 3. Selection Logic ---

  it("calls setViewMonth with correct index and closes dropdown on selection", () => {
    render(
      <Month
        viewMonth={0}
        monthNames={mockMonthNames}
        setViewMonth={mockSetViewMonth}
      />
    );

    // Open dropdown
    fireEvent.click(screen.getByRole("button", { name: "January" }));

    // Click "March" (Index 2)
    // Note: Use getAllByText because if viewMonth was March, there would be two.
    // In this case (viewMonth=0), "March" is unique.
    const marchOption = screen.getByText("March");
    fireEvent.click(marchOption);

    // Verify state update (Index 2)
    expect(mockSetViewMonth).toHaveBeenCalledWith(2);

    // Verify dropdown closed (State update usually triggers rerender, but local state 'open' is set to false)
    expect(screen.queryByText("February")).not.toBeInTheDocument();
  });

  // --- 4. Click Outside (useEffect) ---

  it("closes the dropdown when clicking outside the component", () => {
    render(
      <div>
        <Month
          viewMonth={0}
          monthNames={mockMonthNames}
          setViewMonth={mockSetViewMonth}
        />
        <div data-testid="outside-element">Outside</div>
      </div>
    );

    // Open dropdown first
    fireEvent.click(screen.getByRole("button", { name: "January" }));
    expect(screen.getByText("February")).toBeInTheDocument();

    // Simulate click outside
    // The component listens for "mousedown", so we fire that specific event
    fireEvent.mouseDown(screen.getByTestId("outside-element"));

    // Dropdown should disappear
    expect(screen.queryByText("February")).not.toBeInTheDocument();
  });

  it("does not close if clicking inside the dropdown container", () => {
    render(
      <Month
        viewMonth={0}
        monthNames={mockMonthNames}
        setViewMonth={mockSetViewMonth}
      />
    );

    // Open dropdown
    fireEvent.click(screen.getByRole("button", { name: "January" }));

    // Find a dropdown item
    const febOption = screen.getByText("February");

    // Simulate mousedown on an option (which is "inside")
    // Note: The click handler on the button handles the actual selection logic,
    // but the 'mousedown' listener on document checks for outside clicks.
    // We want to ensure the *outside listener* doesn't fire for inside clicks.
    fireEvent.mouseDown(febOption);

    // Should still be open (technically it closes on 'click', but the mousedown listener shouldn't have closed it yet)
    expect(febOption).toBeInTheDocument();
  });
});
