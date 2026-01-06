import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import TaskInfo from "../../../../pages/Tasks/Sections/TaskInfo";

// --- Mocks ---

const mockUseTeamForPrimaryOrg = jest.fn();
jest.mock("../../../../hooks/useTeam", () => ({
  useTeamForPrimaryOrg: () => mockUseTeamForPrimaryOrg(),
}));

// Modal: render children only when open
jest.mock("@/app/components/Modal", () => {
  return ({ showModal, children }: any) =>
    showModal ? <div data-testid="modal">{children}</div> : null;
});

// EditableAccordion: capture props so we can assert transformed data
const editableAccordionSpy = jest.fn();
jest.mock("@/app/components/Accordion/EditableAccordion", () => {
  return (props: any) => {
    editableAccordionSpy(props);
    return (
      <div data-testid="editable-accordion">
        <div>{props.title}</div>
      </div>
    );
  };
});

// (Optional) Mock icon to make clicks deterministic in tests
jest.mock("react-icons/io", () => ({
  IoIosCloseCircleOutline: (props: any) => (
    <button
      data-testid={props.className?.includes("opacity-0") ? "close-hidden" : "close"}
      onClick={props.onClick}
    >
      close
    </button>
  ),
}));

describe("TaskInfo", () => {
  const setShowModal = jest.fn();

  const activeTask: any = {
    _id: "task-1",
    task: "Follow up",
    category: "Admin",
    description: "Call the customer",
    assignedBy: "team-1",
    assignedTo: "team-2",
    dueAt: new Date("2025-01-10T00:00:00.000Z"),
    status: "PENDING",
  };

  const teams = [
    { _id: "team-1", name: "Alice" },
    { _id: "team-2", name: "Bob" },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseTeamForPrimaryOrg.mockReturnValue(teams);
  });

  it("does not render when showModal is false", () => {
    render(
      <TaskInfo
        showModal={false}
        setShowModal={setShowModal}
        activeTask={activeTask}
      />
    );
    expect(screen.queryByTestId("modal")).not.toBeInTheDocument();
    expect(screen.queryByTestId("editable-accordion")).not.toBeInTheDocument();
  });

  it("renders modal + title + editable accordion when showModal is true", () => {
    render(
      <TaskInfo
        showModal={true}
        setShowModal={setShowModal}
        activeTask={activeTask}
      />
    );

    expect(screen.getByTestId("modal")).toBeInTheDocument();
    expect(screen.getByText("View task")).toBeInTheDocument();
    expect(screen.getByTestId("editable-accordion")).toBeInTheDocument();
    expect(screen.getByText("Task details")).toBeInTheDocument();
  });

  it("calls setShowModal(false) when clicking the close icon", () => {
    render(
      <TaskInfo
        showModal={true}
        setShowModal={setShowModal}
        activeTask={activeTask}
      />
    );

    fireEvent.click(screen.getByTestId("close"));
    expect(setShowModal).toHaveBeenCalledWith(false);
  });

  it("maps assignedBy/assignedTo IDs to team member names in data passed to EditableAccordion", () => {
    render(
      <TaskInfo
        showModal={true}
        setShowModal={setShowModal}
        activeTask={activeTask}
      />
    );

    expect(editableAccordionSpy).toHaveBeenCalled();

    const lastCallArgs = editableAccordionSpy.mock.calls.at(-1)?.[0];
    expect(lastCallArgs).toBeTruthy();

    // Ensure we passed transformed data
    expect(lastCallArgs.data.assignedBy).toBe("Alice");
    expect(lastCallArgs.data.assignedTo).toBe("Bob");

    // Ensure we preserved other task fields too
    expect(lastCallArgs.data._id).toBe("task-1");
    expect(lastCallArgs.data.category).toBe("Admin");
    expect(lastCallArgs.data.status).toBe("PENDING");
  });

  it("uses '-' when team member IDs are missing from the map", () => {
    mockUseTeamForPrimaryOrg.mockReturnValue([{ _id: "team-1", name: "Alice" }]);

    const taskWithUnknown: any = {
      ...activeTask,
      assignedBy: "team-unknown",
      assignedTo: undefined,
    };

    render(
      <TaskInfo
        showModal={true}
        setShowModal={setShowModal}
        activeTask={taskWithUnknown}
      />
    );

    const lastCallArgs = editableAccordionSpy.mock.calls.at(-1)?.[0];
    expect(lastCallArgs.data.assignedBy).toBe("-");
    expect(lastCallArgs.data.assignedTo).toBe("-");
  });

  it("passes TaskFields and defaultOpen=true into EditableAccordion", () => {
    render(
      <TaskInfo
        showModal={true}
        setShowModal={setShowModal}
        activeTask={activeTask}
      />
    );

    const lastCallArgs = editableAccordionSpy.mock.calls.at(-1)?.[0];
    expect(lastCallArgs.defaultOpen).toBe(true);
    expect(Array.isArray(lastCallArgs.fields)).toBe(true);

    // sanity check that expected field labels exist
    const labels = lastCallArgs.fields.map((f: any) => f.label);
    expect(labels).toEqual(
      expect.arrayContaining(["Task", "Category", "Description", "From", "To", "Due", "Status"])
    );
  });
});
