import { useTeamStore } from "../../stores/teamStore";
import { Team } from "../../types/team";

// --- Mock Data ---
// We cast to unknown first to bypass strict type checking for the test mock
const mockTeam1: Team = {
  _id: "team-1",
  name: "Frontend Team",
  organisationId: "org-A",
} as unknown as Team;

const mockTeam2: Team = {
  _id: "team-2",
  name: "Backend Team",
  organisationId: "org-A",
} as unknown as Team;

const mockTeam3: Team = {
  _id: "team-3",
  name: "Design Team",
  organisationId: "org-B",
} as unknown as Team;

describe("Team Store", () => {
  // Reset store before each test
  beforeEach(() => {
    useTeamStore.setState({
      teamsById: {},
      teamIdsByOrgId: {},
      status: "idle",
      error: null,
      lastFetchedAt: null,
    });
    jest.clearAllMocks();
  });

  // --- Section 1: Initialization & Status Management ---
  describe("Initialization & Status", () => {
    it("initializes with default empty state", () => {
      const state = useTeamStore.getState();
      expect(state.teamsById).toEqual({});
      expect(state.teamIdsByOrgId).toEqual({});
      expect(state.status).toBe("idle");
    });

    it("manages loading state", () => {
      const store = useTeamStore.getState();
      store.startLoading();
      expect(useTeamStore.getState().status).toBe("loading");
      expect(useTeamStore.getState().error).toBeNull();

      store.endLoading();
      expect(useTeamStore.getState().status).toBe("loaded");
    });

    it("sets error state", () => {
      const store = useTeamStore.getState();
      store.setError("Failed to fetch teams");
      expect(useTeamStore.getState().status).toBe("error");
      expect(useTeamStore.getState().error).toBe("Failed to fetch teams");
    });

    it("clears the store completely", () => {
      const store = useTeamStore.getState();
      store.setTeams([mockTeam1]);

      store.clearTeams();

      const state = useTeamStore.getState();
      expect(state.teamsById).toEqual({});
      expect(state.teamIdsByOrgId).toEqual({});
      expect(state.status).toBe("idle");
    });
  });

  // --- Section 2: Bulk Operations (Set & Get) ---
  describe("Bulk Operations", () => {
    it("sets all teams globally and indexes them correctly", () => {
      const store = useTeamStore.getState();
      store.setTeams([mockTeam1, mockTeam2, mockTeam3]);

      const state = useTeamStore.getState();
      expect(state.status).toBe("loaded");
      expect(state.teamsById["team-1"]).toEqual(mockTeam1);
      expect(state.teamsById["team-3"]).toEqual(mockTeam3);

      // Verify indexing
      expect(state.teamIdsByOrgId["org-A"]).toHaveLength(2);
      expect(state.teamIdsByOrgId["org-A"]).toContain("team-1");
      expect(state.teamIdsByOrgId["org-A"]).toContain("team-2");
      expect(state.teamIdsByOrgId["org-B"]).toHaveLength(1);
    });

    it("sets teams for a specific organization specifically", () => {
      // Setup initial state with Org A and Org B
      useTeamStore.getState().setTeams([mockTeam1, mockTeam3]);

      // Update ONLY Org A (replace team-1 with team-2)
      useTeamStore.getState().setTeamsForOrg("org-A", [mockTeam2]);

      const state = useTeamStore.getState();

      // Org A should now only have team-2
      expect(state.teamIdsByOrgId["org-A"]).toEqual(["team-2"]);
      expect(state.teamsById["team-1"]).toBeUndefined(); // Should be removed
      expect(state.teamsById["team-2"]).toBeDefined();   // Should be added

      // Org B should remain untouched
      expect(state.teamIdsByOrgId["org-B"]).toEqual(["team-3"]);
      expect(state.teamsById["team-3"]).toBeDefined();
    });

    it("retrieves teams by Org ID", () => {
      useTeamStore.getState().setTeams([mockTeam1, mockTeam2, mockTeam3]);

      const orgATeams = useTeamStore.getState().getTeamsByOrgId("org-A");
      expect(orgATeams).toHaveLength(2);
      expect(orgATeams.find(t => t._id === "team-1")).toBeDefined();

      // Non-existent Org
      expect(useTeamStore.getState().getTeamsByOrgId("org-C")).toEqual([]);
    });
  });

  // --- Section 3: CRUD Operations ---
  describe("CRUD Operations", () => {
    it("adds a new team", () => {
      const store = useTeamStore.getState();
      store.addTeam(mockTeam1);

      const state = useTeamStore.getState();
      expect(state.teamsById["team-1"]).toBeDefined();
      expect(state.teamIdsByOrgId["org-A"]).toContain("team-1");
    });

    it("updates an existing team via addTeam (Upsert) without duplicating index", () => {
      const store = useTeamStore.getState();
      store.addTeam(mockTeam1);

      // Add same team again
      store.addTeam(mockTeam1);

      const state = useTeamStore.getState();
      // ID list should remain length 1
      expect(state.teamIdsByOrgId["org-A"]).toHaveLength(1);
    });

    it("updates an existing team using updateTeam", () => {
      const store = useTeamStore.getState();
      store.addTeam(mockTeam1);

      const updated = { ...mockTeam1, name: "Updated Frontend" };
      store.updateTeam(updated);

      const state = useTeamStore.getState();
      expect(state.teamsById["team-1"].name).toBe("Updated Frontend");
    });

    it("warns and ignores update if team ID is missing or not found", () => {
      const consoleSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
      const store = useTeamStore.getState();

      // Update non-existent team
      store.updateTeam(mockTeam1);

      const state = useTeamStore.getState();
      expect(Object.keys(state.teamsById)).toHaveLength(0);

      expect(consoleSpy).toHaveBeenCalledWith(
        "updateTeam: team not found:",
        mockTeam1
      );
      consoleSpy.mockRestore();
    });
  });

  // --- Section 4: Removal & Cleanup ---
  describe("Removal & Cleanup", () => {
    it("removes a team by ID", () => {
      useTeamStore.getState().setTeams([mockTeam1, mockTeam2]);

      useTeamStore.getState().removeTeam("team-1");

      const state = useTeamStore.getState();
      expect(state.teamsById["team-1"]).toBeUndefined();
      expect(state.teamsById["team-2"]).toBeDefined();
      expect(state.teamIdsByOrgId["org-A"]).toEqual(["team-2"]);
    });

    it("does nothing when removing a non-existent ID", () => {
      useTeamStore.getState().setTeams([mockTeam1]);
      const initialSnapshot = JSON.stringify(useTeamStore.getState());

      useTeamStore.getState().removeTeam("fake-id");

      const finalSnapshot = JSON.stringify(useTeamStore.getState());
      expect(finalSnapshot).toEqual(initialSnapshot);
    });

    it("clears all teams for a specific organization", () => {
      useTeamStore.getState().setTeams([mockTeam1, mockTeam3]);

      useTeamStore.getState().clearTeamsForOrg("org-A");

      const state = useTeamStore.getState();
      // Org A data gone
      expect(state.teamIdsByOrgId["org-A"]).toBeUndefined();
      expect(state.teamsById["team-1"]).toBeUndefined();

      // Org B data remains
      expect(state.teamIdsByOrgId["org-B"]).toBeDefined();
      expect(state.teamsById["team-3"]).toBeDefined();
    });

    it("handles clearing an organization that has no data safely", () => {
      useTeamStore.getState().setTeams([mockTeam1]);

      // Clear empty org
      useTeamStore.getState().clearTeamsForOrg("org-Empty");

      const state = useTeamStore.getState();
      expect(state.teamIdsByOrgId["org-Empty"]).toBeUndefined();
      expect(state.teamsById["team-1"]).toBeDefined();
    });
  });
});