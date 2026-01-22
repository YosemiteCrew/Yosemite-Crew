/* eslint-disable @next/next/no-img-element */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import AppointmentCard from "@/app/components/Cards/AppointmentCard";
import { Appointment } from "@yosemite-crew/types";

jest.mock("next/image", () => ({
  __esModule: true,
  default: (props: any) => <img alt={props.alt} {...props} />,
}));

jest.mock("@/app/components/DataTable/Appointments", () => ({
  getStatusStyle: () => ({}),
}));

jest.mock("@/app/utils/forms", () => ({
  formatDateLabel: () => "Jan 2, 2025",
  formatTimeLabel: () => "10:00 AM",
}));

jest.mock("@/app/utils/validators", () => ({
  toTitle: (value: string) => value,
}));

jest.mock("@/app/utils/appointments", () => ({
  allowReschedule: () => true,
}));

jest.mock("@/app/components/Buttons", () => ({
  Secondary: ({ text, onClick }: any) => (
    <button type="button" onClick={onClick}>
      {text}
    </button>
  ),
}));

describe("AppointmentCard", () => {
  const baseAppointment: Appointment = {
    status: "CHECKED_IN",
    appointmentDate: new Date(2025, 0, 2, 10),
    startTime: new Date(2025, 0, 2, 10),
    companion: {
      name: "Buddy",
      breed: "Lab",
      species: "DOG",
      parent: { name: "Alex" },
    } as any,
    appointmentType: { name: "Checkup" } as any,
    room: { name: "Room 1" } as any,
    lead: { name: "Dr. Lee" } as any,
    supportStaff: [{ name: "Nurse A" } as any],
    concern: "Vaccines",
  } as Appointment;

  it("renders appointment details", () => {
    render(
      <AppointmentCard
        appointment={baseAppointment}
        handleViewAppointment={jest.fn()}
        handleRescheduleAppointment={jest.fn()}
      />
    );

    expect(screen.getByText("Buddy")).toBeInTheDocument();
    expect(screen.getByText("Alex")).toBeInTheDocument();
    expect(screen.getByText("Vaccines")).toBeInTheDocument();
    expect(screen.getByText("Checkup")).toBeInTheDocument();
    expect(screen.getByText("Room 1")).toBeInTheDocument();
    expect(screen.getByText("Dr. Lee")).toBeInTheDocument();
    expect(screen.getByText("Nurse A")).toBeInTheDocument();
    expect(screen.getByText("Jan 2, 2025 / 10:00 AM")).toBeInTheDocument();
  });

  it("calls view and reschedule handlers", () => {
    const handleView = jest.fn();
    const handleReschedule = jest.fn();

    render(
      <AppointmentCard
        appointment={baseAppointment}
        handleViewAppointment={handleView}
        handleRescheduleAppointment={handleReschedule}
      />
    );

    fireEvent.click(screen.getByText("View"));
    fireEvent.click(screen.getByText("Reschedule"));

    expect(handleView).toHaveBeenCalledWith(baseAppointment);
    expect(handleReschedule).toHaveBeenCalledWith(baseAppointment);
  });

  it("renders accept/cancel for requested status", () => {
    render(
      <AppointmentCard
        appointment={{ ...baseAppointment, status: "REQUESTED" } as Appointment}
        handleViewAppointment={jest.fn()}
        handleRescheduleAppointment={jest.fn()}
      />
    );

    expect(screen.getByText("Accept")).toBeInTheDocument();
    expect(screen.getByText("Cancel")).toBeInTheDocument();
    expect(screen.queryByText("View")).not.toBeInTheDocument();
  });
});
