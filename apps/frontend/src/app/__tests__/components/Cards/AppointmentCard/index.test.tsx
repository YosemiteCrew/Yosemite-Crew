import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import AppointmentCard from "@/app/components/Cards/AppointmentCard";

jest.mock("@/app/components/DataTable/Appointments", () => ({
  getStatusStyle: jest.fn(() => ({ backgroundColor: "pink", color: "white" })),
}));

jest.mock("@/app/utils/forms", () => ({
  formatDateLabel: jest.fn(() => "Jan 06, 2025"),
  formatTimeLabel: jest.fn(() => "09:00 AM"),
}));

jest.mock("@/app/utils/validators", () => ({
  toTitle: (value: string) => value.toUpperCase(),
}));

jest.mock("@/app/utils/appointments", () => ({
  allowReschedule: jest.fn(() => true),
}));

jest.mock("@/app/components/Buttons", () => ({
  Secondary: ({ text, onClick }: any) => (
    <button type="button" onClick={onClick}>
      {text}
    </button>
  ),
}));

describe("AppointmentCard", () => {
  const handleViewAppointment = jest.fn();
  const handleRescheduleAppointment = jest.fn();

  const appointment: any = {
    status: "COMPLETED",
    appointmentDate: new Date("2025-01-06T00:00:00Z"),
    startTime: new Date("2025-01-06T09:00:00Z"),
    companion: { name: "Buddy", parent: { name: "Sam" }, species: "dog" },
    appointmentType: { name: "Checkup" },
    room: { name: "Room A" },
    lead: { name: "Dr. Lee" },
    supportStaff: [{ name: "Taylor" }],
    concern: "Vaccines",
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders appointment details and status", () => {
    render(
      <AppointmentCard
        appointment={appointment}
        handleViewAppointment={handleViewAppointment}
        handleRescheduleAppointment={handleRescheduleAppointment}
        canEditAppointments
      />
    );

    expect(screen.getByText("Buddy")).toBeInTheDocument();
    expect(screen.getByText("Sam")).toBeInTheDocument();
    expect(screen.getByText("Date / Time:")).toBeInTheDocument();
    expect(screen.getByText("Jan 06, 2025 / 09:00 AM")).toBeInTheDocument();
    expect(screen.getByText("Reason:")).toBeInTheDocument();
    expect(screen.getByText("Vaccines")).toBeInTheDocument();
    expect(screen.getByText("Service:")).toBeInTheDocument();
    expect(screen.getByText("Checkup")).toBeInTheDocument();
    expect(screen.getByText("Room:")).toBeInTheDocument();
    expect(screen.getByText("Room A")).toBeInTheDocument();
    expect(screen.getByText("Lead:")).toBeInTheDocument();
    expect(screen.getByText("Dr. Lee")).toBeInTheDocument();
    expect(screen.getByText("Staff:")).toBeInTheDocument();
    expect(screen.getByText("Taylor")).toBeInTheDocument();
    expect(screen.getByText("COMPLETED")).toBeInTheDocument();
  });

  it("calls handlers on view/reschedule", () => {
    render(
      <AppointmentCard
        appointment={appointment}
        handleViewAppointment={handleViewAppointment}
        handleRescheduleAppointment={handleRescheduleAppointment}
        canEditAppointments
      />
    );

    fireEvent.click(screen.getByText("View"));
    fireEvent.click(screen.getByText("Reschedule"));

    expect(handleViewAppointment).toHaveBeenCalledWith(appointment);
    expect(handleRescheduleAppointment).toHaveBeenCalledWith(appointment);
  });

  it("renders accept/cancel actions for requested status", () => {
    render(
      <AppointmentCard
        appointment={{ ...appointment, status: "REQUESTED" }}
        handleViewAppointment={handleViewAppointment}
        handleRescheduleAppointment={handleRescheduleAppointment}
        canEditAppointments
      />
    );

    expect(screen.getByText("Accept")).toBeInTheDocument();
    expect(screen.getByText("Cancel")).toBeInTheDocument();
    expect(screen.queryByText("View")).not.toBeInTheDocument();
  });
});
