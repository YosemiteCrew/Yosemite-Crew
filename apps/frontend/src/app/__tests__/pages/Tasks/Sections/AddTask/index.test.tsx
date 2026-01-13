import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

import AddTask from "@/app/pages/Tasks/Sections/AddTask";

jest.mock("@/app/components/Modal", () => ({
  __esModule: true,
  default: ({ children, showModal }: any) => (
    <div data-testid="modal" data-open={showModal}>
      {children}
    </div>
  ),
}));

jest.mock("@/app/components/Accordion/Accordion", () => ({
  __esModule: true,
  default: ({ title, children }: any) => (
    <section>
      <h2>{title}</h2>
      {children}
    </section>
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

jest.mock("@/app/components/Inputs/Dropdown/LabelDropdown", () => ({
  __esModule: true,
  default: ({ placeholder, options = [], onSelect, error }: any) => (
    <div>
      <span>{placeholder}</span>
      {options.map((option: any) => (
        <button
          key={`${placeholder}-${option.key}`}
          type="button"
          onClick={() => onSelect(option)}
        >
          {placeholder}: {option.label}
        </button>
      ))}
      {error ? <div>{error}</div> : null}
    </div>
  ),
}));

jest.mock("@/app/components/Inputs/FormInput/FormInput", () => ({
  __esModule: true,
  default: ({ inlabel, value, onChange, error }: any) => (
    <label>
      {inlabel}
      <input aria-label={inlabel} value={value ?? ""} onChange={onChange} />
      {error ? <span>{error}</span> : null}
    </label>
  ),
}));

jest.mock("@/app/components/Inputs/FormDesc/FormDesc", () => ({
  __esModule: true,
  default: ({ inlabel, value, onChange }: any) => (
    <label>
      {inlabel}
      <textarea aria-label={inlabel} value={value ?? ""} onChange={onChange} />
    </label>
  ),
}));

jest.mock("@/app/components/Inputs/Datepicker", () => ({
  __esModule: true,
  default: ({ placeholder, setCurrentDate }: any) => (
    <button type="button" onClick={() => setCurrentDate(new Date("2025-01-01"))}>
      {placeholder}
    </button>
  ),
}));

jest.mock("@/app/hooks/useCompanion", () => ({
  useCompanionsForPrimaryOrg: jest.fn(),
}));

jest.mock("@/app/hooks/useTeam", () => ({
  useTeamForPrimaryOrg: jest.fn(),
}));

jest.mock("@/app/services/taskService", () => ({
  createTask: jest.fn(),
}));

jest.mock("@iconify/react/dist/iconify.js", () => ({
  Icon: () => <span data-testid="icon" />,
}));

jest.mock("react-icons/io", () => ({
  IoIosCloseCircleOutline: ({ onClick }: any) => (
    <button type="button" onClick={onClick}>
      Close
    </button>
  ),
}));

import { useCompanionsForPrimaryOrg } from "@/app/hooks/useCompanion";
import { useTeamForPrimaryOrg } from "@/app/hooks/useTeam";
import { createTask } from "@/app/services/taskService";

describe("AddTask (Tasks)", () => {
  const setShowModal = jest.fn();
  const showErrorTost = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useCompanionsForPrimaryOrg as jest.Mock).mockReturnValue([
      { id: "comp-1", name: "Buddy", parentId: "parent-1" },
    ]);
    (useTeamForPrimaryOrg as jest.Mock).mockReturnValue([
      { _id: "team-1", name: "Dr. Avery" },
    ]);
  });

  it("renders modal and main sections", () => {
    render(
      <AddTask
        showModal={true}
        setShowModal={setShowModal}
        showErrorTost={showErrorTost}
      />
    );

    expect(screen.getByTestId("modal")).toHaveAttribute("data-open", "true");
    expect(screen.getAllByText("Add task").length).toBeGreaterThan(0);
    expect(screen.getByText("Save")).toBeInTheDocument();
  });

  it("shows validation errors when required fields are missing", () => {
    render(
      <AddTask
        showModal={true}
        setShowModal={setShowModal}
        showErrorTost={showErrorTost}
      />
    );

    fireEvent.click(screen.getByText("Save"));

    expect(
      screen.getByText("Please select a companion or staff")
    ).toBeInTheDocument();
    expect(screen.getByText("Name is required")).toBeInTheDocument();
    expect(screen.getByText("Category is required")).toBeInTheDocument();
    expect(createTask).not.toHaveBeenCalled();
  });

  it("creates a task when required fields are set", async () => {
    (createTask as jest.Mock).mockResolvedValue({});

    render(
      <AddTask
        showModal={true}
        setShowModal={setShowModal}
        showErrorTost={showErrorTost}
      />
    );

    fireEvent.click(screen.getByText("Type: Employee Task"));
    fireEvent.click(screen.getByText("To: Dr. Avery"));
    fireEvent.change(screen.getByLabelText("Category"), {
      target: { value: "Medical" },
    });
    fireEvent.change(screen.getByLabelText("Task"), {
      target: { value: "Follow up" },
    });

    fireEvent.click(screen.getByText("Save"));

    await waitFor(() => {
      expect(createTask).toHaveBeenCalled();
    });
    expect(setShowModal).toHaveBeenCalledWith(false);
    expect(showErrorTost).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Task created",
        errortext: "Success",
        className: "CongratsBg",
      })
    );
  });
});
