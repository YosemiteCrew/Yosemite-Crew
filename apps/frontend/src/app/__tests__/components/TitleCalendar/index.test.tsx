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
  default: ({ placeholder }: any) => <div>{placeholder}</div>,
}));

jest.mock("@/app/components/Inputs/Dropdown", () => ({
  __esModule: true,
  default: ({ onSelect }: any) => (
    <button type="button" onClick={() => onSelect({ key: "week" })}>
      view
    </button>
  ),
}));

jest.mock("react-icons/io", () => ({
  IoIosCalendar: () => <span>calendar-icon</span>,
}));

jest.mock("react-icons/md", () => ({
  MdTaskAlt: () => <span>list-icon</span>,
}));

describe("TitleCalendar", () => {
  it("handles add and view toggles", () => {
    const setAddPopup = jest.fn();
    const setActiveView = jest.fn();
    const setActiveCalendar = jest.fn();

    render(
      <TitleCalendar
        activeCalendar="day"
        title="Appointments"
        description="Desc"
        setActiveCalendar={setActiveCalendar}
        setAddPopup={setAddPopup}
        currentDate={new Date()}
        setCurrentDate={jest.fn()}
        count={2}
        activeView="calendar"
        setActiveView={setActiveView}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(setAddPopup).toHaveBeenCalledWith(true);

    fireEvent.click(screen.getByText("view"));
    expect(setActiveCalendar).toHaveBeenCalledWith("week");

    fireEvent.click(screen.getByText("list-icon"));
    expect(setActiveView).toHaveBeenCalledWith("list");
  });
});
