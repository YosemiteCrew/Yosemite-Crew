import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import DayLabels from "@/app/components/Calendar/common/DayLabels";

describe("DayLabels Component", () => {
  const mockOnPrevWeek = jest.fn();
  const mockOnNextWeek = jest.fn();

  // Test Data: Jan 1 2023 (Sunday) to Jan 7 2023 (Saturday)
  const mockDays = [
    new Date(2023, 0, 1), // Sun 1
    new Date(2023, 0, 2), // Mon 2
    new Date(2023, 0, 3), // Tue 3
    new Date(2023, 0, 4), // Wed 4
    new Date(2023, 0, 5), // Thu 5
    new Date(2023, 0, 6), // Fri 6
    new Date(2023, 0, 7), // Sat 7
  ];

  const defaultProps = {
    days: mockDays,
    onPrevWeek: mockOnPrevWeek,
    onNextWeek: mockOnNextWeek,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- 1. Rendering Logic ---

  it("renders the correct day names and numbers", () => {
    render(<DayLabels {...defaultProps} />);

    // Check for "Sun" and "1"
    expect(screen.getByText("Sun")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();

    // Check for "Wed" and "4"
    expect(screen.getByText("Wed")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();

    // Check for "Sat" and "7"
    expect(screen.getByText("Sat")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
  });

  it("renders correctly with an empty days array", () => {
    render(<DayLabels {...defaultProps} days={[]} />);
    // Should still render navigation buttons, but no day labels
    expect(document.querySelectorAll("svg")).toHaveLength(2);
    // Ensure no "Sun" text exists
    expect(screen.queryByText("Sun")).not.toBeInTheDocument();
  });

  // --- 2. Interaction Handlers ---

  it("triggers onPrevWeek when previous icon is clicked", () => {
    render(<DayLabels {...defaultProps} />);

    // The previous icon is the first SVG in the DOM structure
    const prevBtn = document.querySelectorAll("svg")[0];
    fireEvent.click(prevBtn);

    expect(mockOnPrevWeek).toHaveBeenCalledTimes(1);
  });

  it("triggers onNextWeek when next icon is clicked", () => {
    render(<DayLabels {...defaultProps} />);

    // The next icon is the second SVG in the DOM structure
    const nextBtn = document.querySelectorAll("svg")[1];
    fireEvent.click(nextBtn);

    expect(mockOnNextWeek).toHaveBeenCalledTimes(1);
  });

  // --- 3. Styling Logic (Branch Coverage) ---

  it("applies default grid layout styling when taskView is false (or undefined)", () => {
    const { container } = render(
      <DayLabels {...defaultProps} taskView={false} />
    );

    // The default layout uses 80px side columns
    const gridContainer = container.firstChild;
    expect(gridContainer).toHaveClass("grid-cols-[80px_minmax(0,1fr)_80px]");
    expect(gridContainer).not.toHaveClass(
      "grid-cols-[40px_minmax(0,1fr)_40px]"
    );
  });

  it("applies compact grid layout styling when taskView is true", () => {
    const { container } = render(
      <DayLabels {...defaultProps} taskView={true} />
    );

    // The task view layout uses 40px side columns
    const gridContainer = container.firstChild;
    expect(gridContainer).toHaveClass("grid-cols-[40px_minmax(0,1fr)_40px]");
    expect(gridContainer).not.toHaveClass(
      "grid-cols-[80px_minmax(0,1fr)_80px]"
    );
  });
});
