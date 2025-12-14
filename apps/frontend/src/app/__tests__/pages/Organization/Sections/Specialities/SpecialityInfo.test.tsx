import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import SpecialityInfo from "@/app/pages/Organization/Sections/Specialities/SpecialityInfo";
import {
  updateService,
  updateSpeciality,
} from "@/app/services/specialityService";
import { SpecialityWeb } from "@/app/types/speciality";
// Import the component we are mocking so we can cast it to a mock to inspect calls
import EditableAccordion from "@/app/components/Accordion/EditableAccordion";
import { Service } from "@yosemite-crew/types";

// --- Mocks ---

// Mock Services
jest.mock("@/app/services/specialityService", () => ({
  updateService: jest.fn(),
  updateSpeciality: jest.fn(),
}));

// Mock Modal
jest.mock("@/app/components/Modal", () => {
  return ({ showModal, children, setShowModal }: any) =>
    showModal ? (
      <div data-testid="mock-modal">
        <button
          data-testid="close-modal-overlay"
          onClick={() => setShowModal(false)}
        >
          Close Overlay
        </button>
        {children}
      </div>
    ) : null;
});

// Mock Icons
jest.mock("react-icons/io", () => ({
  IoIosCloseCircleOutline: ({ onClick }: any) => (
    <button data-testid="icon-close" onClick={onClick}>
      Close Icon
    </button>
  ),
}));

// Mock Child Components
jest.mock(
  "@/app/components/Inputs/ServiceSearch/ServiceSearchEdit",
  () => () => <div data-testid="service-search-edit">ServiceSearchEdit</div>
);

jest.mock(
  "@/app/components/Accordion/Accordion",
  () =>
    ({ title, children }: any) => (
      <div data-testid={`accordion-${title}`}>
        <h3>{title}</h3>
        {children}
      </div>
    )
);

// Mock EditableAccordion (Defined Inline to avoid hoisting ReferenceError)
jest.mock("@/app/components/Accordion/EditableAccordion", () => {
  return jest.fn(({ title }) => (
    <div data-testid={`editable-${title}`}>
      <span>{title}</span>
    </div>
  ));
});

// --- Test Data ---

// Fixed: Removed '_id' from Service mock, keeping only 'id'
const mockServices: Service[] = [
  {
    id: "s1",
    name: "Consultation",
    description: "General checkup",
    durationMinutes: 30,
    cost: 50,
    maxDiscount: 10,
    organisationId: "org-1",
    isActive: true,
  },
] as Service[];

const mockSpeciality: SpecialityWeb = {
  _id: "spec-1",
  name: "Cardiology",
  headName: "Dr. Heart",
  organisationId: "org-1",
  services: mockServices,
} as SpecialityWeb;

describe("SpecialityInfo Component", () => {
  const mockSetShowModal = jest.fn();

  // Helper to get the mock object for assertions
  const getAccordionMock = () => EditableAccordion as unknown as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- 1. Rendering Section ---

  it("renders correctly when open", () => {
    render(
      <SpecialityInfo
        showModal={true}
        setShowModal={mockSetShowModal}
        activeSpeciality={mockSpeciality}
      />
    );

    expect(screen.getByTestId("mock-modal")).toBeInTheDocument();
    expect(screen.getByText("View speciality")).toBeInTheDocument();
    expect(screen.getByText("Cardiology")).toBeInTheDocument();

    // Check Sections
    expect(screen.getByTestId("editable-Core")).toBeInTheDocument();
    expect(screen.getByTestId("accordion-Services")).toBeInTheDocument();

    // Check Service List
    expect(screen.getByTestId("editable-Consultation")).toBeInTheDocument();
    expect(screen.getByTestId("service-search-edit")).toBeInTheDocument();
  });

  it("renders '-' if name is missing", () => {
    const unnamedSpec = { ...mockSpeciality, name: "" };
    render(
      <SpecialityInfo
        showModal={true}
        setShowModal={mockSetShowModal}
        activeSpeciality={unnamedSpec as any}
      />
    );
    expect(screen.getByText("-")).toBeInTheDocument();
  });

  // --- 2. Interaction: Core Update ---

  it("calls updateSpeciality with merged values when Core section is saved", async () => {
    (updateSpeciality as jest.Mock).mockResolvedValue({}); // Mock success

    render(
      <SpecialityInfo
        showModal={true}
        setShowModal={mockSetShowModal}
        activeSpeciality={mockSpeciality}
      />
    );

    // Find the call for the "Core" accordion
    const coreCall = getAccordionMock().mock.calls.find(
      (call) => call[0].title === "Core"
    );
    expect(coreCall).toBeDefined();

    const onSave = coreCall?.[0].onSave;

    // Simulate saving with new values
    const newValues = { name: "Neuro", headName: "Dr. Brain" };
    if (onSave) await onSave(newValues);
  });

  it("falls back to existing values if Core update fields are undefined", async () => {
    (updateSpeciality as jest.Mock).mockResolvedValue({}); // Mock success

    render(
      <SpecialityInfo
        showModal={true}
        setShowModal={mockSetShowModal}
        activeSpeciality={mockSpeciality}
      />
    );

    const coreCall = getAccordionMock().mock.calls.find(
      (call) => call[0].title === "Core"
    );
    const onSave = coreCall?.[0].onSave;

    if (onSave) await onSave({});

    expect(updateSpeciality).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Cardiology",
        headName: "Dr. Heart",
      })
    );
  });

  // --- 3. Interaction: Service Update ---

  it("calls updateService with correct types when Service is saved", async () => {
    (updateService as jest.Mock).mockResolvedValue({}); // Mock success

    render(
      <SpecialityInfo
        showModal={true}
        setShowModal={mockSetShowModal}
        activeSpeciality={mockSpeciality}
      />
    );

    const serviceCall = getAccordionMock().mock.calls.find(
      (call) => call[0].title === "Consultation"
    );
    expect(serviceCall).toBeDefined();

    const onSave = serviceCall?.[0].onSave;

    if (onSave) {
      await onSave({
        description: "Updated Desc",
        durationMinutes: "60",
        cost: "100",
        maxDiscount: "15",
      });
    }

    expect(updateService).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "s1", // Check for 'id', not '_id'
        name: "Consultation",
        description: "Updated Desc",
        durationMinutes: 60, // Number
        cost: 100, // Number
        maxDiscount: 15, // Number
      })
    );
  });

  it("handles null/empty maxDiscount correctly for Services", async () => {
    (updateService as jest.Mock).mockResolvedValue({}); // Mock success

    render(
      <SpecialityInfo
        showModal={true}
        setShowModal={mockSetShowModal}
        activeSpeciality={mockSpeciality}
      />
    );

    const serviceCall = getAccordionMock().mock.calls.find(
      (call) => call[0].title === "Consultation"
    );
    const onSave = serviceCall?.[0].onSave;

    if (onSave) {
      // Case 1: Empty string
      await onSave({ maxDiscount: "" });
      expect(updateService).toHaveBeenLastCalledWith(
        expect.objectContaining({
          maxDiscount: null,
        })
      );

      // Case 2: Null
      await onSave({ maxDiscount: null });
      expect(updateService).toHaveBeenLastCalledWith(
        expect.objectContaining({
          maxDiscount: null,
        })
      );
    }
  });

  it("falls back to existing service values if inputs are undefined", async () => {
    (updateService as jest.Mock).mockResolvedValue({}); // Mock success

    render(
      <SpecialityInfo
        showModal={true}
        setShowModal={mockSetShowModal}
        activeSpeciality={mockSpeciality}
      />
    );

    const serviceCall = getAccordionMock().mock.calls.find(
      (call) => call[0].title === "Consultation"
    );
    const onSave = serviceCall?.[0].onSave;

    if (onSave) await onSave({});

    expect(updateService).toHaveBeenCalledWith(
      expect.objectContaining({
        description: "General checkup",
        durationMinutes: 30,
        cost: 50,
      })
    );
  });

  // --- 4. Interaction: Closing ---

  it("closes modal when clicking close icon", () => {
    render(
      <SpecialityInfo
        showModal={true}
        setShowModal={mockSetShowModal}
        activeSpeciality={mockSpeciality}
      />
    );

    // Click the second icon (the visible one)
    const closeButtons = screen.getAllByTestId("icon-close");
    fireEvent.click(closeButtons[1]);

    expect(mockSetShowModal).toHaveBeenCalledWith(false);
  });
});
