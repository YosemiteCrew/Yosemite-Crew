/* eslint-disable @next/next/no-img-element */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import Slot from "@/app/components/Calendar/common/Slot";
import { Appointment } from "@yosemite-crew/types";

jest.mock("next/image", () => ({
  __esModule: true,
  default: (props: any) => <img alt={props.alt} {...props} />,
}));

jest.mock("@/app/components/DataTable/Appointments", () => ({
  getStatusStyle: () => ({}),
}));

jest.mock("@/app/utils/urls", () => ({
  getSafeImageUrl: () => "/img.png",
}));

jest.mock("@/app/utils/appointments", () => ({
  allowReschedule: () => true,
}));

describe("Slot", () => {
  const handleViewAppointment = jest.fn();
  const handleRescheduleAppointment = jest.fn();

  const slotEvent = {
    status: "CHECKED_IN",
    startTime: new Date(2025, 0, 2, 9),
    endTime: new Date(2025, 0, 2, 10),
    companion: { name: "Buddy", species: "DOG" },
    appointmentDate: new Date(),
    organisationId: "org1",
    durationMinutes: 60,
    timeSlot: "10:30PM",
  } as Appointment;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
    jest.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    (console.error as jest.Mock).mockRestore?.();
    (console.warn as jest.Mock).mockRestore?.();
  });

  it("renders empty state when no appointments", () => {
    render(
      <Slot
        slotEvents={[]}
        height={80}
        dayIndex={0}
        length={6}
        handleViewAppointment={handleViewAppointment}
        handleRescheduleAppointment={handleRescheduleAppointment}
      />
    );

    expect(screen.getByText("No appointments")).toBeInTheDocument();
  });

  it("handles view and reschedule actions", () => {
    render(
      <Slot
        slotEvents={[slotEvent]}
        height={80}
        dayIndex={0}
        length={6}
        handleViewAppointment={handleViewAppointment}
        handleRescheduleAppointment={handleRescheduleAppointment}
      />
    );

    fireEvent.click(screen.getByText("Buddy"));
    expect(handleViewAppointment).toHaveBeenCalledWith(slotEvent);

    const rescheduleButton = screen
      .getAllByRole("button")
      .find((btn) => btn.className.includes("hover:shadow"));
    expect(rescheduleButton).toBeTruthy();

    fireEvent.click(rescheduleButton as HTMLElement);
    expect(handleRescheduleAppointment).toHaveBeenCalledWith(slotEvent);
  });
});
