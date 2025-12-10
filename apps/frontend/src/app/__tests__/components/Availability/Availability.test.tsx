import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom";

import Availability from "@/app/components/Availability/Availability";

describe("Availability", () => {
  test("renders all days with Monday enabled by default", () => {
    render(<Availability />);

    const mondayCheckbox = screen.getByLabelText<HTMLInputElement>("Monday");
    expect(mondayCheckbox).toBeChecked();

    const days = [
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday",
    ];
    for (const day of days) {
      expect(screen.getByLabelText(day)).toBeInTheDocument();
    }
  });

  test("adds new interval when clicking add button", () => {
    render(<Availability />);

    const mondayDay = screen
      .getByText("Monday")
      .closest(".availability-day") as HTMLElement;
    const addButton = within(mondayDay).getByTitle("Add interval");
    fireEvent.click(addButton);

    const intervals = mondayDay.querySelectorAll(".availability-interval");
    expect(intervals.length).toBe(2);
  });
});
