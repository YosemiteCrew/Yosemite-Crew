import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import SpecialityCard from "@/app/pages/Organization/Sections/Specialities/SpecialityCard";
import { SpecialityWeb } from "@/app/types/speciality";

// --- Mocks ---

// Mock ServiceSearch
jest.mock("@/app/components/Inputs/ServiceSearch/ServiceSearch", () => {
  return () => <div data-testid="service-search">Service Search Component</div>;
});

// Mock Accordion
jest.mock("@/app/components/Accordion/Accordion", () => {
  return ({ title, children, onDeleteClick }: any) => (
    <div data-testid={`accordion-${title}`}>
      <h3>{title}</h3>
      <button data-testid={`delete-${title}`} onClick={onDeleteClick}>
        Delete
      </button>
      {children}
    </div>
  );
});

// Mock FormInput
jest.mock("@/app/components/Inputs/FormInput/FormInput", () => {
  return ({ inlabel, value, onChange, intype }: any) => (
    <div>
      <label>{inlabel}</label>
      <input
        data-testid={`input-${inlabel}`}
        type={intype}
        value={value}
        onChange={onChange}
      />
    </div>
  );
});

// --- Test Data ---

const mockServices = [
  {
    name: "Consultation",
    description: "General checkup",
    durationMinutes: 30,
    cost: 50,
    maxDiscount: 10,
    organisationId: "org-1",
  },
  {
    name: "Surgery",
    description: "Minor surgery",
    durationMinutes: 120,
    cost: 500,
    maxDiscount: 5,
    organisationId: "org-1",
  },
];

const mockSpeciality: SpecialityWeb = {
  _id: "spec-1",
  name: "Cardiology",
  services: mockServices,
} as SpecialityWeb;

// We need a wrapper to simulate the array of specialities usually present in the parent state
const mockFormData = [
  { _id: "spec-0", name: "Other", services: [] }, // Index 0
  mockSpeciality, // Index 1 (Target)
  { _id: "spec-2", name: "Another", services: [] }, // Index 2
] as SpecialityWeb[];

describe("SpecialityCard Component", () => {
  const mockSetFormData = jest.fn();
  const targetIndex = 1;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- 1. Rendering Section ---

  it("renders search and list of services", () => {
    render(
      <SpecialityCard
        setFormData={mockSetFormData}
        speciality={mockSpeciality}
        index={targetIndex}
      />
    );

    expect(screen.getByTestId("service-search")).toBeInTheDocument();
    expect(screen.getByTestId("accordion-Consultation")).toBeInTheDocument();
    expect(screen.getByTestId("accordion-Surgery")).toBeInTheDocument();
  });

  it("renders correctly with empty services list", () => {
    const emptySpec = { ...mockSpeciality, services: undefined };
    render(
      <SpecialityCard
        setFormData={mockSetFormData}
        speciality={emptySpec as any}
        index={targetIndex}
      />
    );

    expect(screen.getByTestId("service-search")).toBeInTheDocument();
    expect(screen.queryByTestId(/accordion-/)).not.toBeInTheDocument();
  });

  // --- 2. Interaction: Updates ---

  it("updates service description correctly", () => {
    render(
      <SpecialityCard
        setFormData={mockSetFormData}
        speciality={mockSpeciality}
        index={targetIndex}
      />
    );

    const input = screen.getAllByTestId("input-Description")[0]; // First service (Consultation)
    fireEvent.change(input, { target: { value: "Updated Desc" } });

    // Verify setFormData logic
    expect(mockSetFormData).toHaveBeenCalledTimes(1);

    // We need to execute the state updater function to verify nested logic
    const updateFn = mockSetFormData.mock.calls[0][0];
    const newState = updateFn(mockFormData);

    // Should only update target index
    expect(newState[0]).toEqual(mockFormData[0]); // Unchanged
    expect(newState[2]).toEqual(mockFormData[2]); // Unchanged

    // Target changed
    expect(newState[1].services![0].description).toBe("Updated Desc");
    // Second service in target unchanged
    expect(newState[1].services![1].description).toBe("Minor surgery");
  });

  it("updates numeric fields (duration, cost, discount)", () => {
    render(
      <SpecialityCard
        setFormData={mockSetFormData}
        speciality={mockSpeciality}
        index={targetIndex}
      />
    );

    // Update Duration
    const durationInput = screen.getAllByTestId("input-Duration (mins)")[0];
    fireEvent.change(durationInput, { target: { value: "45" } });

    // Execute updater 1
    let updateFn = mockSetFormData.mock.calls[0][0];
    let newState = updateFn(mockFormData);
    expect(newState[1].services![0].durationMinutes).toBe("45"); // Note: Input returns string

    // Reset and test Cost
    mockSetFormData.mockClear();
    const costInput = screen.getAllByTestId("input-Service charge ($)")[0];
    fireEvent.change(costInput, { target: { value: "100" } });

    // Execute updater 2
    updateFn = mockSetFormData.mock.calls[0][0];
    newState = updateFn(mockFormData);
    expect(newState[1].services![0].cost).toBe("100");

    // Reset and test Discount
    mockSetFormData.mockClear();
    const discountInput = screen.getAllByTestId("input-Max discount (%)")[0];
    fireEvent.change(discountInput, { target: { value: "20" } });

    // Execute updater 3
    updateFn = mockSetFormData.mock.calls[0][0];
    newState = updateFn(mockFormData);
    expect(newState[1].services![0].maxDiscount).toBe("20");
  });

  // --- 3. Interaction: Deletion ---

  it("removes a service when delete is clicked", () => {
    render(
      <SpecialityCard
        setFormData={mockSetFormData}
        speciality={mockSpeciality}
        index={targetIndex}
      />
    );

    // Delete the first service (Consultation)
    const deleteBtn = screen.getByTestId("delete-Consultation");
    fireEvent.click(deleteBtn);

    expect(mockSetFormData).toHaveBeenCalledTimes(1);

    const updateFn = mockSetFormData.mock.calls[0][0];
    const newState = updateFn(mockFormData);

    // Should now have 1 service (Surgery remaining)
    expect(newState[1].services).toHaveLength(1);
    expect(newState[1].services![0].name).toBe("Surgery");

    // Other indices unchanged
    expect(newState[0]).toBe(mockFormData[0]);
  });

  // --- 4. Edge Cases ---

  it("handles filtering gracefully if services is undefined (defensive check)", () => {
    // This targets the `filterService` helper accessing `services?`
    // We simulate a state where services might be missing but we try to delete index 0
    // Realistically hard to click delete if not rendered, but we can verify the updater function logic directly.

    // Trigger any delete to get the updater
    render(
      <SpecialityCard
        setFormData={mockSetFormData}
        speciality={mockSpeciality}
        index={targetIndex}
      />
    );
    fireEvent.click(screen.getByTestId("delete-Consultation"));
    const updateFn = mockSetFormData.mock.calls[0][0];

    // Construct a state where the target speciality has no services
    // Run the updater against this state (index 0 is target here)
    // We need to re-render with index 0 to match logic or just map manually
    // The component closure captures 'index=1'.
    // So we use mockFormData structure but make index 1 have undefined services
    const corruptFormData = [...mockFormData];
    corruptFormData[1] = { ...mockSpeciality, services: undefined };

    const resultState = updateFn(corruptFormData);

    // Should return undefined or empty array for services, not crash
    // The code: filterService(sp.services || [], ...) -> handles undefined
    expect(resultState[1].services).toEqual([]);
  });
});
