import React, { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import Dublicate from "@/app/components/Availability/Dublicate";
import { AvailabilityState, daysOfWeek } from "@/app/components/Availability/utils";

jest.mock("react-icons/io5", () => ({
  IoCopy: ({ onClick, ...rest }: any) => (
    <button type="button" onClick={onClick} {...rest}>
      copy
    </button>
  ),
}));

const buildAvailability = (): AvailabilityState =>
  daysOfWeek.reduce<AvailabilityState>((acc, day) => {
    acc[day] = {
      enabled: day === "Monday",
      intervals: [{ start: "09:00", end: "10:00" }],
    };
    return acc;
  }, {} as AvailabilityState);

const Wrapper = () => {
  const [availability, setAvailability] = useState(buildAvailability());
  const tuesday = availability.Tuesday;
  return (
    <>
      <Dublicate setAvailability={setAvailability} day="Monday" />
      <div data-testid="tuesday-enabled">{String(tuesday.enabled)}</div>
      <div data-testid="tuesday-intervals">
        {tuesday.intervals.map((i) => `${i.start}-${i.end}`).join(",")}
      </div>
    </>
  );
};

describe("Dublicate", () => {
  it("copies intervals to selected days", () => {
    render(<Wrapper />);

    fireEvent.click(screen.getByText("copy"));
    const checkbox = document.getElementById(
      "availability-duplicate-Tuesday-check"
    ) as HTMLInputElement;
    fireEvent.click(checkbox);

    fireEvent.click(screen.getByText("Apply"));

    expect(screen.getByTestId("tuesday-enabled")).toHaveTextContent("true");
    expect(screen.getByTestId("tuesday-intervals")).toHaveTextContent(
      "09:00-10:00"
    );
  });

  it("closes without changes when no target selected", () => {
    render(<Wrapper />);

    fireEvent.click(screen.getByText("copy"));
    fireEvent.click(screen.getByText("Apply"));

    expect(screen.getByTestId("tuesday-enabled")).toHaveTextContent("false");
    expect(screen.getByTestId("tuesday-intervals")).toHaveTextContent(
      "09:00-10:00"
    );
  });
});
