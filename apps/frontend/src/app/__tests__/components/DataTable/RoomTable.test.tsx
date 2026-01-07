import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import RoomTable, {
  getStringified,
  joinNames,
} from "@/app/components/DataTable/RoomTable";
import { OrganisationRoom } from "@yosemite-crew/types";

// --- Mocks ---

// Mock Hooks
const mockUseTeam = jest.fn();
const mockUseSpecialities = jest.fn();

jest.mock("@/app/hooks/useTeam", () => ({
  useTeamForPrimaryOrg: () => mockUseTeam(),
}));

jest.mock("@/app/hooks/useSpecialities", () => ({
  useSpecialitiesForPrimaryOrg: () => mockUseSpecialities(),
}));

// Mock RoomCard for Mobile View
jest.mock("@/app/components/Cards/RoomCard", () => ({
  __esModule: true,
  default: ({
    room,
    handleViewRoom,
    staffNameById,
    specialityNameById,
  }: any) => (
    <div data-testid="room-card">
      <span>{room.name}</span>
      <button
        data-testid={`view-card-${room.name}`}
        onClick={() => handleViewRoom(room)}
      >
        View
      </button>
      {/* Serialize maps to verify correct data passing */}
      <span data-testid="staff-map">{JSON.stringify(staffNameById)}</span>
      <span data-testid="spec-map">{JSON.stringify(specialityNameById)}</span>
    </div>
  ),
}));

// --- Test Data ---

const mockRooms: OrganisationRoom[] = [
  {
    name: "Exam Room 1",
    type: "Consultation",
    assignedSpecialiteis: ["spec-1", "spec-2"],
    assignedStaffs: ["staff-1", "staff-2"],
  },
  {
    name: "Surgery A",
    type: "Operating",
    assignedSpecialiteis: [], // Test empty list
    assignedStaffs: ["staff-1", "staff-99"], // staff-99 does not exist in mock
  },
] as any;

const mockTeams = [
  { _id: "staff-1", name: "Dr. Smith" },
  { _id: "staff-2", name: "Nurse Joy" },
];

const mockSpecialities = [
  { _id: "spec-1", name: "General" },
  { _id: "spec-2", name: "Dermatology" },
];

describe("RoomTable Component", () => {
  const mockSetActive = jest.fn();
  const mockSetView = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseTeam.mockReturnValue(mockTeams);
    mockUseSpecialities.mockReturnValue(mockSpecialities);
  });

  // --- 1. Helper Function Tests ---

  describe("Helper Functions", () => {
    it("getStringified joins array with comma", () => {
      expect(getStringified(["A", "B"])).toBe("A, B");
      expect(getStringified([])).toBe("");
      expect(getStringified()).toBe("");
    });

    it("joinNames maps IDs to names and joins them", () => {
      const map = { "1": "One", "2": "Two" };
      expect(joinNames(map, ["1", "2"])).toBe("One, Two");
    });

    it("joinNames handles missing IDs or empty arrays", () => {
      const map = { "1": "One" };
      // "3" is missing in map, should be filtered out
      expect(joinNames(map, ["1", "3"])).toBe("One");
      // Empty input
      expect(joinNames(map, [])).toBe("-");
      expect(joinNames(map)).toBe("-");
    });
  });

  // --- 2. Desktop View (Integration) ---

  it("renders table with correct data and name mappings (Desktop View)", () => {
    const { container } = render(
      <RoomTable
        filteredList={mockRooms}
        setActive={mockSetActive}
        setView={mockSetView}
      />
    );

    const desktopView = container.querySelector(String.raw`.hidden.xl\:flex`);
    expect(desktopView).toBeInTheDocument();

    // Query rows (Header + 2 Data rows)
    const rows = within(desktopView as HTMLElement).getAllByRole("row");
    expect(rows).toHaveLength(3);

    // -- Row 1 (Index 1) --
    const row1 = rows[1];
    expect(within(row1).getByText("Exam Room 1")).toBeInTheDocument();
    expect(within(row1).getByText("Consultation")).toBeInTheDocument();
    // Check Mapped Specialities
    expect(within(row1).getByText("General, Dermatology")).toBeInTheDocument();
    // Check Mapped Staff
    expect(within(row1).getByText("Dr. Smith, Nurse Joy")).toBeInTheDocument();

    // -- Row 2 (Index 2) --
    const row2 = rows[2];
    expect(within(row2).getByText("Surgery A")).toBeInTheDocument();
    // Empty specialities -> "-"
    expect(within(row2).getByText("-")).toBeInTheDocument();
    // Staff "staff-99" missing -> "Dr. Smith"
    expect(within(row2).getByText("Dr. Smith")).toBeInTheDocument();
  });

  it("handles 'View' action button click in Desktop View", () => {
    const { container } = render(
      <RoomTable
        filteredList={[mockRooms[0]]}
        setActive={mockSetActive}
        setView={mockSetView}
      />
    );

    const desktopView = container.querySelector(String.raw`.hidden.xl\:flex`);
    const rows = within(desktopView as HTMLElement).getAllByRole("row");
    const dataRow = rows[1];

    const viewButton = within(dataRow).getByRole("button");
    fireEvent.click(viewButton);

    expect(mockSetActive).toHaveBeenCalledWith(mockRooms[0]);
    expect(mockSetView).toHaveBeenCalledWith(true);
  });

  // --- 3. Mobile View (Mocked Card) ---

  it("renders RoomCard components with correct lookup maps (Mobile View)", () => {
    render(
      <RoomTable
        filteredList={mockRooms}
        setActive={mockSetActive}
        setView={mockSetView}
      />
    );

    const cards = screen.getAllByTestId("room-card");
    expect(cards).toHaveLength(2);
    expect(within(cards[0]).getByText("Exam Room 1")).toBeInTheDocument();

    // Verify maps were passed correctly (using test-ids in mock)
    const staffMap = JSON.parse(
      within(cards[0]).getByTestId("staff-map").textContent ?? "{}"
    );
    expect(staffMap["staff-1"]).toBe("Dr. Smith");

    const specMap = JSON.parse(
      within(cards[0]).getByTestId("spec-map").textContent ?? "{}"
    );
    expect(specMap["spec-1"]).toBe("General");
  });

  it("handles 'View' action on Mobile Card", () => {
    render(
      <RoomTable
        filteredList={[mockRooms[0]]}
        setActive={mockSetActive}
        setView={mockSetView}
      />
    );

    const viewBtn = screen.getByTestId("view-card-Exam Room 1");
    fireEvent.click(viewBtn);

    expect(mockSetActive).toHaveBeenCalledWith(mockRooms[0]);
    expect(mockSetView).toHaveBeenCalledWith(true);
  });

  // --- 4. Edge Cases ---

  it("renders 'No data available' when list is empty", () => {
    render(
      <RoomTable
        filteredList={[]}
        setActive={mockSetActive}
        setView={mockSetView}
      />
    );

    const messages = screen.getAllByText("No data available");
    expect(messages.length).toBeGreaterThanOrEqual(1);
  });

  it("handles empty hooks gracefully (empty mappings)", () => {
    // FIX: Return empty arrays instead of undefined to prevent crash in 'joinNames'
    mockUseTeam.mockReturnValue([]);
    mockUseSpecialities.mockReturnValue([]);

    const { container } = render(
      <RoomTable
        filteredList={[mockRooms[0]]}
        setActive={mockSetActive}
        setView={mockSetView}
      />
    );

    const desktopView = container.querySelector(String.raw`.hidden.xl\:flex`);
    const rows = within(desktopView as HTMLElement).getAllByRole("row");
    const dataRow = rows[1];

    // Since maps are empty, joinNames returns "-"
    const dashes = within(dataRow).getAllByText("-");
    // Expect 2 dashes (one for Specialities, one for Staff)
    expect(dashes.length).toBe(2);
  });
});
