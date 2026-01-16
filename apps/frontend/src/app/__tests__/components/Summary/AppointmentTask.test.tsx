import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import AppointmentTask from "@/app/components/Summary/AppointmentTask";

const useAppointmentsMock = jest.fn();
const useTasksMock = jest.fn();

jest.mock("@/app/hooks/useAppointments", () => ({
  useAppointmentsForPrimaryOrg: () => useAppointmentsMock(),
}));

jest.mock("@/app/hooks/useTask", () => ({
  useTasksForPrimaryOrg: () => useTasksMock(),
}));

jest.mock("@/app/components/DataTable/Appointments", () => ({
  __esModule: true,
  default: ({ filteredList }: any) => (
    <div data-testid="appointments-table">{filteredList.length}</div>
  ),
}));

jest.mock("@/app/components/DataTable/Tasks", () => ({
  __esModule: true,
  default: ({ filteredList }: any) => (
    <div data-testid="tasks-table">{filteredList.length}</div>
  ),
}));

describe("Summary AppointmentTask", () => {
  it("switches between appointments and tasks", () => {
    useAppointmentsMock.mockReturnValue([
      { id: "1", status: "no_payment" },
      { id: "2", status: "requested" },
    ]);
    useTasksMock.mockReturnValue([
      { id: "t1", status: "pending" },
      { id: "t2", status: "completed" },
    ]);

    render(<AppointmentTask />);

    expect(screen.getByTestId("appointments-table")).toHaveTextContent("1");

    fireEvent.click(screen.getByRole("button", { name: "Tasks" }));
    expect(screen.getByTestId("tasks-table")).toHaveTextContent("1");

    fireEvent.click(screen.getByRole("button", { name: "Completed" }));
    expect(screen.getByTestId("tasks-table")).toHaveTextContent("1");
  });
});
