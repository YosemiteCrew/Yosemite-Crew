import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import RoomCard from "@/app/components/Cards/RoomCard";
import { OrganisationRoom } from "@yosemite-crew/types";

// --- Mocks ---

// Mock helper function from RoomTable
jest.mock("@/app/components/DataTable/RoomTable", () => ({
  joinNames: jest.fn((map, ids) => {
    if (!ids || ids.length === 0) return "-";
    // Simple join logic for testing verification
    return ids.map((id: string) => map[id] || id).join(", ");
  }),
}));

import { joinNames } from "@/app/components/DataTable/RoomTable";

// --- Test Data ---

const mockRoom: OrganisationRoom = {
  _id: "room-101",
  name: "Surgery Room A",
  type: "Surgery",
  // Note: Using spelling from source code interface
  assignedSpecialiteis: ["spec-1", "spec-2"],
  assignedStaffs: ["staff-1"],
} as any;

const mockSpecialityMap = {
  "spec-1": "Orthopedics",
  "spec-2": "General",
};

const mockStaffMap = {
  "staff-1": "Dr. Strange",
};

describe("RoomCard Component", () => {
  const mockHandleView = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- 1. Rendering Details ---

  it("renders room information correctly", () => {
    render(
      <RoomCard
        room={mockRoom}
        handleViewRoom={mockHandleView}
        specialityNameById={mockSpecialityMap}
        staffNameById={mockStaffMap}
      />
    );

    // Title & Type
    expect(screen.getByText("Surgery Room A")).toBeInTheDocument();
    expect(screen.getByText("Type:")).toBeInTheDocument();
    expect(screen.getByText("Surgery")).toBeInTheDocument();

    // Verify helper function calls
    expect(joinNames).toHaveBeenCalledWith(mockSpecialityMap, [
      "spec-1",
      "spec-2",
    ]);
    expect(joinNames).toHaveBeenCalledWith(mockStaffMap, ["staff-1"]);

    // Verify Rendered output from helper
    expect(screen.getByText("Orthopedics, General")).toBeInTheDocument();
    expect(screen.getByText("Dr. Strange")).toBeInTheDocument();
  });

  // --- 2. Interaction ---

  it("calls handleViewRoom with room object when View button is clicked", () => {
    render(
      <RoomCard
        room={mockRoom}
        handleViewRoom={mockHandleView}
        specialityNameById={mockSpecialityMap}
        staffNameById={mockStaffMap}
      />
    );

    const viewBtn = screen.getByText("View");
    fireEvent.click(viewBtn);

    expect(mockHandleView).toHaveBeenCalledTimes(1);
    expect(mockHandleView).toHaveBeenCalledWith(mockRoom);
  });

  // --- 3. Edge Cases ---

  it("handles empty assignments gracefully (via helper mock)", () => {
    const emptyRoom = {
      ...mockRoom,
      assignedSpecialiteis: [],
      assignedStaffs: [],
    } as any;

    render(
      <RoomCard
        room={emptyRoom}
        handleViewRoom={mockHandleView}
        specialityNameById={mockSpecialityMap}
        staffNameById={mockStaffMap}
      />
    );

    // Our mock returns "-" for empty arrays
    const dashes = screen.getAllByText("-");
    expect(dashes.length).toBeGreaterThanOrEqual(1);
  });
});
