import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import SpecialityCard from "@/app/pages/Organization/Sections/Specialities/SpecialityCard";
import { useTeamForPrimaryOrg } from "@/app/hooks/useTeam";
import { SpecialityWeb } from "@/app/types/speciality";

// --- Mocks ---

jest.mock("@/app/hooks/useTeam", () => ({
  useTeamForPrimaryOrg: jest.fn(),
}));

// Mock child components to isolate logic and simplify interactions
jest.mock("@/app/components/Inputs/Dropdown/Dropdown", () => ({
  __esModule: true,
  default: ({ onChange, value, placeholder }: any) => (
    <div data-testid={`dropdown-${placeholder.toLowerCase()}`}>
      <button onClick={() => onChange({ label: "Dr. T", value: "t1" })}>
        Select {placeholder}
      </button>
      <span>Val: {value}</span>
    </div>
  ),
}));

jest.mock("@/app/components/Inputs/MultiSelectDropdown", () => ({
  __esModule: true,
  default: ({ onChange, value }: any) => (
    <div data-testid="multiselect-staff">
      <button onClick={() => onChange(["t1", "t2"])}>Select Staff</button>
      <span>Count: {value?.length}</span>
    </div>
  ),
}));

jest.mock("@/app/components/Inputs/FormInput/FormInput", () => ({
  __esModule: true,
  default: ({ onChange, value, inlabel }: any) => (
    <div>
      <label>{inlabel}</label>
      <input
        data-testid={`input-${inlabel.toLowerCase().replaceAll(/[^a-z]/g, "")}`}
        value={value}
        onChange={onChange}
      />
    </div>
  ),
}));

jest.mock("@/app/components/Accordion/Accordion", () => ({
  __esModule: true,
  default: ({ children, title, onDeleteClick }: any) => (
    <div data-testid="accordion">
      <h4>{title}</h4>
      <button onClick={onDeleteClick}>Delete Service</button>
      {children}
    </div>
  ),
}));

jest.mock("@/app/components/Inputs/ServiceSearch/ServiceSearch", () => ({
  __esModule: true,
  default: () => <div data-testid="service-search" />,
}));

describe("SpecialityCard Component", () => {
  const mockSetFormData = jest.fn();
  const mockTeam = [
    { _id: "t1", name: "Dr. T" },
    { _id: "t2", name: "Nurse J" },
  ];

  const initialSpeciality: SpecialityWeb = {
    name: "General",
    services: [
      {
        // FIX: Added required fields (id, organisationId, isActive)
        id: "svc-1",
        organisationId: "org-1",
        isActive: true,
        name: "Checkup",
        description: "Routine",
        durationMinutes: 30,
        cost: 50,
        maxDiscount: 10,
      },
    ],
    headUserId: "",
    teamMemberIds: [],
    organisationId: "org-1",
  };

  const getUpdateResult = (prev: SpecialityWeb[] = [initialSpeciality]) => {
    const updateFn = mockSetFormData.mock.calls[0][0];
    return updateFn(prev);
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useTeamForPrimaryOrg as jest.Mock).mockReturnValue(mockTeam);
  });

  // --- 1. Rendering ---

  it("renders lead dropdown, staff select, and existing services", () => {
    render(
      <SpecialityCard
        setFormData={mockSetFormData}
        speciality={initialSpeciality}
        index={0}
      />
    );

    expect(screen.getByTestId("dropdown-lead")).toBeInTheDocument();
    expect(screen.getByTestId("multiselect-staff")).toBeInTheDocument();
    expect(screen.getByText("Checkup")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Routine")).toBeInTheDocument();
  });

  // --- 2. Lead & Staff Updates ---

  it("updates the Lead (Head) for the speciality", () => {
    render(
      <SpecialityCard
        setFormData={mockSetFormData}
        speciality={initialSpeciality}
        index={0}
      />
    );

    fireEvent.click(screen.getByText("Select Lead"));

    const newState = getUpdateResult();
    expect(newState[0].headName).toBe("Dr. T");
    expect(newState[0].headUserId).toBe("t1");
  });

  it("updates Assigned Staff list", () => {
    render(
      <SpecialityCard
        setFormData={mockSetFormData}
        speciality={initialSpeciality}
        index={0}
      />
    );

    fireEvent.click(screen.getByText("Select Staff"));

    const newState = getUpdateResult();
    expect(newState[0].teamMemberIds).toEqual(["t1", "t2"]);
  });

  // --- 3. Service Field Updates ---

  it("updates service text fields (Description)", () => {
    render(
      <SpecialityCard
        setFormData={mockSetFormData}
        speciality={initialSpeciality}
        index={0}
      />
    );

    const descInput = screen.getByTestId("input-description");
    fireEvent.change(descInput, { target: { value: "Detailed Checkup" } });

    const newState = getUpdateResult();
    expect(newState[0].services[0].description).toBe("Detailed Checkup");
  });

  it("updates service numeric fields (Duration, Cost, Discount)", () => {
    render(
      <SpecialityCard
        setFormData={mockSetFormData}
        speciality={initialSpeciality}
        index={0}
      />
    );

    // Update Duration
    fireEvent.change(screen.getByTestId("input-durationmins"), {
      target: { value: "60" },
    });
    let newState = getUpdateResult();
    expect(newState[0].services[0].durationMinutes).toBe("60");
    mockSetFormData.mockClear();

    // Update Cost
    fireEvent.change(screen.getByTestId("input-servicecharge"), {
      target: { value: "100" },
    });
    newState = getUpdateResult();
    expect(newState[0].services[0].cost).toBe("100");
    mockSetFormData.mockClear();

    // Update Discount
    fireEvent.change(screen.getByTestId("input-maxdiscount"), {
      target: { value: "5" },
    });
    newState = getUpdateResult();
    expect(newState[0].services[0].maxDiscount).toBe("5");
  });

  // --- 4. Removing Services & Logic ---

  it("removes a service when delete is clicked in accordion", () => {
    render(
      <SpecialityCard
        setFormData={mockSetFormData}
        speciality={initialSpeciality}
        index={0}
      />
    );

    fireEvent.click(screen.getByText("Delete Service"));

    const newState = getUpdateResult();
    expect(newState[0].services).toHaveLength(0);
  });

  it("does not update other specialities in the list (Index check)", () => {
    render(
      <SpecialityCard
        setFormData={mockSetFormData}
        speciality={initialSpeciality}
        index={1} // Component thinks it is index 1
      />
    );

    fireEvent.click(screen.getByText("Select Lead"));

    const prevState = [
      { name: "Other Spec", organisationId: "org-1", services: [] }, // Index 0
      initialSpeciality, // Index 1
    ];

    const updateFn = mockSetFormData.mock.calls[0][0];
    const newState = updateFn(prevState);

    // Index 0 should remain untouched
    expect(newState[0].name).toBe("Other Spec");
    expect(newState[0].headUserId).toBeUndefined();

    // Index 1 should be updated
    expect(newState[1].headUserId).toBe("t1");
  });

  it("handles services being undefined gracefully", () => {
    const noServicesSpec = { ...initialSpeciality, services: undefined };
    render(
      <SpecialityCard
        setFormData={mockSetFormData}
        speciality={noServicesSpec}
        index={0}
      />
    );

    expect(screen.queryByTestId("accordion")).not.toBeInTheDocument();
  });
});
