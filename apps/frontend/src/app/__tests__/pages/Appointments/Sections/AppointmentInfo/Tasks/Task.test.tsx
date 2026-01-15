import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import Task from "@/app/pages/Appointments/Sections/AppointmentInfo/Tasks/Task";

jest.mock("@/app/components/Accordion/Accordion", () => ({
  __esModule: true,
  default: ({ title, children }: any) => (
    <div>
      <div>{title}</div>
      <div>{children}</div>
    </div>
  ),
}));

jest.mock("@/app/components/Inputs/Dropdown/LabelDropdown", () => ({
  __esModule: true,
  default: ({ placeholder, options, onSelect, error }: any) => (
    <div>
      <button type="button" onClick={() => onSelect(options[0])}>
        {placeholder}
      </button>
      {error && <span>{error}</span>}
    </div>
  ),
}));

jest.mock("@/app/components/Inputs/FormInput/FormInput", () => ({
  __esModule: true,
  default: ({ inlabel, value, onChange, error }: any) => (
    <label>
      {inlabel}
      <input value={value} onChange={onChange} aria-label={inlabel} />
      {error && <span>{error}</span>}
    </label>
  ),
}));

jest.mock("@/app/components/Inputs/FormDesc/FormDesc", () => ({
  __esModule: true,
  default: ({ inlabel, value, onChange }: any) => (
    <label>
      {inlabel}
      <textarea value={value} onChange={onChange} />
    </label>
  ),
}));

jest.mock("@/app/components/Inputs/Datepicker", () => ({
  __esModule: true,
  default: ({ placeholder }: any) => <button>{placeholder}</button>,
}));

jest.mock("@/app/components/Buttons", () => ({
  Primary: ({ text, onClick }: any) => (
    <button type="button" onClick={onClick}>
      {text}
    </button>
  ),
  Secondary: ({ text, onClick }: any) => (
    <button type="button" onClick={onClick}>
      {text}
    </button>
  ),
}));

jest.mock("@/app/hooks/useTeam", () => ({
  useTeamForPrimaryOrg: () => [
    { _id: "team-1", name: "Dr. Who" },
  ],
}));

jest.mock("@/app/hooks/useCompanion", () => ({
  useCompanionsForPrimaryOrg: () => [
    { id: "comp-1", name: "Buddy", parentId: "parent-1" },
  ],
}));

jest.mock("@/app/services/taskService", () => ({
  createTask: jest.fn(),
}));

const taskService = jest.requireMock("@/app/services/taskService");

describe("Task", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("shows validation errors when required fields are missing", () => {
    render(<Task />);

    fireEvent.click(screen.getByText("Save"));

    expect(screen.getByText("Please select a companion or staff")).toBeInTheDocument();
    expect(screen.getByText("Name is required")).toBeInTheDocument();
    expect(screen.getByText("Category is required")).toBeInTheDocument();
  });

  it("creates task when required fields are set", async () => {
    taskService.createTask.mockResolvedValue({});

    render(<Task />);

    fireEvent.click(screen.getByText("Type"));
    fireEvent.click(screen.getByText("Source"));
    fireEvent.change(screen.getByLabelText("Category"), {
      target: { value: "General" },
    });
    fireEvent.change(screen.getByLabelText("Task"), {
      target: { value: "Call parent" },
    });
    fireEvent.click(screen.getAllByText("To")[0]);

    fireEvent.click(screen.getByText("Save"));

    await waitFor(() => {
      expect(taskService.createTask).toHaveBeenCalled();
    });
  });
});
