import { act } from "@testing-library/react";
import { useTeamStore } from "@/app/stores/teamStore";
import { Team } from "@/app/types/team";

// --- Mock Data ---

const mockTeam1: Team = {
  _id: "team-1",
  organisationId: "org-A",
  name: "Development",
} as Team;

const mockTeam2: Team = {
  _id: "team-2",
  organisationId: "org-A",
  name: "Design",
} as Team;

const mockTeam3: Team = {
  _id: "team-3",
  organisationId: "org-B",
  name: "Marketing",
} as Team;

describe("useTeamStore", () => {
  // We handle the console spy inside beforeEach/afterEach to strictly override
  // any global configuration that might cause test failures on console.warn.

  beforeEach(() => {
    // Reset store state before each test
    act(() => {
      useTeamStore.getState().clearTeams();
    });
    jest.clearAllMocks();

    // Suppress console.warn to allow testing specific warning scenarios
    // without triggering global failure thresholds.
    jest.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    // Restore console.warn to its original (or globally mocked) state
    (console.warn as jest.Mock).mockRestore();
  });

  // --- 1. Initialization & Bulk Set ---

  describe("Initialization & setTeams", () => {
    it("initializes with default empty state", () => {
      const state = useTeamStore.getState();
      expect(state.teamsById).toEqual({});
      expect(state.teamIdsByOrgId).toEqual({});
      expect(state.status).toBe("idle");
      expect(state.error).toBeNull();
    });

    it("populates state correctly using setTeams", () => {
      act(() => {
        useTeamStore.getState().setTeams([mockTeam1, mockTeam2, mockTeam3]);
      });

      const state = useTeamStore.getState();

      // Check ById Lookup
      expect(state.teamsById["team-1"]).toEqual(mockTeam1);
      expect(state.teamsById["team-3"]).toEqual(mockTeam3);

      // Check ByOrgId Lookup
      expect(state.teamIdsByOrgId["org-A"]).toHaveLength(2);
      expect(state.teamIdsByOrgId["org-A"]).toContain("team-1");
      expect(state.teamIdsByOrgId["org-A"]).toContain("team-2");

      expect(state.teamIdsByOrgId["org-B"]).toHaveLength(1);
      expect(state.teamIdsByOrgId["org-B"]).toContain("team-3");

      expect(state.status).toBe("loaded");
    });
  });

  // --- 2. CRUD Operations ---

  describe("CRUD Actions", () => {
    it("adds a single team correctly", () => {
      act(() => {
        useTeamStore.getState().addTeam(mockTeam1);
      });

      const state = useTeamStore.getState();
      expect(state.teamsById["team-1"]).toEqual(mockTeam1);
      expect(state.teamIdsByOrgId["org-A"]).toEqual(["team-1"]);
    });

    it("prevents duplicate IDs in org list when adding existing team", () => {
      act(() => {
        useTeamStore.getState().addTeam(mockTeam1);
      });
      // Add same team again
      act(() => {
        useTeamStore.getState().addTeam(mockTeam1);
      });

      const state = useTeamStore.getState();
      // Should still be length 1
      expect(state.teamIdsByOrgId["org-A"]).toHaveLength(1);
      expect(state.teamIdsByOrgId["org-A"]).toEqual(["team-1"]);
    });

    it("updates an existing team", () => {
      act(() => {
        useTeamStore.getState().setTeams([mockTeam1]);
      });

      const updatedData = { ...mockTeam1, name: "Dev Updated" };

      act(() => {
        useTeamStore.getState().updateTeam(updatedData);
      });

      const state = useTeamStore.getState();
      expect(state.teamsById["team-1"].name).toBe("Dev Updated");
    });

    it("warns and ignores update if team does not exist", () => {
      const nonExistentTeam = { ...mockTeam1, _id: "ghost-team" };

      act(() => {
        useTeamStore.getState().updateTeam(nonExistentTeam);
      });

      expect(console.warn).toHaveBeenCalledWith(
        "updateTeam: team not found:",
        nonExistentTeam
      );

      const state = useTeamStore.getState();
      expect(state.teamsById["ghost-team"]).toBeUndefined();
    });

    it("removes a team from both lookups", () => {
      act(() => {
        useTeamStore.getState().setTeams([mockTeam1, mockTeam2]);
      });

      act(() => {
        useTeamStore.getState().removeTeam("team-1");
      });

      const state = useTeamStore.getState();
      expect(state.teamsById["team-1"]).toBeUndefined();
      expect(state.teamsById["team-2"]).toBeDefined(); // Should remain

      // Check Org Array
      expect(state.teamIdsByOrgId["org-A"]).not.toContain("team-1");
      expect(state.teamIdsByOrgId["org-A"]).toContain("team-2");
    });
  });

  // --- 3. Selectors ---

  describe("Selectors", () => {
    it("getTeamsByOrgId returns correct array of teams", () => {
      act(() => {
        useTeamStore.getState().setTeams([mockTeam1, mockTeam2, mockTeam3]);
      });

      const resultA = useTeamStore.getState().getTeamsByOrgId("org-A");
      expect(resultA).toHaveLength(2);
      expect(resultA).toEqual(
        expect.arrayContaining([
            expect.objectContaining({ _id: "team-1" }),
            expect.objectContaining({ _id: "team-2" })
        ])
      );

      const resultB = useTeamStore.getState().getTeamsByOrgId("org-B");
      expect(resultB).toHaveLength(1);
      expect(resultB[0]._id).toBe("team-3");
    });

    it("getTeamsByOrgId returns empty array for unknown org", () => {
      const result = useTeamStore.getState().getTeamsByOrgId("unknown-org");
      expect(result).toEqual([]);
    });

    it("getTeamsByOrgId filters out undefined teams if lookup is out of sync (safety check)", () => {
        // Manually corrupt state to simulate ID in array but missing in record
        useTeamStore.setState({
            teamsById: {},
            teamIdsByOrgId: { "org-A": ["team-missing"] }
        });

        const result = useTeamStore.getState().getTeamsByOrgId("org-A");
        expect(result).toEqual([]);
    });
  });

  // --- 4. Status & Utility Actions ---

  describe("Status & Utility Actions", () => {
    it("manages loading state correctly", () => {
      act(() => {
        useTeamStore.getState().startLoading();
      });
      expect(useTeamStore.getState().status).toBe("loading");
      expect(useTeamStore.getState().error).toBeNull();

      act(() => {
        useTeamStore.getState().endLoading();
      });
      expect(useTeamStore.getState().status).toBe("loaded");
      expect(useTeamStore.getState().error).toBeNull();
    });

    it("sets error state correctly", () => {
      act(() => {
        useTeamStore.getState().setError("Network Error");
      });
      expect(useTeamStore.getState().status).toBe("error");
      expect(useTeamStore.getState().error).toBe("Network Error");
    });

    it("clears teams and resets state", () => {
      act(() => {
        useTeamStore.getState().setTeams([mockTeam1]);
        useTeamStore.getState().startLoading();
      });

      act(() => {
        useTeamStore.getState().clearTeams();
      });

      const state = useTeamStore.getState();
      expect(state.teamsById).toEqual({});
      expect(state.teamIdsByOrgId).toEqual({});
      expect(state.status).toBe("idle");
      expect(state.error).toBeNull();
    });
  });
});