import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import TimeSlot from "@/app/components/Availability/TimeSlot";

const interval = { start: "", end: "" };
const timeOptions = [
  { value: "09:00", label: "09:00 AM" },
  { value: "10:00", label: "10:00 AM" },
];

describe("TimeSlot", () => {
  test("opens dropdown and updates interval via setAvailability", () => {
    const setAvailability = jest.fn((updater) => {
      const prev: any = {
        Monday: { enabled: true, intervals: [{ start: "", end: "" }] },
      };
      const next = updater(prev);
      expect(next.Monday.intervals[0].start).toBe("09:00");
    });

    render(
      <TimeSlot
        interval={interval}
        timeOptions={timeOptions}
        setAvailability={setAvailability as any}
        day="Monday"
        intervalIndex={0}
        field="start"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Select" }));
    fireEvent.click(screen.getByRole("button", { name: "09:00 AM" }));

    expect(setAvailability).toHaveBeenCalled();
  });
});
