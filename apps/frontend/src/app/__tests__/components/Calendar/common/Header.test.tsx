import React from "react";
import { render, screen } from "@testing-library/react";
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

});
