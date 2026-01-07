import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import Rooms from "@/app/pages/Organization/Sections/Rooms/Rooms";
import { useRoomsForPrimaryOrg } from "@/app/hooks/useRooms";

// --- Mocks ---

jest.mock("@/app/hooks/useRooms", () => ({
  useRoomsForPrimaryOrg: jest.fn(),
}));

jest.mock("@/app/components/Accordion/AccordionButton", () => ({
  __esModule: true,
  default: ({ title, buttonTitle, buttonClick, children }: any) => (
    <div data-testid="accordion-button">
      <h1>{title}</h1>
      <button onClick={() => buttonClick(true)}>{buttonTitle}</button>
      {children}
    </div>
  ),
}));

jest.mock("@/app/components/DataTable/RoomTable", () => ({
  __esModule: true,
  default: ({ filteredList, setActive, setView }: any) => (
    <div data-testid="room-table">
      {filteredList.map((room: any) => (
        <button
          key={room.id}
          data-testid={`view-room-${room.id}`}
          onClick={() => {
            setActive(room);
            setView(true);
          }}
        >
          View {room.name}
        </button>
      ))}
    </div>
  ),
}));

jest.mock("../../../../../pages/Organization/Sections/Rooms/AddRoom", () => ({
  __esModule: true,
  default: ({ showModal }: any) =>
    showModal ? <div data-testid="add-room-modal" /> : null,
}));

jest.mock("../../../../../pages/Organization/Sections/Rooms/RoomInfo", () => ({
  __esModule: true,
  default: ({ showModal, activeRoom }: any) =>
    showModal ? (
      <div data-testid="room-info-modal">{activeRoom.name}</div>
    ) : null,
}));

describe("Rooms Section Component", () => {
  const mockRooms = [
    { id: "1", name: "Room A" },
    { id: "2", name: "Room B" },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- 1. Rendering Section ---

  it("renders the accordion and table with rooms", () => {
    (useRoomsForPrimaryOrg as jest.Mock).mockReturnValue(mockRooms);
    render(<Rooms />);

    expect(screen.getByText("Rooms")).toBeInTheDocument();
    expect(screen.getByTestId("room-table")).toBeInTheDocument();
    expect(screen.getByText("View Room A")).toBeInTheDocument();
  });

  it("handles empty room list gracefully", () => {
    (useRoomsForPrimaryOrg as jest.Mock).mockReturnValue([]);
    render(<Rooms />);

    expect(screen.queryByTestId("room-info-modal")).not.toBeInTheDocument();
  });

  // --- 2. Interaction Section ---

  it("opens the AddRoom modal when the Add button is clicked", () => {
    (useRoomsForPrimaryOrg as jest.Mock).mockReturnValue(mockRooms);
    render(<Rooms />);

    fireEvent.click(screen.getByText("Add"));
    expect(screen.getByTestId("add-room-modal")).toBeInTheDocument();
  });

  it("opens the RoomInfo modal and sets active room when table row is clicked", () => {
    (useRoomsForPrimaryOrg as jest.Mock).mockReturnValue(mockRooms);
    render(<Rooms />);

    fireEvent.click(screen.getByTestId("view-room-2"));
    expect(screen.getByTestId("room-info-modal")).toHaveTextContent("Room B");
  });

  // --- 3. Logic & useEffect Section ---

  it("updates activeRoom when the room list changes (active room still exists)", () => {
    const { rerender } = render(<Rooms />);

    // Initial state with Room 1 active (rooms[0])
    (useRoomsForPrimaryOrg as jest.Mock).mockReturnValue(mockRooms);
    rerender(<Rooms />);

    // Change room name in list
    const updatedRooms = [
      { id: "1", name: "Room A Updated" },
      { id: "2", name: "Room B" },
    ];
    (useRoomsForPrimaryOrg as jest.Mock).mockReturnValue(updatedRooms);

    rerender(<Rooms />);

    // Trigger ViewPopup to see the name in RoomInfo
    fireEvent.click(screen.getByTestId("view-room-1"));
    expect(screen.getByTestId("room-info-modal")).toHaveTextContent(
      "Room A Updated"
    );
  });

  it("resets activeRoom to rooms[0] if the previous active room is removed", () => {
    (useRoomsForPrimaryOrg as jest.Mock).mockReturnValue(mockRooms);
    const { rerender } = render(<Rooms />);

    // Set Room B as active
    fireEvent.click(screen.getByTestId("view-room-2"));

    // Remove Room B from the list
    const newRooms = [{ id: "1", name: "Room A" }];
    (useRoomsForPrimaryOrg as jest.Mock).mockReturnValue(newRooms);

    rerender(<Rooms />);

    // Active room should have defaulted back to Room A
    expect(screen.getByTestId("room-info-modal")).toHaveTextContent("Room A");
  });

  it("sets activeRoom to null if all rooms are removed", () => {
    (useRoomsForPrimaryOrg as jest.Mock).mockReturnValue(mockRooms);
    const { rerender } = render(<Rooms />);

    (useRoomsForPrimaryOrg as jest.Mock).mockReturnValue([]);
    rerender(<Rooms />);

    expect(screen.queryByTestId("room-info-modal")).not.toBeInTheDocument();
  });
});
