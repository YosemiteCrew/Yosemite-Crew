import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import AppointmentFilters from "@/app/components/Filters/AppointmentFilters";
import { Appointment } from "@yosemite-crew/types";

// --- Mocks ---

// Mock Search Component to control search input directly and isolate unit logic
jest.mock("@/app/components/Inputs/Search", () => ({
  __esModule: true,
  default: ({ value, setSearch }: any) => (
    <input
      data-testid="search-input"
      value={value}
      onChange={(e) => setSearch(e.target.value)}
    />
  ),
}));

// --- Test Data ---

const mockAppointments: Appointment[] = [
  {
    _id: "1",
    status: "upcoming",
    isEmergency: false,
    companion: { name: "Buddy" },
  },
  {
    _id: "2",
    status: "upcoming",
    isEmergency: true, // Emergency
    companion: { name: "Rex" },
  },
  {
    _id: "3",
    status: "completed",
    isEmergency: false,
    companion: { name: "Luna" },
  },
  {
    _id: "4",
    status: "completed",
    isEmergency: true,
    companion: { name: "Max" },
  },
] as any;

describe("AppointmentFilters Component", () => {
  const mockSetFilteredList = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- 1. Initial Rendering & Default State ---

  it("renders all filter buttons and search input", () => {
    render(
      <AppointmentFilters
        list={mockAppointments}
        setFilteredList={mockSetFilteredList}
      />
    );

    // Type buttons
    expect(screen.getByText("All")).toBeInTheDocument();
    expect(screen.getByText("Emergencies")).toBeInTheDocument();

    // Status buttons (Sample check)
    expect(screen.getByText("Upcoming")).toBeInTheDocument();
    expect(screen.getByText("Completed")).toBeInTheDocument();
    expect(screen.getByText("Cancelled")).toBeInTheDocument();
  });

  it("filters by default state (All Types + Upcoming Status) on mount", () => {
    render(
      <AppointmentFilters
        list={mockAppointments}
        setFilteredList={mockSetFilteredList}
      />
    );

    // Default: activeType="all", activeStatus="upcoming"
    // Should match appointments 1 and 2
    expect(mockSetFilteredList).toHaveBeenCalledWith([
      mockAppointments[0],
      mockAppointments[1],
    ]);
  });

  // --- 2. Interactions (Filter Logic) ---

  it("filters by Status change (Completed)", () => {
    render(
      <AppointmentFilters
        list={mockAppointments}
        setFilteredList={mockSetFilteredList}
      />
    );

    const completedBtn = screen.getByText("Completed");
    fireEvent.click(completedBtn);

    // Should match appointments 3 and 4 (Status: completed, Type: all)
    expect(mockSetFilteredList).toHaveBeenLastCalledWith([
      mockAppointments[2],
      mockAppointments[3],
    ]);
  });

  it("filters by Type change (Emergencies)", () => {
    render(
      <AppointmentFilters
        list={mockAppointments}
        setFilteredList={mockSetFilteredList}
      />
    );

    // First switch status to 'upcoming' (default) to be sure
    // Then click "Emergencies"
    const emergencyBtn = screen.getByText("Emergencies");
    fireEvent.click(emergencyBtn);

    // Should match appointment 2 only (Status: upcoming, Type: emergency)
    // Appointment 4 is emergency but status is completed, so it's excluded by status filter
    expect(mockSetFilteredList).toHaveBeenLastCalledWith([mockAppointments[1]]);
  });

  // --- 3. Combined Filtering ---

  it("filters by combined Status, Type, and Search", () => {
    render(
      <AppointmentFilters
        list={mockAppointments}
        setFilteredList={mockSetFilteredList}
      />
    );

    // 1. Set Status to "Completed"
    fireEvent.click(screen.getByText("Completed"));

    // 2. Set Type to "Emergencies"
    fireEvent.click(screen.getByText("Emergencies"));

    // Expect appointment 4 (Status: completed, Emergency: true, Name: Max)
    expect(mockSetFilteredList).toHaveBeenLastCalledWith([mockAppointments[3]]);
  });

  // --- 4. Styling Checks (Active State) ---

  it("applies active styles to selected buttons", () => {
    render(
      <AppointmentFilters
        list={mockAppointments}
        setFilteredList={mockSetFilteredList}
      />
    );

    const emergencyBtn = screen.getByText("Emergencies");

    // Click "Emergencies"
    fireEvent.click(emergencyBtn);
  });

  it("applies correct dynamic styles for status buttons", () => {
    render(
      <AppointmentFilters
        list={mockAppointments}
        setFilteredList={mockSetFilteredList}
      />
    );
  });
});
