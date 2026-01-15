import React, { useState } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import Availability from "@/app/components/Availability/Availability";
import { daysOfWeek, DEFAULT_INTERVAL, AvailabilityState } from "@/app/components/Availability/utils";

jest.mock("@/app/components/Availability/TimeSlot", () => ({
  __esModule: true,
  default: ({ day, field, intervalIndex }: any) => (
    <div data-testid={`slot-${day}-${field}-${intervalIndex}`} />
  ),
}));

jest.mock("@/app/components/Availability/Dublicate", () => ({
  __esModule: true,
  default: ({ day }: any) => <div data-testid={`duplicate-${day}`} />,
}));

jest.mock("react-icons/fa6", () => ({
  FaCirclePlus: ({ onClick }: any) => (
    <button type="button" onClick={onClick}>
      plus
    </button>
  ),
  FaCircleMinus: ({ onClick }: any) => (
    <button type="button" onClick={onClick}>
      minus
    </button>
  ),
}));

const buildAvailability = (): AvailabilityState =>
  daysOfWeek.reduce<AvailabilityState>((acc, day) => {
    acc[day] = {
      enabled: day === "Monday",
      intervals: [{ ...DEFAULT_INTERVAL }],
    };
    return acc;
  }, {} as AvailabilityState);

const Wrapper = () => {
  const [availability, setAvailability] = useState(buildAvailability());
  return (
    <Availability
      availability={availability}
      setAvailability={setAvailability}
    />
  );
};

describe("Availability", () => {
  it("toggles a day on checkbox click", () => {
    render(<Wrapper />);

    const mondayRow = screen.getByText("Monday").closest("div");
    const checkbox = within(mondayRow!).getByRole("checkbox");

    expect(checkbox).toBeChecked();
    fireEvent.click(checkbox);
    expect(checkbox).not.toBeChecked();
  });

  it("adds and removes intervals", () => {
    render(<Wrapper />);

    expect(screen.getAllByTestId(/slot-Monday/)).toHaveLength(2);

    fireEvent.click(screen.getByText("plus"));
    expect(screen.getAllByTestId(/slot-Monday/)).toHaveLength(4);

    fireEvent.click(screen.getByText("minus"));
    expect(screen.getAllByTestId(/slot-Monday/)).toHaveLength(2);
  });

  it("renders duplicate controls for enabled day", () => {
    render(<Wrapper />);

    expect(screen.getByTestId("duplicate-Monday")).toBeInTheDocument();
    expect(screen.queryByTestId("duplicate-Tuesday")).not.toBeInTheDocument();
  });
});
