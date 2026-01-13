import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import Datepicker from "@/app/components/Inputs/Datepicker";

jest.mock("react-icons/io5", () => ({
  IoCalendarClear: () => <span data-testid="calendar-icon" />,
}));

jest.mock("react-icons/gr", () => ({
  GrNext: ({ onClick }: any) => (
    <button type="button" onClick={onClick}>
      Next
    </button>
  ),
  GrPrevious: ({ onClick }: any) => (
    <button type="button" onClick={onClick}>
      Prev
    </button>
  ),
}));

jest.mock("@/app/components/Inputs/Datepicker/Month", () => ({
  __esModule: true,
  default: () => <div data-testid="month-picker" />,
}));

jest.mock("@/app/components/Inputs/Datepicker/Year", () => ({
  __esModule: true,
  default: () => <div data-testid="year-picker" />,
}));

describe("Datepicker (index)", () => {
  it("opens calendar and selects a date", () => {
    const setCurrentDate = jest.fn();
    const date = new Date(2025, 0, 15);

    render(
      <Datepicker
        currentDate={date}
        setCurrentDate={setCurrentDate}
        placeholder="Select date"
        type="input"
      />
    );

    fireEvent.click(screen.getByLabelText("Toggle calendar"));

    const day = screen.getAllByText("15")[0];
    fireEvent.click(day);

    expect(setCurrentDate).toHaveBeenCalled();
  });

  it("toggles calendar with icon mode", () => {
    render(
      <Datepicker
        currentDate={new Date(2025, 0, 1)}
        setCurrentDate={jest.fn()}
        placeholder="Select date"
      />
    );

    fireEvent.click(screen.getByTestId("calendar-icon"));
    expect(screen.getByTestId("month-picker")).toBeInTheDocument();
  });
});
