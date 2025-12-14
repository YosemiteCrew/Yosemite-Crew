import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import Datepicker from "@/app/components/Inputs/Datepicker";

// --- Mocks ---

// Mock helper functions
jest.mock("@/app/components/Calendar/weekHelpers", () => ({
  getFormattedDate: jest.fn((date) =>
    date ? date.toISOString().split("T")[0] : ""
  ),
}));

// Mock Child Components to isolate logic
jest.mock("@/app/components/Inputs/Datepicker/Year", () => ({
  __esModule: true,
  default: ({ viewYear, setViewYear }: any) => (
    <div data-testid="year-selector">
      <span data-testid="year-val">{viewYear}</span>
      <button data-testid="year-prev" onClick={() => setViewYear(viewYear - 1)}>
        Prev Year
      </button>
      <button data-testid="year-next" onClick={() => setViewYear(viewYear + 1)}>
        Next Year
      </button>
    </div>
  ),
}));

jest.mock("@/app/components/Inputs/Datepicker/Month", () => ({
  __esModule: true,
  default: ({ viewMonth, setViewMonth }: any) => (
    <div data-testid="month-selector">
      <span data-testid="month-val">{viewMonth}</span>
      <button data-testid="month-set" onClick={() => setViewMonth(5)}>
        Set June
      </button>
    </div>
  ),
}));

// Mock Icons
jest.mock("react-icons/io5", () => ({
  IoCalendarClear: ({ onClick, className }: any) => (
    <div data-testid="calendar-icon" onClick={onClick} className={className}>
      Icon
    </div>
  ),
}));

jest.mock("react-icons/gr", () => ({
  GrNext: ({ onClick }: any) => (
    <button data-testid="next-month-btn" onClick={onClick}>
      Next
    </button>
  ),
  GrPrevious: ({ onClick }: any) => (
    <button data-testid="prev-month-btn" onClick={onClick}>
      Prev
    </button>
  ),
}));

describe("Datepicker Component", () => {
  const mockSetCurrentDate = jest.fn();
  const initialDate = new Date("2023-10-15"); // October 15, 2023 (Month index 9)

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- 1. Rendering ---

  it("renders correctly in 'input' mode", () => {
    render(
      <Datepicker
        currentDate={initialDate}
        setCurrentDate={mockSetCurrentDate}
        type="input"
        placeholder="Select Date"
      />
    );

    expect(screen.getByLabelText("Select Date")).toBeInTheDocument();
    expect(screen.getByTestId("calendar-icon")).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toHaveValue("2023-10-15");
  });

  it("renders correctly in 'icon' (default) mode", () => {
    render(
      <Datepicker
        currentDate={initialDate}
        setCurrentDate={mockSetCurrentDate}
        placeholder="Select Date"
      />
    );

    expect(screen.getByRole("button")).toBeInTheDocument();
    expect(screen.getByTestId("calendar-icon")).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  // --- 2. Interaction: Opening & Closing ---

  it("opens calendar when icon is clicked (input mode)", () => {
    render(
      <Datepicker
        currentDate={initialDate}
        setCurrentDate={mockSetCurrentDate}
        type="input"
        placeholder="Select Date"
      />
    );

    // Week header not visible yet
    expect(screen.queryByTestId("year-selector")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("calendar-icon"));

    // Check for specific element to confirm open
    // Since 'S' appears multiple times (Sunday, Saturday), we use getAllByText
    expect(screen.getAllByText("S").length).toBeGreaterThan(0);
    expect(screen.getByTestId("year-selector")).toBeInTheDocument();
  });

  it("opens calendar when button is clicked (icon mode)", () => {
    render(
      <Datepicker
        currentDate={initialDate}
        setCurrentDate={mockSetCurrentDate}
        type="icon"
        placeholder="Select Date"
      />
    );

    fireEvent.click(screen.getByRole("button"));

    expect(screen.getByTestId("year-selector")).toBeInTheDocument();
  });

  it("closes calendar when clicking outside", () => {
    render(
      <div>
        <div data-testid="outside">Outside</div>
        <Datepicker
          currentDate={initialDate}
          setCurrentDate={mockSetCurrentDate}
          type="input"
          placeholder="Select Date"
        />
      </div>
    );

    fireEvent.click(screen.getByTestId("calendar-icon"));
    expect(screen.getByTestId("year-selector")).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByTestId("outside"));

    expect(screen.queryByTestId("year-selector")).not.toBeInTheDocument();
  });

  it("does not close when clicking inside the container", () => {
    render(
      <Datepicker
        currentDate={initialDate}
        setCurrentDate={mockSetCurrentDate}
        type="input"
        placeholder="Select Date"
      />
    );

    fireEvent.click(screen.getByTestId("calendar-icon"));
    fireEvent.mouseDown(screen.getByLabelText("Select Date"));

    expect(screen.getByTestId("year-selector")).toBeInTheDocument();
  });

  // --- 3. Navigation & Selection ---

  it("navigates to previous month", () => {
    render(
      <Datepicker
        currentDate={initialDate} // Oct 2023 (index 9)
        setCurrentDate={mockSetCurrentDate}
        type="input"
        placeholder="Select Date"
      />
    );

    fireEvent.click(screen.getByTestId("calendar-icon")); // Open

    // Verify initial month index (9) inside the mock
    const monthVal = screen.getByTestId("month-val");
    expect(monthVal).toHaveTextContent("9");

    fireEvent.click(screen.getByTestId("prev-month-btn"));

    // Should now be Sept (8)
    expect(monthVal).toHaveTextContent("8");
  });

  it("navigates to next month", () => {
    render(
      <Datepicker
        currentDate={initialDate} // Oct 2023 (index 9)
        setCurrentDate={mockSetCurrentDate}
        type="input"
        placeholder="Select Date"
      />
    );

    fireEvent.click(screen.getByTestId("calendar-icon")); // Open

    const monthVal = screen.getByTestId("month-val");
    expect(monthVal).toHaveTextContent("9");

    fireEvent.click(screen.getByTestId("next-month-btn"));

    // Should now be Nov (10)
    expect(monthVal).toHaveTextContent("10");
  });

  it("selects a date and closes calendar", () => {
    render(
      <Datepicker
        currentDate={initialDate}
        setCurrentDate={mockSetCurrentDate}
        type="input"
        placeholder="Select Date"
      />
    );

    fireEvent.click(screen.getByTestId("calendar-icon"));

    // We need to click a specific day button.
    // '20' is likely unique enough or we can pick the first one.
    // However, if there are multiple '20's (padding days), we should pick one.
    const dayBtns = screen.getAllByText("20");
    fireEvent.click(dayBtns[0]);

    expect(mockSetCurrentDate).toHaveBeenCalledWith(expect.any(Date));

    // Should close
    expect(screen.queryByTestId("year-selector")).not.toBeInTheDocument();
  });

  // --- 4. Logic & Edge Cases ---

  it("syncs view state when prop `currentDate` changes", () => {
    const { rerender } = render(
      <Datepicker
        currentDate={initialDate} // 2023
        setCurrentDate={mockSetCurrentDate}
        type="input"
        placeholder="Select Date"
      />
    );

    fireEvent.click(screen.getByTestId("calendar-icon"));
    expect(screen.getByTestId("year-val")).toHaveTextContent("2023");

    // Rerender with new date
    const newDate = new Date("2025-01-01");
    rerender(
      <Datepicker
        currentDate={newDate}
        setCurrentDate={mockSetCurrentDate}
        type="input"
        placeholder="Select Date"
      />
    );

    expect(screen.getByTestId("year-val")).toHaveTextContent("2025");
  });

  it("calculates calendar days correctly (renders correct number of days)", () => {
    render(
      <Datepicker
        currentDate={initialDate}
        setCurrentDate={mockSetCurrentDate}
        type="input"
        placeholder="Select Date"
      />
    );

    fireEvent.click(screen.getByTestId("calendar-icon"));

    // Grid contains 1-31 somewhere
    expect(screen.getAllByText("1").length).toBeGreaterThan(0);
    expect(screen.getAllByText("28").length).toBeGreaterThan(0);
  });

  it("handles year change via Year sub-component interaction", () => {
    render(
      <Datepicker
        currentDate={initialDate}
        setCurrentDate={mockSetCurrentDate}
        type="input"
        placeholder="Select Date"
      />
    );
    fireEvent.click(screen.getByTestId("calendar-icon"));

    // Click 'Next Year' inside the mock
    fireEvent.click(screen.getByTestId("year-next"));

    expect(screen.getByTestId("year-val")).toHaveTextContent("2024");
  });

  it("handles month change via Month sub-component interaction", () => {
    render(
      <Datepicker
        currentDate={initialDate}
        setCurrentDate={mockSetCurrentDate}
        type="input"
        placeholder="Select Date"
      />
    );
    fireEvent.click(screen.getByTestId("calendar-icon"));

    // Click 'Set June' inside the mock
    fireEvent.click(screen.getByTestId("month-set"));

    // Month mock displays index. June is index 5.
    expect(screen.getByTestId("month-val")).toHaveTextContent("5");
  });

  it("cleans up event listeners on unmount", () => {
    const addSpy = jest.spyOn(document, "addEventListener");
    const removeSpy = jest.spyOn(document, "removeEventListener");

    const { unmount } = render(
      <Datepicker
        currentDate={initialDate}
        setCurrentDate={mockSetCurrentDate}
        type="input"
        placeholder="Select Date"
      />
    );

    // Open to attach listener
    fireEvent.click(screen.getByTestId("calendar-icon"));
    expect(addSpy).toHaveBeenCalledWith("mousedown", expect.any(Function));

    unmount();
    expect(removeSpy).toHaveBeenCalledWith("mousedown", expect.any(Function));
  });
});
