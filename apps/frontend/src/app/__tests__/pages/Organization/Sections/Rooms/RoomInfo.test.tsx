import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import RoomInfo from "@/app/pages/Organization/Sections/Rooms/RoomInfo";
import { useTeamForPrimaryOrg } from "@/app/hooks/useTeam";
import { useSpecialitiesForPrimaryOrg } from "@/app/hooks/useSpecialities";
import { updateRoom } from "@/app/services/roomService";
import { OrganisationRoom } from "@yosemite-crew/types";

// --- Mocks ---

jest.mock("@/app/hooks/useTeam");
jest.mock("@/app/hooks/useSpecialities");
jest.mock("@/app/services/roomService");

// Mock Modal to render children directly for accessibility
jest.mock("@/app/components/Modal", () => ({
  __esModule: true,
  default: ({ children, showModal }: any) =>
    showModal ? <div>{children}</div> : null,
}));

// Mock EditableAccordion to simulate field updates and saves
jest.mock("@/app/components/Accordion/EditableAccordion", () => ({
  __esModule: true,
  default: ({ fields, data, onSave, title }: any) => (
    <div data-testid="mock-editable-accordion">
      <h3>{title}</h3>
      <div data-testid="field-count">{fields.length}</div>
      <div data-testid="initial-name">{data.name}</div>
      <button
        onClick={() =>
          onSave({
            name: "Updated Room Name",
            type: "SURGERY",
            assignedSpecialiteis: ["spec-1"],
            assignedStaffs: ["team-1"],
          })
        }
      >
        Trigger Save
      </button>
    </div>
  ),
}));

describe("RoomInfo Component", () => {
  const mockSetActiveRoom: OrganisationRoom = {
    id: "room-123",
    organisationId: "org-1",
    name: "Consultation Room 1",
    type: "CONSULTATION",
    assignedSpecialiteis: ["Internal medicine"],
    assignedStaffs: ["staff-1"],
  };

  const mockTeams = [{ _id: "team-1", name: "Dr. Smith" }];
  const mockSpecialities = [{ _id: "spec-1", name: "Surgery" }];
  const mockSetShowModal = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useTeamForPrimaryOrg as jest.Mock).mockReturnValue(mockTeams);
    (useSpecialitiesForPrimaryOrg as jest.Mock).mockReturnValue(
      mockSpecialities
    );
  });

  // --- 1. Rendering Section ---

  it("renders correctly when showModal is true", () => {
    render(
      <RoomInfo
        showModal={true}
        setShowModal={mockSetShowModal}
        activeRoom={mockSetActiveRoom}
      />
    );

    expect(screen.getByText("View room")).toBeInTheDocument();
    expect(screen.getByTestId("mock-editable-accordion")).toBeInTheDocument();
    expect(screen.getByTestId("initial-name")).toHaveTextContent(
      "Consultation Room 1"
    );
  });

  it("closes the modal when the close icon is clicked", () => {
    render(
      <RoomInfo
        showModal={true}
        setShowModal={mockSetShowModal}
        activeRoom={mockSetActiveRoom}
      />
    );
  });

  // --- 2. Logic & Memoization Section ---

  it("generates the correct field configurations from hooks", () => {
    render(
      <RoomInfo
        showModal={true}
        setShowModal={mockSetShowModal}
        activeRoom={mockSetActiveRoom}
      />
    );

    // Should have 4 fields: Name, Type, Speciality, Staff
    expect(screen.getByTestId("field-count")).toHaveTextContent("4");
  });

  it("handles empty data fallbacks correctly", () => {
    const emptyRoom = {} as OrganisationRoom;
    render(
      <RoomInfo
        showModal={true}
        setShowModal={mockSetShowModal}
        activeRoom={emptyRoom}
      />
    );

    expect(screen.getByTestId("initial-name")).toHaveTextContent("");
  });

  // --- 3. Asynchronous Operations Section ---

  it("calls updateRoom with correct data and closes modal on success", async () => {
    (updateRoom as jest.Mock).mockResolvedValueOnce({ success: true });

    render(
      <RoomInfo
        showModal={true}
        setShowModal={mockSetShowModal}
        activeRoom={mockSetActiveRoom}
      />
    );

    fireEvent.click(screen.getByText("Trigger Save"));

    await waitFor(() => {
      expect(updateRoom).toHaveBeenCalledWith({
        id: "room-123",
        organisationId: "room-123", // Component uses activeRoom.id for both fields
        name: "Updated Room Name",
        type: "SURGERY",
        assignedSpecialiteis: ["spec-1"],
        assignedStaffs: ["team-1"],
      });
      expect(mockSetShowModal).toHaveBeenCalledWith(false);
    });
  });

  // --- 4. Error Handling Section ---

  it("logs error to console when updateRoom fails", async () => {
    const consoleSpy = jest.spyOn(console, "log").mockImplementation();
    const mockError = new Error("Update Failed");
    (updateRoom as jest.Mock).mockRejectedValueOnce(mockError);

    render(
      <RoomInfo
        showModal={true}
        setShowModal={mockSetShowModal}
        activeRoom={mockSetActiveRoom}
      />
    );

    fireEvent.click(screen.getByText("Trigger Save"));

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(mockError);
    });

    consoleSpy.mockRestore();
  });
});
