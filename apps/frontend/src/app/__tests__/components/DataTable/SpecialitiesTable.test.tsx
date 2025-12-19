import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import SpecialitiesTable, {
  getServiceNames,
} from "@/app/components/DataTable/SpecialitiesTable";
import { SpecialityWeb } from "@/app/types/speciality";

// --- Mocks ---

// REMOVED: GenericTable mock.
// We are integration testing with the real table component.

// Mock SpecialitiesCard for Mobile View
jest.mock("@/app/components/Cards/SpecialitiesCard", () => ({
  __esModule: true,
  default: ({ speciality, handleViewSpeciality }: any) => (
    <div data-testid="speciality-card">
      <span>{speciality.name}</span>
      <button
        data-testid={`view-card-${speciality.name}`}
        onClick={() => handleViewSpeciality(speciality)}
      >
        View
      </button>
    </div>
  ),
}));

// --- Test Data ---

const mockSpecialities: SpecialityWeb[] = [
  {
    _id: "spec-1",
    name: "Cardiology",
    services: [{ name: "Consultation" }, { name: "Surgery" }],
    teamMemberIds: ["t1", "t2"],
    headName: "Dr. Heart",
  },
  {
    _id: "spec-2",
    name: "Dermatology",
    services: [], // Empty services -> "-"
    teamMemberIds: undefined, // Missing team -> 0
    headName: undefined, // Missing head -> "-"
  },
] as any;

describe("SpecialitiesTable Component", () => {
  const mockSetActive = jest.fn();
  const mockSetView = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- 1. Helper Function Tests ---

  describe("getServiceNames", () => {
    it("joins service names with comma", () => {
      const services = [
        { name: "A", _id: "1", duration: 10, price: 100 },
        { name: "B", _id: "2", duration: 20, price: 200 },
      ] as any;
      expect(getServiceNames(services)).toBe("A, B");
    });

    it("returns empty string for empty array or undefined", () => {
      expect(getServiceNames([])).toBe("");
      expect(getServiceNames()).toBe("");
    });
  });

  // --- 2. Desktop View (Integration) ---

  it("renders table with correct data (Desktop View)", () => {
    const { container } = render(
      <SpecialitiesTable
        filteredList={mockSpecialities}
        setActive={mockSetActive}
        setView={mockSetView}
      />
    );

    const desktopView = container.querySelector(String.raw`.hidden.xl\:flex`);
    expect(desktopView).toBeInTheDocument();

    // Query rows (Header + 2 Data rows = 3)
    const rows = within(desktopView as HTMLElement).getAllByRole("row");
    expect(rows).toHaveLength(3);

    // -- Row 1 (Index 1) --
    const row1 = rows[1];
    expect(within(row1).getByText("Cardiology")).toBeInTheDocument();
    expect(within(row1).getByText("Consultation, Surgery")).toBeInTheDocument();
    expect(within(row1).getByText("2")).toBeInTheDocument(); // Team count
    expect(within(row1).getByText("Dr. Heart")).toBeInTheDocument();

    // -- Row 2 (Index 2) --
    const row2 = rows[2];
    expect(within(row2).getByText("Dermatology")).toBeInTheDocument();

    // Services "-"
    const dashes = within(row2).getAllByText("-");
    expect(dashes.length).toBeGreaterThanOrEqual(1);

    // Team Count 0
    expect(within(row2).getByText("0")).toBeInTheDocument();
  });

  it("handles 'View' action button click in Desktop View", () => {
    const { container } = render(
      <SpecialitiesTable
        filteredList={[mockSpecialities[0]]}
        setActive={mockSetActive}
        setView={mockSetView}
      />
    );

    const desktopView = container.querySelector(String.raw`.hidden.xl\:flex`);
    const rows = within(desktopView as HTMLElement).getAllByRole("row");
    const dataRow = rows[1]; // First data row

    const viewButton = within(dataRow).getByRole("button");
    fireEvent.click(viewButton);

    expect(mockSetActive).toHaveBeenCalledWith(mockSpecialities[0]);
    expect(mockSetView).toHaveBeenCalledWith(true);
  });

  // --- 3. Mobile View (Mocked Card) ---

  it("renders SpecialitiesCard components (Mobile View)", () => {
    render(
      <SpecialitiesTable
        filteredList={mockSpecialities}
        setActive={mockSetActive}
        setView={mockSetView}
      />
    );

    const cards = screen.getAllByTestId("speciality-card");
    expect(cards).toHaveLength(2);
    expect(within(cards[0]).getByText("Cardiology")).toBeInTheDocument();
  });

  it("handles 'View' action on Mobile Card", () => {
    render(
      <SpecialitiesTable
        filteredList={[mockSpecialities[0]]}
        setActive={mockSetActive}
        setView={mockSetView}
      />
    );

    const viewBtn = screen.getByTestId("view-card-Cardiology");
    fireEvent.click(viewBtn);

    expect(mockSetActive).toHaveBeenCalledWith(mockSpecialities[0]);
    expect(mockSetView).toHaveBeenCalledWith(true);
  });

  // --- 4. Empty State ---

  it("renders 'No data available' when list is empty", () => {
    render(
      <SpecialitiesTable
        filteredList={[]}
        setActive={mockSetActive}
        setView={mockSetView}
      />
    );

    // Expecting 2 instances (Table colspan + Mobile view div)
    const messages = screen.getAllByText("No data available");
    expect(messages.length).toBeGreaterThanOrEqual(1);
  });
});
