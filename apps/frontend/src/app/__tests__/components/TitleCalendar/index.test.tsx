import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import TitleCalendar from "@/app/components/TitleCalendar";

const dropdownProps: any[] = [];

jest.mock("@/app/components/Buttons", () => ({
  Primary: ({ text, onClick }: any) => (
    <button type="button" onClick={onClick}>
      {text}
    </button>
  ),
}));

jest.mock("@/app/components/Inputs/Datepicker", () => ({
  __esModule: true,
  default: () => <div data-testid="datepicker" />,
}));

jest.mock("@/app/components/Inputs/Dropdown", () => (props: any) => {
  dropdownProps.push(props);
  return <div data-testid="view-dropdown" />;
});

describe("TitleCalendar", () => {
  beforeEach(() => {
    dropdownProps.length = 0;
  });

  it("renders title, count, and add button", () => {
    const setAddPopup = jest.fn();

    render(
      <TitleCalendar
        activeCalendar="day"
        title="Appointments"
        description="Daily schedule"
        setActiveCalendar={jest.fn()}
        setAddPopup={setAddPopup}
        currentDate={new Date("2025-01-06T00:00:00Z")}
        setCurrentDate={jest.fn()}
        count={3}
        activeView="calendar"
        setActiveView={jest.fn()}
        showAdd
      />
    );

    expect(screen.getByText("Appointments")).toBeInTheDocument();
    expect(screen.getByText("(3)")).toBeInTheDocument();
    expect(screen.getByText("Daily schedule")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Add"));
    expect(setAddPopup).toHaveBeenCalledWith(true);
  });

  it("toggles active view and selects calendar", () => {
    const setActiveView = jest.fn();
    const setActiveCalendar = jest.fn();

    render(
      <TitleCalendar
        activeCalendar="day"
        title="Appointments"
        setActiveCalendar={setActiveCalendar}
        setAddPopup={jest.fn()}
        currentDate={new Date("2025-01-06T00:00:00Z")}
        setCurrentDate={jest.fn()}
        count={3}
        activeView="calendar"
        setActiveView={setActiveView}
        showAdd={false}
      />
    );

    const viewButtons = screen.getAllByRole("button");
    fireEvent.click(viewButtons[0]);
    fireEvent.click(viewButtons[1]);

    expect(setActiveView).toHaveBeenCalledWith("calendar");
    expect(setActiveView).toHaveBeenCalledWith("list");

    const latestDropdown = dropdownProps[dropdownProps.length - 1];
    latestDropdown.onSelect({ key: "week" });
    expect(setActiveCalendar).toHaveBeenCalledWith("week");
  });
});
