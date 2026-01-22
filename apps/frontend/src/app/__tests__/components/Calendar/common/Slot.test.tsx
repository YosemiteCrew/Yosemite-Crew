import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import Slot from "@/app/components/Calendar/common/Slot";

jest.mock("next/image", () => ({
  __esModule: true,
  default: (props: any) => <img alt={props.alt || ""} {...props} />,
}));

jest.mock("@/app/components/DataTable/Appointments", () => ({
  getStatusStyle: jest.fn(() => ({ backgroundColor: "purple", color: "white" })),
}));

jest.mock("@/app/utils/appointments", () => ({
  allowReschedule: jest.fn(() => true),
}));

jest.mock("@/app/utils/urls", () => ({
  getSafeImageUrl: jest.fn(() => "image"),
}));

jest.mock("react-icons/io", () => ({
  IoIosCalendar: () => <span>reschedule</span>,
}));

describe("Slot (Appointments)", () => {
  const handleViewAppointment = jest.fn();
  const handleRescheduleAppointment = jest.fn();
  const originalConsoleError = console.error;

  const event: any = {
    status: "in_progress",
    startTime: new Date("2025-01-06T09:00:00Z"),
    companion: { name: "Rex", species: "dog" },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("shows empty state when no appointments exist", () => {
    render(
      <Slot
        slotEvents={[]}
        height={120}
        handleViewAppointment={handleViewAppointment}
        handleRescheduleAppointment={handleRescheduleAppointment}
        dayIndex={0}
        length={0}
        canEditAppointments
      />
    );

    expect(screen.getByText("No appointments")).toBeInTheDocument();
  });

  it("renders appointments and handles view/reschedule clicks", () => {
    const consoleSpy = jest
      .spyOn(console, "error")
      .mockImplementation((message: any, ...args: any[]) => {
        const text =
          typeof message === "string" ? message : message?.message || "";
        if (
          text.includes("concurrent rendering") ||
          text.includes("validateDOMNesting")
        ) {
          return;
        }
        originalConsoleError(message, ...args);
      });

    render(
      <Slot
        slotEvents={[event]}
        height={120}
        handleViewAppointment={handleViewAppointment}
        handleRescheduleAppointment={handleRescheduleAppointment}
        dayIndex={0}
        length={1}
        canEditAppointments
      />
    );

    const viewButton = screen.getByText("Rex").closest("button");
    fireEvent.click(viewButton!);

    expect(handleViewAppointment).toHaveBeenCalledWith(event);

    const rescheduleButton = screen.getByText("reschedule").closest("button");
    fireEvent.click(rescheduleButton!);

    expect(handleRescheduleAppointment).toHaveBeenCalledWith(event);

    consoleSpy.mockRestore();
  });
});
