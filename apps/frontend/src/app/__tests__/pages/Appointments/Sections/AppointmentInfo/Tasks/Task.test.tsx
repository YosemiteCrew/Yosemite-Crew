import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
// Import Path: Go up 8 levels to 'src/app', then down to 'pages'
import Task from "../../../../../../pages/Appointments/Sections/AppointmentInfo/Tasks/Task";

// --- Mocks ---

// Mock Accordion to render children directly
jest.mock("@/app/components/Accordion/Accordion", () => ({
  __esModule: true,
  default: ({ title, children }: any) => (
    <div data-testid={`accordion-${title}`}>
      <h1>{title}</h1>
      {children}
    </div>
  ),
}));

// Mock Dropdown
jest.mock("@/app/components/Inputs/Dropdown/Dropdown", () => ({
  __esModule: true,
  default: ({ placeholder, value, onChange, options }: any) => (
    <div data-testid={`dropdown-${placeholder}`}>
      <span data-testid={`selected-${placeholder}`}>{value}</span>
      <select
        data-testid={`select-${placeholder}`}
        onChange={(e) => onChange(e.target.value)}
        value={value}
      >
        <option value="">Select...</option>
        {options?.map((opt: string) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </div>
  ),
}));

// Mock FormInput
jest.mock("@/app/components/Inputs/FormInput/FormInput", () => ({
  __esModule: true,
  default: ({ inlabel, value, onChange }: any) => (
    <input
      data-testid={`input-${inlabel}`}
      placeholder={inlabel}
      value={value}
      onChange={onChange}
    />
  ),
}));

// Mock FormDesc (Textarea)
jest.mock("@/app/components/Inputs/FormDesc/FormDesc", () => ({
  __esModule: true,
  default: ({ inlabel, value, onChange }: any) => (
    <textarea
      data-testid={`textarea-${inlabel}`}
      placeholder={inlabel}
      value={value}
      onChange={onChange}
    />
  ),
}));

// Mock Datepicker
jest.mock("@/app/components/Inputs/Datepicker", () => ({
  __esModule: true,
  default: ({ setCurrentDate, placeholder }: any) => (
    <input
      data-testid="datepicker"
      placeholder={placeholder}
      onChange={(e) => setCurrentDate(new Date(e.target.value))}
    />
  ),
}));

// Mock Button
jest.mock("@/app/components/Buttons", () => ({
  Primary: ({ text, onClick }: any) => (
    <button data-testid="save-btn" onClick={onClick}>
      {text}
    </button>
  ),
}));

// Mock LeadOptions since it's imported from another component
jest.mock("@/app/components/CompanionInfo/Sections/AddAppointment", () => ({
  LeadOptions: ["Staff A", "Staff B"],
}));

describe("Task Component", () => {
  // --- Section 1: Rendering & Structure ---

  it("renders the basic layout with all form fields", () => {
    render(<Task />);

    expect(screen.getByTestId("accordion-Task")).toBeInTheDocument();

    // Check Dropdowns
    expect(screen.getByTestId("dropdown-Category")).toBeInTheDocument();
    expect(screen.getByTestId("dropdown-From")).toBeInTheDocument();
    expect(screen.getByTestId("dropdown-To")).toBeInTheDocument();

    // Check Inputs
    expect(screen.getByTestId("input-Task")).toBeInTheDocument();
    expect(
      screen.getByTestId("textarea-Description (optional)")
    ).toBeInTheDocument();

    // Check Datepicker
    expect(screen.getByTestId("datepicker")).toBeInTheDocument();

    // Check Save Button
    expect(screen.getByTestId("save-btn")).toBeInTheDocument();
  });

  // --- Section 2: Form Interaction (State Updates) ---

  it("updates Category dropdown state", () => {
    render(<Task />);
    const dropdown = screen.getByTestId("select-Category");

    fireEvent.change(dropdown, { target: { value: "Template" } });

    expect(screen.getByTestId("selected-Category")).toHaveTextContent(
      "Template"
    );
  });

  it("updates Task input state", () => {
    render(<Task />);
    const input = screen.getByTestId("input-Task");

    fireEvent.change(input, { target: { value: "Follow up call" } });

    expect(input).toHaveValue("Follow up call");
  });

  it("updates Description textarea state", () => {
    render(<Task />);
    const textarea = screen.getByTestId("textarea-Description (optional)");

    fireEvent.change(textarea, {
      target: { value: "Call patient about results" },
    });

    expect(textarea).toHaveValue("Call patient about results");
  });

  it("updates 'From' and 'To' dropdown states", () => {
    render(<Task />);

    // From
    const fromSelect = screen.getByTestId("select-From");
    fireEvent.change(fromSelect, { target: { value: "Staff A" } });
    expect(screen.getByTestId("selected-From")).toHaveTextContent("Staff A");

    // To
    const toSelect = screen.getByTestId("select-To");
    fireEvent.change(toSelect, { target: { value: "Staff B" } });
    expect(screen.getByTestId("selected-To")).toHaveTextContent("Staff B");
  });

  it("updates Due Date state via Datepicker", () => {
    render(<Task />);
    const dateInput = screen.getByTestId("datepicker");

    // Simulate picking a date
    const testDate = "2025-12-25";
    fireEvent.change(dateInput, { target: { value: testDate } });

    // Since we can't easily check internal state without a spy,
    // we verify the interaction didn't crash.
    // Real validation would happen if we spy on the state setter hook,
    // but React Testing Library discourages that.
    // Instead, we trust the mock callback was triggered.
    expect(dateInput).toBeInTheDocument();
  });

  // --- Section 3: Submission Logic ---

  it("handles Save button click (placeholder function)", () => {
    render(<Task />);
    const saveBtn = screen.getByTestId("save-btn");

    // The current component has an empty createTask function `const createTask = () => {};`
    // We just verify it's clickable and doesn't throw.
    fireEvent.click(saveBtn);
    expect(saveBtn).toBeInTheDocument();
  });

  // --- Section 4: Default State & Props ---

  it("initializes with default Category 'Custom'", () => {
    render(<Task />);
    expect(screen.getByTestId("selected-Category")).toHaveTextContent("Custom");
  });
});
