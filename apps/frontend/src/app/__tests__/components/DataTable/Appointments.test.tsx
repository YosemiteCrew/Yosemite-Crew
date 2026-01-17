/* eslint-disable @next/next/no-img-element */
import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import Appointments from "@/app/components/DataTable/Appointments";

const acceptAppointmentMock = jest.fn();
const cancelAppointmentMock = jest.fn();

jest.mock("@/app/services/appointmentService", () => ({
  acceptAppointment: (...args: any[]) => acceptAppointmentMock(...args),
  cancelAppointment: (...args: any[]) => cancelAppointmentMock(...args),
}));

jest.mock("@/app/components/GenericTable/GenericTable", () => ({
  __esModule: true,
  default: ({ data, columns, pageSize }: any) => (
    <div data-testid="table" data-pagesize={pageSize}>
      {data.map((item: any, rowIndex: number) => (
        <div key={item.id || rowIndex}>
          {columns.map((col: any, colIndex: number) => (
            <div key={col.key || colIndex}>
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
    <div data-testid="appointment-card">{appointment?.companion?.name}</div>
  ),
}));

jest.mock("next/image", () => ({
  __esModule: true,
  default: (props: any) => <img alt={props.alt} {...props} />,
}));

jest.mock("react-icons/fa", () => ({
  FaCheckCircle: () => <span>check</span>,
}));

jest.mock("react-icons/io", () => ({
  IoIosCloseCircle: () => <span>close</span>,
}));

jest.mock("react-icons/io5", () => ({
  IoEye: () => <span>eye</span>,
}));

jest.mock("@/app/utils/forms", () => ({
  formatDateLabel: () => "Jan 1",
  formatTimeLabel: () => "9:00 AM",
}));

jest.mock("@/app/utils/validators", () => ({
  toTitle: (value: string) => value,
}));

describe("Appointments table", () => {
  const appointment: any = {
    id: "1",
    companion: { name: "Buddy", parent: { name: "Jordan" } },
    concern: "Checkup",
    isEmergency: false,
    appointmentType: { name: "Exam" },
    room: { name: "Room A" },
    startTime: new Date(),
    appointmentDate: new Date(),
    lead: { name: "Dr. Lee" },
    supportStaff: [{ name: "Sam" }],
    status: "REQUESTED",
  };

  it("renders table rows and handles accept/cancel", () => {
    render(<Appointments filteredList={[appointment]} />);

    expect(screen.getByTestId("table")).toHaveAttribute("data-pagesize", "10");
    expect(
      within(screen.getByTestId("table")).getByText("Buddy")
    ).toBeInTheDocument();

    fireEvent.click(screen.getByText("check"));
    fireEvent.click(screen.getByText("close"));

    expect(acceptAppointmentMock).toHaveBeenCalledWith(appointment);
    expect(cancelAppointmentMock).toHaveBeenCalledWith(appointment);
  });

  it("shows no data message on mobile list", () => {
    render(<Appointments filteredList={[]} />);
    expect(screen.getByText("No data available")).toBeInTheDocument();
  });
});
