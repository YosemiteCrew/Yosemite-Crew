import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import TitleCalendar from "@/app/components/TitleCalendar";

jest.mock("@/app/components/Buttons", () => ({
  Primary: ({ text, onClick }: any) => (
    <button type="button" onClick={onClick}>
      {text}
    </button>
  ),
}));

jest.mock("@/app/components/Inputs/Datepicker", () => ({
  __esModule: true,
  default: ({ placeholder, setCurrentDate }: any) => (
    <button type="button" onClick={() => setCurrentDate(new Date("2025-01-01"))}>
      {placeholder}
    </button>
  ),
}));

jest.mock("@/app/components/Inputs/Dropdown", () => ({
  __esModule: true,
  default: ({ placeholder, options = [], onSelect }: any) => (
    <div>
      <span>{placeholder}</span>
      {options.map((option: any) => (
        <button
          key={option.key}
          type="button"
          onClick={() => onSelect(option)}
        >
          {option.label}
        </button>
      ))}
    </div>
  ),
}));

describe("TitleCalendar", () => {
  it("renders title and count, triggers actions", () => {
    const setAddPopup = jest.fn();
    const setActiveCalendar = jest.fn();
    const setCurrentDate = jest.fn();

    render(
      <TitleCalendar
        activeCalendar="day"
        title="Tasks"
        setActiveCalendar={setActiveCalendar}
        setAddPopup={setAddPopup}
        currentDate={new Date("2025-01-01")}
        setCurrentDate={setCurrentDate}
        count={3}
      />
    );

    expect(screen.getByText("Tasks")).toBeInTheDocument();
    expect(screen.getByText("(3)")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Add"));
    expect(setAddPopup).toHaveBeenCalledWith(true);

    fireEvent.click(screen.getByText("Week"));
    expect(setActiveCalendar).toHaveBeenCalledWith("week");
  });
});
