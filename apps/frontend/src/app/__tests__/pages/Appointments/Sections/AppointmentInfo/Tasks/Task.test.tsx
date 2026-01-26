import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

import Task from "@/app/pages/Appointments/Sections/AppointmentInfo/Tasks/Task";

const createTaskMock = jest.fn();

jest.mock("@/app/services/taskService", () => ({
  createTask: (...args: any[]) => createTaskMock(...args),
  createTaskTemplate: jest.fn(),
  getTaskLibrary: jest.fn(),
  getTaskTemplatesForPrimaryOrg: jest.fn(),
}));

jest.mock("@/app/hooks/useTeam", () => ({
  useTeamForPrimaryOrg: () => [{ _id: "team-1", name: "Alex" }],
}));

jest.mock("@/app/hooks/useCompanion", () => ({
  useCompanionsForPrimaryOrg: () => [{ id: "c1", name: "Buddy", parentId: "p1" }],
}));

jest.mock("@/app/utils/date", () => ({
  applyUtcTime: jest.fn((date: Date) => date),
  generateTimeSlots: jest.fn(() => [{ label: "05:30", value: "05:30" }]),
}));

jest.mock("@/app/components/PermissionGate", () => ({
  PermissionGate: ({ children }: any) => <div>{children}</div>,
}));

jest.mock("@/app/components/Accordion/Accordion", () => (props: any) => (
  <div>
    <div>{props.title}</div>
    <div>{props.children}</div>
  </div>
));

jest.mock("@/app/components/Inputs/Dropdown/LabelDropdown", () => (props: any) => (
  <button type="button" onClick={() => props.onSelect(props.options[0])}>
    {props.placeholder}
  </button>
));

jest.mock("@/app/components/Inputs/FormInput/FormInput", () => (props: any) => (
  <input
    aria-label={props.inlabel}
    value={props.value}
    onChange={props.onChange}
  />
));

jest.mock("@/app/components/Inputs/FormDesc/FormDesc", () => (props: any) => (
  <textarea aria-label={props.inlabel} value={props.value} onChange={props.onChange} />
));

jest.mock("@/app/components/Inputs/Datepicker", () => ({
  __esModule: true,
  default: () => <div data-testid="datepicker" />,
}));

jest.mock("@/app/components/Inputs/SelectLabel", () => ({
  __esModule: true,
  default: () => <div data-testid="select-label" />,
}));

jest.mock("@/app/components/Buttons", () => ({
  Primary: ({ text, onClick }: any) => (
    <button type="button" onClick={onClick}>
      {text}
    </button>
  ),
  Secondary: ({ text }: any) => <button type="button">{text}</button>,
}));

describe("Appointment Task editor", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    createTaskMock.mockResolvedValue({ id: "task-1" });
  });

  it("creates a task when required fields are set", async () => {
    render(<Task />);

    fireEvent.click(screen.getByText("To"));
    fireEvent.change(screen.getByLabelText("Task"), {
      target: { value: "Follow up" },
    });

    fireEvent.click(screen.getByText("Save"));

    await waitFor(() => {
      expect(createTaskMock).toHaveBeenCalledWith(
        expect.objectContaining({
          assignedTo: "team-1",
          name: "Follow up",
        })
      );
    });
  });
});
