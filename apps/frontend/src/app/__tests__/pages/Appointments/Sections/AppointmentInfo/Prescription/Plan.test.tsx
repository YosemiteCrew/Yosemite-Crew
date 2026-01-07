import React from "react";
import {
  render,
  screen,
  fireEvent,
  act,
} from "@testing-library/react";
// Import Path: Go up 6 levels to 'src/app', then down to 'pages'
import Plan from "../../../../../../pages/Appointments/Sections/AppointmentInfo/Prescription/Plan";
import { useFormsForPrimaryOrgByCategory } from "@/app/hooks/useForms";
import { createSubmission } from "@/app/services/soapService";
import { useAuthStore } from "@/app/stores/authStore";
import { buildInitialValues } from "@/app/pages/Forms/Sections/AddForm/Review";
import { Appointment } from "@yosemite-crew/types";

// --- Mocks ---

jest.mock("@/app/hooks/useForms");
jest.mock("@/app/services/soapService");
// Mock the utility to return predictable initial values
jest.mock("@/app/pages/Forms/Sections/AddForm/Review", () => ({
  buildInitialValues: jest.fn(() => ({})),
}));

// Mock Auth Store
jest.mock("@/app/stores/authStore", () => ({
  useAuthStore: {
    getState: jest.fn(),
  },
}));

// Mock UI Components
jest.mock("@/app/components/Buttons", () => ({
  Primary: ({ text, onClick }: any) => (
    <button data-testid="save-btn" onClick={onClick}>
      {text}
    </button>
  ),
}));

jest.mock("@/app/components/Inputs/SearchDropdown", () => ({
  __esModule: true,
  default: ({ onSelect, options }: any) => (
    <div>
      <select
        data-testid="search-dropdown"
        onChange={(e) => onSelect(e.target.value)}
      >
        <option value="">Select Plan</option>
        {options.map((opt: any) => (
          <option key={opt.key} value={opt.key}>
            {opt.value}
          </option>
        ))}
      </select>
    </div>
  ),
}));

jest.mock("@/app/pages/Forms/Sections/AddForm/components/FormRenderer", () => ({
  __esModule: true,
  default: ({ values, onChange }: any) => (
    <div data-testid="form-renderer">
      <input
        data-testid="form-input"
        value={values["field1"] || ""}
        onChange={(e) => onChange("field1", e.target.value)}
      />
    </div>
  ),
}));

jest.mock(
  "../../../../../../pages/Appointments/Sections/AppointmentInfo/Prescription/Submissions/PlanSubmissions",
  () => ({
    __esModule: true,
    default: () => <div data-testid="plan-submissions">Submissions List</div>,
  })
);

describe("Plan Section", () => {
  // --- Test Data ---
  const mockSetFormData = jest.fn();
  const mockActiveAppointment: Appointment = {
    id: "appt-1",
    companion: {
      id: "comp-1",
      parent: { id: "parent-1" },
    },
  } as unknown as Appointment;

  const mockFormData = {
    plan: [],
  } as any;

  const mockForms = [
    { _id: "form-1", name: "Surgery Plan", schema: [{ id: "field1" }] },
    { _id: "form-2", name: "Medication Plan", schema: [] },
  ];

  const mockAuthAttributes = { sub: "user-123" };

  beforeEach(() => {
    jest.clearAllMocks();
    (useFormsForPrimaryOrgByCategory as jest.Mock).mockReturnValue(mockForms);
    (useAuthStore.getState as jest.Mock).mockReturnValue({
      attributes: mockAuthAttributes,
    });
    (createSubmission as jest.Mock).mockResolvedValue({
      _id: "sub-1",
      formId: "form-1",
    });
    (buildInitialValues as jest.Mock).mockReturnValue({});
  });

  // --- Section 1: Rendering ---

  it("renders the basic layout correctly", () => {
    render(
      <Plan
        activeAppointment={mockActiveAppointment}
        formData={mockFormData}
        setFormData={mockSetFormData}
      />
    );

    expect(screen.getByText("Treatment/Plan")).toBeInTheDocument();
    expect(screen.getByTestId("search-dropdown")).toBeInTheDocument();
    expect(screen.getByTestId("plan-submissions")).toBeInTheDocument();

    // Save button and Form Renderer should NOT be visible initially
    expect(screen.queryByTestId("save-btn")).not.toBeInTheDocument();
    expect(screen.queryByTestId("form-renderer")).not.toBeInTheDocument();
  });

  // --- Section 2: Interaction (Form Selection) ---

  it("renders form and save button when a form is selected", () => {
    render(
      <Plan
        activeAppointment={mockActiveAppointment}
        formData={mockFormData}
        setFormData={mockSetFormData}
      />
    );

    const dropdown = screen.getByTestId("search-dropdown");
    fireEvent.change(dropdown, { target: { value: "form-1" } });

    expect(screen.getByTestId("form-renderer")).toBeInTheDocument();
    expect(screen.getByTestId("save-btn")).toBeInTheDocument();

    // Check if initial values were built
    expect(buildInitialValues).toHaveBeenCalledWith(mockForms[0].schema);
  });

  it("does nothing if invalid form ID is selected (edge case)", () => {
    render(
      <Plan
        activeAppointment={mockActiveAppointment}
        formData={mockFormData}
        setFormData={mockSetFormData}
      />
    );

    const dropdown = screen.getByTestId("search-dropdown");
    fireEvent.change(dropdown, { target: { value: "invalid-id" } });

    expect(screen.queryByTestId("form-renderer")).not.toBeInTheDocument();
  });

  // --- Section 3: Form Interaction & Saving ---

  it("updates values and submits the form successfully", async () => {
    render(
      <Plan
        activeAppointment={mockActiveAppointment}
        formData={mockFormData}
        setFormData={mockSetFormData}
      />
    );

    // 1. Select Form
    fireEvent.change(screen.getByTestId("search-dropdown"), {
      target: { value: "form-1" },
    });

    // 2. Change Value (simulated via FormRenderer mock)
    const input = screen.getByTestId("form-input");
    fireEvent.change(input, { target: { value: "Scheduled for Monday" } });

    // 3. Save
    await act(async () => {
      fireEvent.click(screen.getByTestId("save-btn"));
    });

    // Verification
    const expectedSubmission = {
      _id: "",
      formVersion: 1,
      submittedAt: expect.any(Date),
      formId: "form-1",
      appointmentId: "appt-1",
      companionId: "comp-1",
      parentId: "parent-1",
      answers: { field1: "Scheduled for Monday" },
      submittedBy: "user-123",
    };

    expect(createSubmission).toHaveBeenCalledWith(expectedSubmission);

    // Check State Update
    expect(mockSetFormData).toHaveBeenCalledWith(expect.any(Function));

    // Verify reset behavior (Form Renderer should disappear)
    expect(screen.queryByTestId("form-renderer")).not.toBeInTheDocument();
  });

  it("uses default empty strings for IDs if companion/parent are missing", async () => {
    const minimalAppt = { id: "appt-1" } as any; // No companion/parent
    render(
      <Plan
        activeAppointment={minimalAppt}
        formData={mockFormData}
        setFormData={mockSetFormData}
      />
    );

    fireEvent.change(screen.getByTestId("search-dropdown"), {
      target: { value: "form-1" },
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId("save-btn"));
    });

    const payload = (createSubmission as jest.Mock).mock.calls[0][0];
    expect(payload.companionId).toBe("");
    expect(payload.parentId).toBe("");
  });

  // --- Section 4: Edge Cases & Error Handling ---

  it("prevents submission if auth attributes are missing", async () => {
    (useAuthStore.getState as jest.Mock).mockReturnValue({ attributes: null });

    render(
      <Plan
        activeAppointment={mockActiveAppointment}
        formData={mockFormData}
        setFormData={mockSetFormData}
      />
    );

    fireEvent.change(screen.getByTestId("search-dropdown"), {
      target: { value: "form-1" },
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId("save-btn"));
    });

    expect(createSubmission).not.toHaveBeenCalled();
  });

  it("handles createSubmission failure gracefully (logs error)", async () => {
    const consoleSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});
    (createSubmission as jest.Mock).mockRejectedValue(new Error("API Error"));

    render(
      <Plan
        activeAppointment={mockActiveAppointment}
        formData={mockFormData}
        setFormData={mockSetFormData}
      />
    );

    fireEvent.change(screen.getByTestId("search-dropdown"), {
      target: { value: "form-1" },
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId("save-btn"));
    });

    expect(createSubmission).toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledWith(
      "Failed to save subjective submission:",
      expect.any(Error)
    );
    expect(mockSetFormData).not.toHaveBeenCalled(); // Should not update state on fail

    consoleSpy.mockRestore();
  });
});
