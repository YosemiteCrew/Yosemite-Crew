import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import "../../../../jest.mocks/testMocks";

const mockOnChange = jest.fn();

jest.mock("react-datepicker", () => ({
  __esModule: true,
  default: ({ selected, onChange, customInput }: any) => (
    <div data-testid="datepicker-mock">
      <div data-testid="selected-value">
        {selected ? selected.toISOString() : "null"}
      </div>
      <button
        type="button"
        onClick={() => onChange(new Date("2025-01-01T00:00:00.000Z"))}
      >
        change-date
      </button>
      {customInput}
    </div>
  ),
}));

import DateInput from "@/app/components/Inputs/Date/DateInput";

describe("<DateInput />", () => {
  beforeEach(() => {
    mockOnChange.mockClear();
  });

  test("renders custom input and forwards selected value", () => {
    const value = new Date("2024-12-24T00:00:00.000Z");
    render(<DateInput value={value} onChange={mockOnChange} />);

    expect(screen.getByTestId("selected-value")).toHaveTextContent(
      value.toISOString()
    );
    expect(screen.getByRole("button", { name: "change-date" })).toBeInTheDocument();
  });

  test("invokes onChange when mock picker emits value", () => {
    render(
      <DateInput value={new Date("2024-01-01T00:00:00.000Z")} onChange={mockOnChange} />
    );

    fireEvent.click(screen.getByRole("button", { name: "change-date" }));
    expect(mockOnChange).toHaveBeenCalledWith(
      new Date("2025-01-01T00:00:00.000Z")
    );
  });
});
