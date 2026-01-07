import { renderHook } from "@testing-library/react";
import { useLoadRoomsForPrimaryOrg, useRoomsForPrimaryOrg } from "../../hooks/useRooms";
import { useOrgStore } from "../../stores/orgStore";
import { useOrganisationRoomStore } from "../../stores/roomStore";
import { loadRoomsForOrgPrimaryOrg } from "../../services/roomService";

// --- Mocks ---

jest.mock("../../stores/orgStore");
jest.mock("../../stores/roomStore");
jest.mock("../../services/roomService", () => ({
  loadRoomsForOrgPrimaryOrg: jest.fn(),
}));

describe("useRooms Hooks", () => {
  let mockOrgState: any;
  let mockRoomState: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Default Mock State
    mockOrgState = { primaryOrgId: null };
    mockRoomState = {
      roomsById: {},
      roomIdsByOrgId: {},
    };

    // Setup Store Mocks (Zustand selector pattern)
    (useOrgStore as unknown as jest.Mock).mockImplementation((selector) =>
      selector(mockOrgState)
    );
    (useOrganisationRoomStore as unknown as jest.Mock).mockImplementation((selector) =>
      selector(mockRoomState)
    );
  });

  // --- Section 1: useLoadRoomsForPrimaryOrg ---

  describe("useLoadRoomsForPrimaryOrg", () => {
    it("should trigger service call when primaryOrgId is set", () => {
      mockOrgState.primaryOrgId = "org-1";

      renderHook(() => useLoadRoomsForPrimaryOrg());

      expect(loadRoomsForOrgPrimaryOrg).toHaveBeenCalledWith({ force: true });
      expect(loadRoomsForOrgPrimaryOrg).toHaveBeenCalledTimes(1);
    });

    it("should NOT trigger service call when primaryOrgId is null/undefined", () => {
      mockOrgState.primaryOrgId = null;

      renderHook(() => useLoadRoomsForPrimaryOrg());

      expect(loadRoomsForOrgPrimaryOrg).not.toHaveBeenCalled();
    });

    it("should re-trigger service call when primaryOrgId changes", () => {
      mockOrgState.primaryOrgId = "org-1";
      const { rerender } = renderHook(() => useLoadRoomsForPrimaryOrg());

      expect(loadRoomsForOrgPrimaryOrg).toHaveBeenCalledTimes(1);

      // Change Org ID
      mockOrgState.primaryOrgId = "org-2";
      rerender();

      expect(loadRoomsForOrgPrimaryOrg).toHaveBeenCalledTimes(2);
    });
  });

  // --- Section 2: useRoomsForPrimaryOrg ---

  describe("useRoomsForPrimaryOrg", () => {
    const mockRooms = {
      "room-1": { id: "room-1", name: "Room A" },
      "room-2": { id: "room-2", name: "Room B" },
    };

    it("should return an empty array if primaryOrgId is missing", () => {
      mockOrgState.primaryOrgId = null;
      mockRoomState.roomsById = mockRooms;
      mockRoomState.roomIdsByOrgId = { "org-1": ["room-1"] };

      const { result } = renderHook(() => useRoomsForPrimaryOrg());

      expect(result.current).toEqual([]);
    });

    it("should return an empty array if no rooms exist for the organization", () => {
      mockOrgState.primaryOrgId = "org-1";
      mockRoomState.roomsById = mockRooms;
      mockRoomState.roomIdsByOrgId = {}; // No entry for org-1

      const { result } = renderHook(() => useRoomsForPrimaryOrg());

      expect(result.current).toEqual([]);
    });

    it("should return mapped room objects for the organization", () => {
      mockOrgState.primaryOrgId = "org-1";
      mockRoomState.roomsById = mockRooms;
      mockRoomState.roomIdsByOrgId = { "org-1": ["room-1", "room-2"] };

      const { result } = renderHook(() => useRoomsForPrimaryOrg());

      expect(result.current).toHaveLength(2);
      expect(result.current).toEqual([
        { id: "room-1", name: "Room A" },
        { id: "room-2", name: "Room B" },
      ]);
    });

    it("should filter out undefined/missing rooms (robustness check)", () => {
      mockOrgState.primaryOrgId = "org-1";
      mockRoomState.roomsById = mockRooms;
      // 'room-99' exists in ID list but not in roomsById map
      mockRoomState.roomIdsByOrgId = { "org-1": ["room-1", "room-99"] };

      const { result } = renderHook(() => useRoomsForPrimaryOrg());

      // Should return only the valid room
      expect(result.current).toHaveLength(1);
      expect(result.current[0]).toEqual({ id: "room-1", name: "Room A" });
    });
  });
});