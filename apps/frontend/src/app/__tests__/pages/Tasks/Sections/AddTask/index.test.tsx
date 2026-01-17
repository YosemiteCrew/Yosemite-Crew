import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import AddTask from "@/app/pages/Tasks/Sections/AddTask";

jest.mock("@/app/components/Modal", () => ({
  __esModule: true,
  default: ({ showModal, children }: any) =>
    showModal ? <div data-testid="modal">{children}</div> : null,
}));

jest.mock("@/app/components/Icons/Close", () => ({
  __esModule: true,
  default: ({ onClick }: any) => (
    <button type="button" onClick={onClick}>
      close
    </button>
  ),
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

const FieldMock = ({ error, label }: any) => (
  <div>
    <span>{label}</span>
    {error ? <div>{error}</div> : null}
  </div>
);

jest.mock("@/app/components/Inputs/Datepicker", () => ({
  __esModule: true,
  default: () => <div>Datepicker</div>,
}));

jest.mock("@/app/components/Inputs/Dropdown/LabelDropdown", () => ({
  __esModule: true,
  default: ({ error, placeholder }: any) => (
    <FieldMock error={error} label={placeholder} />
  ),
}));

jest.mock("@/app/components/Inputs/FormDesc/FormDesc", () => ({
  __esModule: true,
  default: ({ error, label }: any) => (
    <FieldMock error={error} label={label} />
  ),
}));

jest.mock("@/app/components/Inputs/FormInput/FormInput", () => ({
  __esModule: true,
  default: ({ error, inlabel }: any) => (
    <FieldMock error={error} label={inlabel} />
  ),
}));

jest.mock("@/app/components/Inputs/SelectLabel", () => ({
  __esModule: true,
  default: ({ error, title }: any) => (
    <FieldMock error={error} label={title} />
  ),
}));

jest.mock("@/app/hooks/useCompanion", () => ({
  useCompanionsForPrimaryOrg: () => [],
}));

jest.mock("@/app/hooks/useTeam", () => ({
  useTeamForPrimaryOrg: () => [],
}));

jest.mock("@/app/services/taskService", () => ({
  createTask: jest.fn(),
  createTaskTemplate: jest.fn(),
  getTaskLibrary: jest.fn().mockResolvedValue([]),
  getTaskTemplatesForPrimaryOrg: jest.fn().mockResolvedValue([]),
}));

jest.mock("@/app/utils/date", () => ({
  applyUtcTime: (d: Date) => d,
  generateTimeSlots: () => ["09:00"],
}));

describe("Tasks AddTask", () => {
  it("shows validation errors when saving empty form", () => {
    render(<AddTask showModal setShowModal={jest.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(
      screen.getByText("Please select a companion or staff")
    ).toBeInTheDocument();
    expect(screen.getByText("Name is required")).toBeInTheDocument();
  });
});
