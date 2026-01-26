import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import AppointmentTask from "@/app/components/Summary/AppointmentTask";

const useAppointmentsMock = jest.fn();
const useTasksMock = jest.fn();
const usePermissionsMock = jest.fn();
const appointmentsSpy = jest.fn();
const tasksSpy = jest.fn();

jest.mock("@/app/hooks/useAppointments", () => ({
  useAppointmentsForPrimaryOrg: () => useAppointmentsMock(),
}));

jest.mock("@/app/hooks/useTask", () => ({
  useTasksForPrimaryOrg: () => useTasksMock(),
}));

jest.mock("@/app/hooks/usePermissions", () => ({
  usePermissions: () => usePermissionsMock(),
}));

jest.mock("@/app/components/DataTable/Appointments", () => (props: any) => {
  appointmentsSpy(props);
  return <div data-testid="appointments-table" />;
});

jest.mock("@/app/components/DataTable/Tasks", () => (props: any) => {
  tasksSpy(props);
  return <div data-testid="tasks-table" />;
});

jest.mock("@/app/pages/Appointments/Sections/AppointmentInfo", () => (props: any) => (
  <div data-testid="appointment-info" />
));

jest.mock("@/app/pages/Tasks/Sections/TaskInfo", () => (props: any) => (
  <div data-testid="task-info" />
));

jest.mock("@/app/pages/Appointments/Sections/Reschedule", () => (props: any) => (
  <div data-testid="reschedule" />
));

jest.mock("@/app/components/PermissionGate", () => ({
  PermissionGate: ({ children }: any) => <div>{children}</div>,
}));

describe("AppointmentTask summary", () => {
  const appointments = [
    { id: "a1", status: "no_payment" },
    { id: "a2", status: "completed" },
  ];
  const tasks = [
    { _id: "t1", status: "pending" },
    { _id: "t2", status: "completed" },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    useAppointmentsMock.mockReturnValue(appointments);
    useTasksMock.mockReturnValue(tasks);
    usePermissionsMock.mockReturnValue({ can: jest.fn(() => true) });
  });

  it("renders appointment table by default with filtered list", () => {
    render(<AppointmentTask />);

    expect(screen.getByText("Schedule")).toBeInTheDocument();
    expect(screen.getByText("(2)")).toBeInTheDocument();

    const props = appointmentsSpy.mock.calls[0][0];
    expect(props.filteredList).toEqual([appointments[0]]);
    expect(screen.getByTestId("reschedule")).toBeInTheDocument();
  });

  it("switches to tasks tab and filters tasks", () => {
    render(<AppointmentTask />);

    fireEvent.click(screen.getByText("Tasks"));

    expect(screen.getByTestId("tasks-table")).toBeInTheDocument();

    const latestProps = tasksSpy.mock.calls.at(-1)[0];
    expect(latestProps.filteredList).toEqual([tasks[0]]);
  });
});
