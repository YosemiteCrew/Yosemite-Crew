import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import AddTask from "../../../../pages/Tasks/Sections/AddTask/index";

// --- Mocks (hooks/services/components) ---

const mockShowErrorTost = jest.fn();
jest.mock("../../../../components/Toast/Toast", () => ({
  useErrorTost: () => ({
    showErrorTost: mockShowErrorTost,
    ErrorTostPopup: null,
  }),
}));

const mockCreateTask = jest.fn();
jest.mock("../../../../services/taskService", () => ({
  createTask: (...args: any[]) => mockCreateTask(...args),
}));

const mockUseTeamForPrimaryOrg = jest.fn();
jest.mock("../../../../hooks/useTeam", () => ({
  useTeamForPrimaryOrg: () => mockUseTeamForPrimaryOrg(),
}));

const mockUseCompanionsForPrimaryOrg = jest.fn();
jest.mock("../../../../hooks/useCompanion", () => ({
  useCompanionsForPrimaryOrg: () => mockUseCompanionsForPrimaryOrg(),
}));

// Keep EMPTY_TASK stable + minimal
jest.mock("../../../../types/task", () => ({
  EMPTY_TASK: {
    audience: "",
    source: "",
    category: "",
    name: "",
    description: "",
    assignedTo: "",
    companionId: "",
    dueAt: null,
  },
}));

// Modal: render children only when open
jest.mock("@/app/components/Modal", () => {
  return ({ showModal, children }: any) =>
    showModal ? <div data-testid="modal">{children}</div> : null;
});

// Accordion: pass-through (always renders children)
jest.mock("@/app/components/Accordion/Accordion", () => {
  return ({ title, children }: any) => (
    <div data-testid="accordion">
      <div>{title}</div>
      {children}
    </div>
  );
});

// Buttons: render as <button> so we can click
jest.mock("@/app/components/Buttons", () => ({
  Primary: ({ text, onClick }: any) => <button onClick={onClick}>{text}</button>,
  Secondary: ({ text, onClick }: any) => (
    <button onClick={onClick}>{text}</button>
  ),
}));

/**
 * Dropdown mock:
 * - Renders a <select> with <option> entries.
 * - When changed, calls onChange({ value })
 * - Exposes error text if provided.
 */
jest.mock("@/app/components/Inputs/Dropdown/Dropdown", () => {
  return ({
    placeholder,
    value,
    onChange,
    options = [],
    error,
  }: any) => (
    <div>
      <label>{placeholder}</label>
      <select
        aria-label={placeholder}
        value={value || ""}
        onChange={(e) => onChange({ value: e.target.value })}
      >
        <option value="">--</option>
        {options.map((o: any) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {error ? <div role="alert">{error}</div> : null}
    </div>
  );
});

/**
 * FormInput mock:
 * - Renders a normal <input>
 * - Exposes error text if provided
 */
jest.mock("@/app/components/Inputs/FormInput/FormInput", () => {
  return ({ inlabel, value, onChange, error }: any) => (
    <div>
      <label>{inlabel}</label>
      <input aria-label={inlabel} value={value || ""} onChange={onChange} />
      {error ? <div role="alert">{error}</div> : null}
    </div>
  );
});

/**
 * FormDesc mock:
 * - Renders a <textarea>
 */
jest.mock("@/app/components/Inputs/FormDesc/FormDesc", () => {
  return ({ inlabel, value, onChange }: any) => (
    <div>
      <label>{inlabel}</label>
      <textarea aria-label={inlabel} value={value || ""} onChange={onChange} />
    </div>
  );
});

/**
 * Datepicker mock:
 * - Has a button to set a known date
 * - Calls setCurrentDate(date)
 */
jest.mock("@/app/components/Inputs/Datepicker", () => {
  return ({ placeholder, setCurrentDate }: any) => (
    <div>
      <span>{placeholder}</span>
      <button
        onClick={() => setCurrentDate(new Date("2025-02-01T00:00:00.000Z"))}
      >
        Pick Due Date
      </button>
    </div>
  );
});

describe("AddTask", () => {
  const setShowModal = jest.fn();

  const teams = [
    { _id: "team-1", name: "Team A" },
    { _id: "team-2", name: "Team B" },
  ];

  // IMPORTANT: AddTask's code uses companions?.find((c) => c.id === e.value)
  // but its Options for PARENT_TASK uses value: companion.parentId
  // We'll supply matching id/parentId pairs so selection works in the component logic.
  const companions = [
    { id: "parent-1", parentId: "parent-1", name: "Parent One" },
    { id: "parent-2", parentId: "parent-2", name: "Parent Two" },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseTeamForPrimaryOrg.mockReturnValue(teams);
    mockUseCompanionsForPrimaryOrg.mockReturnValue(companions);
    mockCreateTask.mockResolvedValue({});
  });

  it("does not render when showModal is false", () => {
    render(<AddTask showModal={false} setShowModal={setShowModal} showErrorTost={mockShowErrorTost} />);
    expect(screen.queryByTestId("modal")).not.toBeInTheDocument();
  });

  it("renders when showModal is true", () => {
    render(<AddTask showModal={true} setShowModal={setShowModal} showErrorTost={mockShowErrorTost} />);
    expect(screen.getByTestId("modal")).toBeInTheDocument();
    expect(screen.getByText("Save")).toBeInTheDocument();
    expect(screen.getByText("Save as template")).toBeInTheDocument();
  });

  it("shows validation errors and does not call createTask when required fields are missing", async () => {
    render(<AddTask showModal={true} setShowModal={setShowModal} showErrorTost={mockShowErrorTost} />);

    fireEvent.click(screen.getByText("Save"));

    // 3 required fields:
    // - assignedTo
    // - name
    // - category
    expect(await screen.findByText("Please select a companion or staff")).toBeInTheDocument();
    expect(screen.getByText("Name is required")).toBeInTheDocument();
    expect(screen.getByText("Category is required")).toBeInTheDocument();

    expect(mockCreateTask).not.toHaveBeenCalled();
    expect(setShowModal).not.toHaveBeenCalled();
  });

  it("creates an EMPLOYEE_TASK successfully and closes modal + resets", async () => {
    render(<AddTask showModal={true} setShowModal={setShowModal} showErrorTost={mockShowErrorTost} />);

    // Select Type = EMPLOYEE_TASK
    fireEvent.change(screen.getByLabelText("Type"), {
      target: { value: "EMPLOYEE_TASK" },
    });

    // Optional: choose a source
    fireEvent.change(screen.getByLabelText("Source"), {
      target: { value: "CUSTOM" },
    });

    // Fill category + task name
    fireEvent.change(screen.getByLabelText("Category"), {
      target: { value: "Admin" },
    });
    fireEvent.change(screen.getByLabelText("Task"), {
      target: { value: "Onboard new hire" },
    });

    // Set "To" from teams (EMPLOYEE_TASK uses teams list)
    fireEvent.change(screen.getByLabelText("To"), {
      target: { value: "team-1" },
    });

    // Pick due date (effects set formData.dueAt)
    fireEvent.click(screen.getByText("Pick Due Date"));

    fireEvent.click(screen.getByText("Save"));

    await waitFor(() => expect(mockCreateTask).toHaveBeenCalledTimes(1));

    const payload = mockCreateTask.mock.calls[0][0];
    expect(payload.audience).toBe("EMPLOYEE_TASK");
    expect(payload.source).toBe("CUSTOM");
    expect(payload.category).toBe("Admin");
    expect(payload.name).toBe("Onboard new hire");
    expect(payload.assignedTo).toBe("team-1");

    // setShowModal(false) called on success
    expect(setShowModal).toHaveBeenCalledWith(false);
  });

  it("creates a PARENT_TASK and sets companionId when selecting a companion", async () => {
    render(<AddTask showModal={true} setShowModal={setShowModal} showErrorTost={mockShowErrorTost} />);

    // Type = PARENT_TASK
    fireEvent.change(screen.getByLabelText("Type"), {
      target: { value: "PARENT_TASK" },
    });

    // Required inputs
    fireEvent.change(screen.getByLabelText("Category"), {
      target: { value: "Care" },
    });
    fireEvent.change(screen.getByLabelText("Task"), {
      target: { value: "Call parent" },
    });

    // "To" selects from companions (Options use value: companion.parentId)
    fireEvent.change(screen.getByLabelText("To"), {
      target: { value: "parent-1" },
    });

    fireEvent.click(screen.getByText("Save"));

    await waitFor(() => expect(mockCreateTask).toHaveBeenCalledTimes(1));

    const payload = mockCreateTask.mock.calls[0][0];
    expect(payload.audience).toBe("PARENT_TASK");
    expect(payload.assignedTo).toBe("parent-1");
    expect(payload.companionId).toBe("parent-1");
  });

  it("handles createTask failure without closing modal", async () => {
    mockCreateTask.mockRejectedValueOnce(new Error("fail"));

    render(<AddTask showModal={true} setShowModal={setShowModal} showErrorTost={mockShowErrorTost} />);

    // Minimal valid EMPLOYEE_TASK submission
    fireEvent.change(screen.getByLabelText("Type"), {
      target: { value: "EMPLOYEE_TASK" },
    });
    fireEvent.change(screen.getByLabelText("Category"), {
      target: { value: "Admin" },
    });
    fireEvent.change(screen.getByLabelText("Task"), {
      target: { value: "Test Task" },
    });
    fireEvent.change(screen.getByLabelText("To"), {
      target: { value: "team-1" },
    });

    fireEvent.click(screen.getByText("Save"));

    await waitFor(() => expect(mockCreateTask).toHaveBeenCalledTimes(1));
    expect(setShowModal).not.toHaveBeenCalledWith(false);
    expect(screen.getByTestId("modal")).toBeInTheDocument();
  });

  it("clicking 'Save as template' does not call createTask", () => {
    render(<AddTask showModal={true} setShowModal={setShowModal} showErrorTost={mockShowErrorTost} />);
    fireEvent.click(screen.getByText("Save as template"));
    expect(mockCreateTask).not.toHaveBeenCalled();
  });
});
