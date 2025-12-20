import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import SpecialityInfo from "@/app/pages/Organization/Sections/Specialities/SpecialityInfo";
import { useTeamForPrimaryOrg } from "@/app/hooks/useTeam";
import {
  updateService,
  updateSpeciality,
} from "@/app/services/specialityService";
import { SpecialityWeb } from "@/app/types/speciality";

// --- Mocks ---

jest.mock("@/app/hooks/useTeam", () => ({
  useTeamForPrimaryOrg: jest.fn(),
}));

jest.mock("@/app/services/specialityService", () => ({
  updateService: jest.fn(),
  updateSpeciality: jest.fn(),
}));

jest.mock("@/app/components/Modal", () => ({
  __esModule: true,
  default: ({ children, showModal }: any) =>
    showModal ? <div>{children}</div> : null,
}));

jest.mock("@/app/components/Inputs/ServiceSearch/ServiceSearchEdit", () => ({
  __esModule: true,
  default: () => <div data-testid="service-search-edit" />,
}));

jest.mock("@/app/components/Accordion/Accordion", () => ({
  __esModule: true,
  default: ({ children, title }: any) => (
    <div data-testid={`accordion-${title.toLowerCase()}`}>
      <h3>{title}</h3>
      {children}
    </div>
  ),
}));

// Mock EditableAccordion to simulate Save events
jest.mock("@/app/components/Accordion/EditableAccordion", () => ({
  __esModule: true,
  default: ({ title, onSave, data }: any) => (
    <div
      data-testid={`editable-accordion-${title.replaceAll(/\s+/g, "-").toLowerCase()}`}
    >
      <h4>{title}</h4>
      <span data-testid={`data-${title.replaceAll(/\s+/g, "-").toLowerCase()}`}>
        {data.name}
      </span>
      <button
        data-testid={`save-${title.replaceAll(/\s+/g, "-").toLowerCase()}`}
        onClick={() => {
          // Simulate different payloads based on what section it is
          if (title === "Core") {
            onSave({ name: "Updated Speciality", headName: "team-1" });
          } else {
            onSave({
              name: "Updated Service",
              description: "New Desc",
              durationMinutes: "45",
              cost: "150",
              maxDiscount: "20",
            });
          }
        }}
      >
        Save {title}
      </button>
      <button
        data-testid={`save-empty-${title.replaceAll(/\s+/g, "-").toLowerCase()}`}
        onClick={() => {
          // Simulate sending empty/null values to test fallback logic
          onSave({ maxDiscount: "" });
        }}
      >
        Save Empty {title}
      </button>
    </div>
  ),
}));

describe("SpecialityInfo Component", () => {
  const mockSetShowModal = jest.fn();
  const mockTeam = [{ _id: "team-1", name: "Dr. Smith" }];

  const mockActiveSpeciality: SpecialityWeb = {
    _id: "spec-1",
    organisationId: "org-1",
    name: "Cardiology",
    headUserId: "team-old",
    headName: "Old Lead",
    services: [
      {
        id: "svc-1",
        organisationId: "org-1",
        name: "Consultation",
        description: "Standard checkup",
        durationMinutes: 30,
        cost: 100,
        maxDiscount: 10,
        isActive: true,
      },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useTeamForPrimaryOrg as jest.Mock).mockReturnValue(mockTeam);
  });

  // --- 1. Rendering ---

  it("renders correctly with active speciality data", () => {
    render(
      <SpecialityInfo
        showModal={true}
        setShowModal={mockSetShowModal}
        activeSpeciality={mockActiveSpeciality}
      />
    );

    expect(screen.getByText("View speciality")).toBeInTheDocument();
  });

  it("renders fallback values for empty data", () => {
    const emptySpec = {
      ...mockActiveSpeciality,
      name: "",
      headUserId: null,
    } as any;
    render(
      <SpecialityInfo
        showModal={true}
        setShowModal={mockSetShowModal}
        activeSpeciality={emptySpec}
      />
    );
    // Should render without crashing
    expect(screen.getByText("View speciality")).toBeInTheDocument();
  });

  it("closes modal when close icon is clicked", () => {
    const { container } = render(
      <SpecialityInfo
        showModal={true}
        setShowModal={mockSetShowModal}
        activeSpeciality={mockActiveSpeciality}
      />
    );

    const closeIcon = container.querySelector("svg.cursor-pointer");
    if (closeIcon) fireEvent.click(closeIcon);

    expect(mockSetShowModal).toHaveBeenCalledWith(false);
  });

  // --- 2. Updating Speciality (Core) ---

  it("calls updateSpeciality with correct data on Core save", async () => {
    render(
      <SpecialityInfo
        showModal={true}
        setShowModal={mockSetShowModal}
        activeSpeciality={mockActiveSpeciality}
      />
    );

    fireEvent.click(screen.getByTestId("save-core"));

    await waitFor(() => {
      expect(updateSpeciality).toHaveBeenCalledWith(
        expect.objectContaining({
          _id: "spec-1",
          name: "Updated Speciality",
          headUserId: "team-1",
          headName: "Dr. Smith", // Mapped from TeamOptions
          services: [], // Payload explicitly sets empty array for Core update
        })
      );
    });
  });

  // --- 3. Updating Service ---

  it("calls updateService with converted numbers on Service save", async () => {
    render(
      <SpecialityInfo
        showModal={true}
        setShowModal={mockSetShowModal}
        activeSpeciality={mockActiveSpeciality}
      />
    );

    fireEvent.click(screen.getByTestId("save-consultation"));

    await waitFor(() => {
      expect(updateService).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "svc-1",
          name: "Updated Service",
          description: "New Desc",
          durationMinutes: 45, // Number conversion
          cost: 150, // Number conversion
          maxDiscount: 20, // Number conversion
        })
      );
    });
  });

  it("handles empty/null values correctly during Service update", async () => {
    render(
      <SpecialityInfo
        showModal={true}
        setShowModal={mockSetShowModal}
        activeSpeciality={mockActiveSpeciality}
      />
    );

    // Click the button that sends empty payload parts
    fireEvent.click(screen.getByTestId("save-empty-consultation"));

    await waitFor(() => {
      expect(updateService).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "svc-1",
          name: "Consultation", // Fallback to original
          maxDiscount: null, // Explicit check for empty string -> null
        })
      );
    });
  });

  // --- 4. Logic & Edge Cases ---

  it("handles case where Team Option is not found", async () => {
    // Return empty teams so lookup fails
    (useTeamForPrimaryOrg as jest.Mock).mockReturnValue([]);

    render(
      <SpecialityInfo
        showModal={true}
        setShowModal={mockSetShowModal}
        activeSpeciality={mockActiveSpeciality}
      />
    );

    fireEvent.click(screen.getByTestId("save-core"));

    await waitFor(() => {
      expect(updateSpeciality).toHaveBeenCalledWith(
        expect.objectContaining({
          headName: "Old Lead", // Fallback to original because finding team label failed
        })
      );
    });
  });

  it("renders correctly if activeSpeciality services is undefined", () => {
    const noServices = { ...mockActiveSpeciality, services: undefined };
    render(
      <SpecialityInfo
        showModal={true}
        setShowModal={mockSetShowModal}
        activeSpeciality={noServices}
      />
    );

    expect(
      screen.queryByTestId("editable-accordion-consultation")
    ).not.toBeInTheDocument();
  });
});
