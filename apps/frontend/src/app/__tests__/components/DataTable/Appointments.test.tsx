import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import Appointments from "@/app/components/DataTable/Appointments";

const acceptAppointmentMock = jest.fn();
const cancelAppointmentMock = jest.fn();

jest.mock("@/app/services/appointmentService", () => ({
  acceptAppointment: (...args: any[]) => acceptAppointmentMock(...args),
  cancelAppointment: (...args: any[]) => cancelAppointmentMock(...args),
}));

jest.mock("@/app/utils/appointments", () => ({
  allowReschedule: jest.fn(() => true),
}));

jest.mock("@/app/utils/forms", () => ({
  formatDateLabel: jest.fn(() => "Jan 06, 2025"),
  formatTimeLabel: jest.fn(() => "09:00 AM"),
}));

jest.mock("@/app/utils/validators", () => ({
  toTitle: (value: string) => value.toUpperCase(),
}));

jest.mock("@/app/components/GenericTable/GenericTable", () => ({
  __esModule: true,
  default: ({ data, columns }: any) => (
    <div data-testid="table">
      {data.map((item: any) => (
        <div key={item.id}>
          {columns.map((col: any) => (
            <div key={col.key || col.label}>
              {col.render ? col.render(item) : item[col.key]}
            </div>
          ))}
        </div>
      ))}
    </div>
  ),
}));

jest.mock("@/app/components/Cards/AppointmentCard", () => ({
  __esModule: true,
  default: ({ appointment }: any) => (
    <div data-testid="appointment-card">{appointment.id}</div>
  ),
}));

jest.mock("react-icons/fa", () => ({
  FaCheckCircle: () => <span>accept-icon</span>,
}));

jest.mock("react-icons/io", () => ({
  IoIosCloseCircle: () => <span>cancel-icon</span>,
  IoIosCalendar: () => <span>reschedule-icon</span>,
}));

jest.mock("react-icons/io5", () => ({
  IoEye: () => <span>view-icon</span>,
}));

describe("Appointments table", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("handles accept/cancel actions for requested appointments", async () => {
    const appointment: any = { id: "a1", status: "REQUESTED" };

    render(
      <Appointments
        filteredList={[appointment]}
        canEditAppointments
      />
    );

    fireEvent.click(screen.getByText("accept-icon").closest("button")!);
    fireEvent.click(screen.getByText("cancel-icon").closest("button")!);

    expect(acceptAppointmentMock).toHaveBeenCalledWith(appointment);
    expect(cancelAppointmentMock).toHaveBeenCalledWith(appointment);
  });

  it("handles view/reschedule actions", () => {
    const appointment: any = { id: "a2", status: "COMPLETED" };
    const setActiveAppointment = jest.fn();
    const setViewPopup = jest.fn();
    const setReschedulePopup = jest.fn();

    render(
      <Appointments
        filteredList={[appointment]}
        setActiveAppointment={setActiveAppointment}
        setViewPopup={setViewPopup}
        setReschedulePopup={setReschedulePopup}
        canEditAppointments
      />
    );

    fireEvent.click(screen.getByText("view-icon").closest("button")!);
    fireEvent.click(screen.getByText("reschedule-icon").closest("button")!);

    expect(setActiveAppointment).toHaveBeenCalledWith(appointment);
    expect(setViewPopup).toHaveBeenCalledWith(true);
    expect(setReschedulePopup).toHaveBeenCalledWith(true);
  });

  it("shows empty state for mobile list", () => {
    render(<Appointments filteredList={[]} canEditAppointments={false} />);
    expect(screen.getByText("No data available")).toBeInTheDocument();
  });
});
