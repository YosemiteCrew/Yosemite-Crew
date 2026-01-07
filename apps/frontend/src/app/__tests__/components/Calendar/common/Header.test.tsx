import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import Header from "@/app/components/Calendar/common/Header";

// --- Mocks ---

// Mock Helper
jest.mock("@/app/components/Calendar/helpers", () => ({
  getMonthYear: jest.fn(() => "January 2023"),
}));
import { getMonthYear } from "@/app/components/Calendar/helpers";

describe("Header Component", () => {
  const mockSetCurrentDate = jest.fn();
  const mockDate = new Date("2023-01-15T00:00:00.000Z");

  const defaultProps = {
    currentDate: mockDate,
    setCurrentDate: mockSetCurrentDate,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- 1. Rendering ---

  it("renders the month/year label correctly", () => {
    render(<Header {...defaultProps} />);

    // Expect mocked output
    expect(screen.getByText("January 2023")).toBeInTheDocument();

    // Verify helper was called with correct date
    expect(getMonthYear).toHaveBeenCalledWith(mockDate);
  });

  it("renders navigation icons", () => {
    render(<Header {...defaultProps} />);
    // react-icons render as SVGs
    expect(document.querySelectorAll("svg")).toHaveLength(2);
  });

  // --- 2. Navigation Handlers ---

  it("handles Previous Month navigation", () => {
    render(<Header {...defaultProps} />);

    // Previous button is the first SVG
    const prevBtn = document.querySelectorAll("svg")[0];
    fireEvent.click(prevBtn);

    expect(mockSetCurrentDate).toHaveBeenCalledTimes(1);

    // Verify state update function logic
    const updateFn = mockSetCurrentDate.mock.calls[0][0];
    const prevDate = new Date("2023-01-15");
    const newDate = updateFn(prevDate);

    // 15 Jan -> 15 Dec (Previous Month)
    // Note: getMonth() returns 0 for Jan. 0 - 1 = -1, which Date handles as Dec prev year.
    expect(newDate.getMonth()).toBe(11); // December
    expect(newDate.getFullYear()).toBe(2022);
  });

  it("handles Next Month navigation", () => {
    render(<Header {...defaultProps} />);

    // Next button is the second SVG
    const nextBtn = document.querySelectorAll("svg")[1];
    fireEvent.click(nextBtn);

    expect(mockSetCurrentDate).toHaveBeenCalledTimes(1);

    // Verify state update function logic
    const updateFn = mockSetCurrentDate.mock.calls[0][0];
    const prevDate = new Date("2023-01-15");
    const newDate = updateFn(prevDate);

    // 15 Jan -> 15 Feb (Next Month)
    expect(newDate.getMonth()).toBe(1); // February
    expect(newDate.getFullYear()).toBe(2023);
  });
});
