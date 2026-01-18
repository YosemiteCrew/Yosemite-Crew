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

jest.mock("@/app/hooks/useTeam", () => ({
  useTeamForPrimaryOrg: () => [{ _id: "u1", name: "Alex" }],
}));

jest.mock("../../../components/DataTable/Appointments", () => ({
  __esModule: true,
  default: ({ filteredList }: any) => (
    <div data-testid="appointments-table">{filteredList.length}</div>
  ),
}));

jest.mock("../../../components/DataTable/Tasks", () => ({
  __esModule: true,
  default: ({ filteredList }: any) => (
    <div data-testid="tasks-table">{filteredList.length}</div>
  ),
}));

jest.mock("@/app/components/Summary/Summary.css", () => ({}));

describe("AppointmentTask summary", () => {
  beforeEach(() => {
    useAppointmentsMock.mockReturnValue([]);
    useTasksMock.mockReturnValue([]);
  });

  it("toggles between appointments and tasks", () => {
    useAppointmentsMock.mockReturnValue([
      {
        id: "1",
        status: "no_payment",
        concern: "Visit",
        companion: { name: "Buddy", parent: { name: "Sam" } },
        appointmentType: { name: "Exam" },
        room: { name: "Room A" },
        lead: { name: "Dr. Lee" },
        supportStaff: [{ name: "Alex" }],
        startTime: new Date(),
        appointmentDate: new Date(),
      },
      {
        id: "2",
        status: "requested",
        concern: "Checkup",
        companion: { name: "Rex", parent: { name: "Taylor" } },
        appointmentType: { name: "Exam" },
        room: { name: "Room B" },
        lead: { name: "Dr. Lee" },
        supportStaff: [{ name: "Alex" }],
        startTime: new Date(),
        appointmentDate: new Date(),
      },
    ]);
    useTasksMock.mockReturnValue([
      {
        id: "t1",
        status: "pending",
        name: "Follow up",
        description: "Call parent",
        category: "pending",
        assignedBy: "u1",
        assignedTo: "u1",
        dueAt: new Date(),
      },
      {
        id: "t2",
        status: "completed",
        name: "Labs",
        description: "Review results",
        category: "completed",
        assignedBy: "u1",
        assignedTo: "u1",
        dueAt: new Date(),
      },
    ]);

    render(<AppointmentTask />);

    expect(screen.getByTestId("appointments-table")).toHaveTextContent("1");

    fireEvent.click(screen.getAllByRole("button", { name: "Tasks" })[0]);
    expect(screen.getByTestId("tasks-table")).toHaveTextContent("1");
  });
});
