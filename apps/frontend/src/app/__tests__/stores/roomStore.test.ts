import { useOrganisationRoomStore } from "../../stores/roomStore";
import { OrganisationRoom } from "@yosemite-crew/types";

// --- Mock Data ---
// We cast to unknown first to avoid strict type adherence for fields not relevant to the store logic
const mockRoom1: OrganisationRoom = {
  id: "room-1",
  organisationId: "org-A",
  name: "Surgery Room 1",
  capacity: 4,
} as unknown as OrganisationRoom;

const mockRoom2: OrganisationRoom = {
  id: "room-2",
  organisationId: "org-A",
  name: "Consultation A",
  capacity: 2,
} as unknown as OrganisationRoom;

const mockRoom3: OrganisationRoom = {
  id: "room-3",
  organisationId: "org-B",
  name: "X-Ray Room",
  capacity: 1,
} as unknown as OrganisationRoom;

const mockRoomNoId: OrganisationRoom = {
  organisationId: "org-A",
  name: "Invalid Room",
} as unknown as OrganisationRoom;

const mockRoomNoOrg: OrganisationRoom = {
  id: "room-bad",
  name: "Orphan Room",
} as unknown as OrganisationRoom;

describe("Organisation Room Store", () => {
  // Reset store before each test
  beforeEach(() => {
    useOrganisationRoomStore.setState({
      roomsById: {},
      roomIdsByOrgId: {},
      status: "idle",
      error: null,
      lastFetchedAt: null,
    });
    jest.clearAllMocks();
  });

  // --- Section 1: Initialization & Status Management ---
  describe("Initialization & Status", () => {
    it("initializes with default empty state", () => {
      const state = useOrganisationRoomStore.getState();
      expect(state.roomsById).toEqual({});
      expect(state.roomIdsByOrgId).toEqual({});
      expect(state.status).toBe("idle");
      expect(state.error).toBeNull();
    });

    it("manages loading state", () => {
      const store = useOrganisationRoomStore.getState();
      store.startLoading();
      expect(useOrganisationRoomStore.getState().status).toBe("loading");
      expect(useOrganisationRoomStore.getState().error).toBeNull();

      store.endLoading();
      expect(useOrganisationRoomStore.getState().status).toBe("loaded");
    });

    it("sets error state", () => {
      const store = useOrganisationRoomStore.getState();
      store.setError("Failed to fetch rooms");
      expect(useOrganisationRoomStore.getState().status).toBe("error");
      expect(useOrganisationRoomStore.getState().error).toBe("Failed to fetch rooms");
    });

    it("clears the store completely", () => {
      const store = useOrganisationRoomStore.getState();
      store.setRooms([mockRoom1]);

      store.clearRooms();

      const state = useOrganisationRoomStore.getState();
      expect(state.roomsById).toEqual({});
      expect(state.roomIdsByOrgId).toEqual({});
      expect(state.status).toBe("idle");
      expect(state.lastFetchedAt).toBeNull();
    });
  });

  // --- Section 2: Bulk Set & Getters ---
  describe("Bulk Operations", () => {
    it("sets all rooms globally and indexes them correctly", () => {
      const store = useOrganisationRoomStore.getState();
      store.setRooms([mockRoom1, mockRoom2, mockRoom3]);

      const state = useOrganisationRoomStore.getState();
      expect(state.status).toBe("loaded");
      expect(state.roomsById["room-1"]).toEqual(mockRoom1);
      expect(state.roomsById["room-3"]).toEqual(mockRoom3);

      // Verify indexing
      expect(state.roomIdsByOrgId["org-A"]).toHaveLength(2);
      expect(state.roomIdsByOrgId["org-A"]).toContain("room-1");
      expect(state.roomIdsByOrgId["org-A"]).toContain("room-2");
      expect(state.roomIdsByOrgId["org-B"]).toHaveLength(1);
    });

    it("sets rooms for a specific organization specifically", () => {
      // Setup initial state with Org A and Org B
      useOrganisationRoomStore.getState().setRooms([mockRoom1, mockRoom3]);

      // Update ONLY Org A (replace room-1 with room-2)
      useOrganisationRoomStore.getState().setRoomsForOrg("org-A", [mockRoom2]);

      const state = useOrganisationRoomStore.getState();

      // Org A should now only have room-2
      expect(state.roomIdsByOrgId["org-A"]).toEqual(["room-2"]);
      expect(state.roomsById["room-1"]).toBeUndefined(); // Should be removed
      expect(state.roomsById["room-2"]).toBeDefined();   // Should be added

      // Org B should remain untouched
      expect(state.roomIdsByOrgId["org-B"]).toEqual(["room-3"]);
      expect(state.roomsById["room-3"]).toBeDefined();
    });

    it("retrieves rooms by Org ID", () => {
      useOrganisationRoomStore.getState().setRooms([mockRoom1, mockRoom2, mockRoom3]);

      const orgARooms = useOrganisationRoomStore.getState().getRoomsByOrgId("org-A");
      expect(orgARooms).toHaveLength(2);
      expect(orgARooms.find(r => r.id === "room-1")).toBeDefined();

      // Non-existent Org
      expect(useOrganisationRoomStore.getState().getRoomsByOrgId("org-C")).toEqual([]);
    });
  });

  // --- Section 3: Upsert Operations ---
  describe("Upsert Operations", () => {
    it("adds a new room if it does not exist", () => {
      useOrganisationRoomStore.getState().setRooms([mockRoom1]);

      // Upsert new room-2
      useOrganisationRoomStore.getState().upsertRoom(mockRoom2);

      const state = useOrganisationRoomStore.getState();
      expect(state.roomsById["room-2"]).toBeDefined();
      expect(state.roomIdsByOrgId["org-A"]).toContain("room-2");
      expect(state.roomIdsByOrgId["org-A"]).toHaveLength(2);
    });

    it("updates an existing room", () => {
      useOrganisationRoomStore.getState().setRooms([mockRoom1]);

      const updatedRoom1 = { ...mockRoom1, name: "Renovated Surgery" } as unknown as OrganisationRoom;
      useOrganisationRoomStore.getState().upsertRoom(updatedRoom1);

      const state = useOrganisationRoomStore.getState();
      expect(state.roomsById["room-1"].name).toBe("Renovated Surgery");
      // Should not duplicate the ID in the list
      expect(state.roomIdsByOrgId["org-A"]).toHaveLength(1);
    });

    it("handles upsert gracefully when room ID is missing", () => {
      const consoleSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

      useOrganisationRoomStore.getState().upsertRoom(mockRoomNoId);

      const state = useOrganisationRoomStore.getState();
      expect(Object.keys(state.roomsById)).toHaveLength(0);

      expect(consoleSpy).toHaveBeenCalledWith(
        "upsertRoom: missing id:",
        mockRoomNoId
      );

      consoleSpy.mockRestore();
    });

    it("handles upsert gracefully when organisation ID is missing", () => {
      const consoleSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

      useOrganisationRoomStore.getState().upsertRoom(mockRoomNoOrg);

      const state = useOrganisationRoomStore.getState();
      expect(state.roomsById["room-bad"]).toBeUndefined();

      expect(consoleSpy).toHaveBeenCalledWith(
        "upsertRoom: missing organisationId:",
        mockRoomNoOrg
      );

      consoleSpy.mockRestore();
    });

    it("handles upsert for a new organization not yet in store", () => {
      // Upsert room-3 (Org B) into empty store
      useOrganisationRoomStore.getState().upsertRoom(mockRoom3);

      const state = useOrganisationRoomStore.getState();
      expect(state.roomIdsByOrgId["org-B"]).toEqual(["room-3"]);
    });
  });

  // --- Section 4: Removal & Cleanup ---
  describe("Removal & Cleanup", () => {
    it("removes a room by ID", () => {
      useOrganisationRoomStore.getState().setRooms([mockRoom1, mockRoom2]);

      useOrganisationRoomStore.getState().removeRoom("room-1");

      const state = useOrganisationRoomStore.getState();
      expect(state.roomsById["room-1"]).toBeUndefined();
      expect(state.roomsById["room-2"]).toBeDefined();
      expect(state.roomIdsByOrgId["org-A"]).toEqual(["room-2"]);
    });

    it("does nothing when removing a non-existent ID", () => {
      useOrganisationRoomStore.getState().setRooms([mockRoom1]);
      const initialSnapshot = JSON.stringify(useOrganisationRoomStore.getState());

      useOrganisationRoomStore.getState().removeRoom("fake-id");

      const finalSnapshot = JSON.stringify(useOrganisationRoomStore.getState());
      // The implementation iterates over org keys, filter returns same array if ID not found
      // State structure remains identical
      expect(finalSnapshot).toEqual(initialSnapshot);
    });

    it("clears all rooms for a specific organization", () => {
      useOrganisationRoomStore.getState().setRooms([mockRoom1, mockRoom3]);

      useOrganisationRoomStore.getState().clearRoomsForOrg("org-A");

      const state = useOrganisationRoomStore.getState();
      // Org A data gone
      expect(state.roomIdsByOrgId["org-A"]).toBeUndefined();
      expect(state.roomsById["room-1"]).toBeUndefined();

      // Org B data remains
      expect(state.roomIdsByOrgId["org-B"]).toBeDefined();
      expect(state.roomsById["room-3"]).toBeDefined();
    });

    it("handles clearing an organization that has no data safely", () => {
      useOrganisationRoomStore.getState().setRooms([mockRoom1]);

      // Clear empty org
      useOrganisationRoomStore.getState().clearRoomsForOrg("org-Empty");

      const state = useOrganisationRoomStore.getState();
      expect(state.roomIdsByOrgId["org-Empty"]).toBeUndefined();
      expect(state.roomsById["room-1"]).toBeDefined();
    });
  });
});