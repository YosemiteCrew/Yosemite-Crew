import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import Dublicate from "@/app/components/Availability/Dublicate";

describe("Dublicate", () => {
  test("copies intervals to selected days", () => {
    const mondayIntervals = [{ start: "09:00", end: "10:00" }];
    const setAvailability = jest.fn((updater) => {
      const prev: any = {
        Monday: { enabled: true, intervals: mondayIntervals },
        Tuesday: { enabled: false, intervals: [] },
      };
      const next = updater(prev);
      expect(next.Tuesday.enabled).toBe(true);
      expect(next.Tuesday.intervals).toEqual(mondayIntervals);
    });

    render(
      <Dublicate day="Monday" setAvailability={setAvailability as any} />
    );

    fireEvent.click(screen.getByLabelText("dublicate-button"));
    const checkbox = screen.getByLabelText("Tuesday");
    fireEvent.click(checkbox);
    fireEvent.click(screen.getByText("Apply"));

    expect(setAvailability).toHaveBeenCalled();
  });
});
