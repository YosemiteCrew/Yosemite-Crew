import React from "react";
import { render, screen } from "@testing-library/react";
// Import Path: Go up 6 levels to 'src/app', then down to 'pages'
import Companion from "../../../../../../pages/Appointments/Sections/AppointmentInfo/Info/Companion";
import { useCompanionStore } from "@/app/stores/companionStore";
import { useParentStore } from "@/app/stores/parentStore";
import { Appointment } from "@yosemite-crew/types";

// --- Mocks ---

jest.mock("@/app/stores/companionStore");
jest.mock("@/app/stores/parentStore");

// Mock EditableAccordion to inspect the props passed to it
jest.mock("@/app/components/Accordion/EditableAccordion", () => ({
  __esModule: true,
  default: ({ title, data }: any) => (
    <div data-testid={`accordion-${title}`}>
      <div data-testid={`data-${title}`}>{JSON.stringify(data)}</div>
    </div>
  ),
}));

describe("Companion Info Section", () => {
  // --- Test Data ---
  const mockActiveAppointment = {
    companion: {
      id: "comp-1",
      parent: { id: "parent-1" },
    },
  } as unknown as Appointment;

  const mockCompanionData = {
    id: "comp-1",
    dateOfBirth: "2020-01-01",
    gender: "Male",
    currentWeight: 15,
    bloodGroup: "A+",
    allergy: "None",
    isneutered: true,
    insurance: {
      companyName: "PetSafe",
      policyNumber: "POL-123",
    },
  };

  const mockParentData = {
    id: "parent-1",
    firstName: "John",
    lastName: "Doe",
    email: "john@example.com",
    phoneNumber: "555-0199",
  };

  // Mock Store States
  let mockCompanionState: any;
  let mockParentState: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup default mock implementations
    mockCompanionState = {
      getCompanionById: jest.fn(),
    };
    mockParentState = {
      getParentById: jest.fn(),
    };

    (useCompanionStore as unknown as jest.Mock).mockImplementation((selector) =>
      selector(mockCompanionState)
    );
    (useParentStore as unknown as jest.Mock).mockImplementation((selector) =>
      selector(mockParentState)
    );
  });

  // --- Section 1: Rendering & Structure ---

  it("renders both Companion and Parent accordions", () => {
    // Return nulls to test basic render without crashing
    mockCompanionState.getCompanionById.mockReturnValue(null);
    mockParentState.getParentById.mockReturnValue(null);

    render(<Companion activeAppointment={mockActiveAppointment} />);

    expect(
      screen.getByTestId("accordion-Companion details")
    ).toBeInTheDocument();
    expect(screen.getByTestId("accordion-Parent details")).toBeInTheDocument();
  });

  it("calls store selectors with correct IDs from props", () => {
    mockCompanionState.getCompanionById.mockReturnValue(null);
    mockParentState.getParentById.mockReturnValue(null);

    render(<Companion activeAppointment={mockActiveAppointment} />);

    expect(mockCompanionState.getCompanionById).toHaveBeenCalledWith("comp-1");
    expect(mockParentState.getParentById).toHaveBeenCalledWith("parent-1");
  });

  // --- Section 2: Data Mapping (Happy Path) ---

  it("correctly maps full Companion data", () => {
    mockCompanionState.getCompanionById.mockReturnValue(mockCompanionData);
    mockParentState.getParentById.mockReturnValue(null);

    render(<Companion activeAppointment={mockActiveAppointment} />);

    const dataEl = screen.getByTestId("data-Companion details");
    const mappedData = JSON.parse(dataEl.textContent || "{}");

    expect(mappedData).toEqual(
      expect.objectContaining({
        dateOfBirth: "2020-01-01",
        gender: "Male",
        currentWeight: 15,
        isneutered: "Yes", // Boolean true -> "Yes"
        companyName: "PetSafe", // Nested access
        policyNumber: "POL-123",
      })
    );
  });

  it("correctly maps full Parent data", () => {
    mockCompanionState.getCompanionById.mockReturnValue(null);
    mockParentState.getParentById.mockReturnValue(mockParentData);

    render(<Companion activeAppointment={mockActiveAppointment} />);

    const dataEl = screen.getByTestId("data-Parent details");
    const mappedData = JSON.parse(dataEl.textContent || "{}");

    expect(mappedData).toEqual({
      firstName: "John",
      lastName: "Doe",
      email: "john@example.com",
      phone: "555-0199", // Maps phoneNumber -> phone
    });
  });

  // --- Section 3: Partial Data & Boolean Logic ---

  it("handles 'isneutered' being false correctly", () => {
    mockCompanionState.getCompanionById.mockReturnValue({
      ...mockCompanionData,
      isneutered: false,
    });

    render(<Companion activeAppointment={mockActiveAppointment} />);

    const dataEl = screen.getByTestId("data-Companion details");
    const mappedData = JSON.parse(dataEl.textContent || "{}");

    expect(mappedData.isneutered).toBe("No");
  });

  it("handles missing nested insurance data", () => {
    mockCompanionState.getCompanionById.mockReturnValue({
      ...mockCompanionData,
      insurance: undefined, // Missing insurance object
    });

    render(<Companion activeAppointment={mockActiveAppointment} />);

    const dataEl = screen.getByTestId("data-Companion details");
    const mappedData = JSON.parse(dataEl.textContent || "{}");

    expect(mappedData.companyName).toBe("");
    expect(mappedData.policyNumber).toBe("");
  });

  // --- Section 4: Edge Cases & Null Handling ---

  it("handles stores returning undefined/null (graceful fallback to empty strings)", () => {
    mockCompanionState.getCompanionById.mockReturnValue(undefined);
    mockParentState.getParentById.mockReturnValue(undefined);

    render(<Companion activeAppointment={mockActiveAppointment} />);

    // Check Companion Defaults
    const compDataEl = screen.getByTestId("data-Companion details");
    const compData = JSON.parse(compDataEl.textContent || "{}");
    expect(compData).toEqual({
      dateOfBirth: "",
      gender: "",
      currentWeight: "",
      bloodGroup: "",
      allergy: "",
      isneutered: "No", // Default boolean fallback
      companyName: "",
      policyNumber: "",
    });

    // Check Parent Defaults
    const parentDataEl = screen.getByTestId("data-Parent details");
    const parentData = JSON.parse(parentDataEl.textContent || "{}");
    expect(parentData).toEqual({
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
    });
  });
});
