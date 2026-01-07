import { renderHook } from "@testing-library/react";
import { useLoadTeam, useTeamForPrimaryOrg } from "../../hooks/useTeam";
import { useOrgStore } from "../../stores/orgStore";
import { useTeamStore } from "../../stores/teamStore";
import { loadTeam } from "../../services/teamService";

// --- Mocks ---

jest.mock("../../stores/orgStore");
jest.mock("../../stores/teamStore");
jest.mock("../../services/teamService", () => ({
  loadTeam: jest.fn(),
}));

describe("useTeam Hooks", () => {
  let mockOrgState: any;
  let mockTeamState: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Default Mock State
    mockOrgState = { primaryOrgId: null };
    mockTeamState = {
      teamsById: {},
      teamIdsByOrgId: {},
    };

    // Setup Store Mocks (Zustand selector pattern)
    (useOrgStore as unknown as jest.Mock).mockImplementation((selector) =>
      selector(mockOrgState)
    );
    (useTeamStore as unknown as jest.Mock).mockImplementation((selector) =>
      selector(mockTeamState)
    );
  });

  // --- Section 1: useLoadTeam ---

  describe("useLoadTeam", () => {
    it("should trigger loadTeam service when primaryOrgId is set", () => {
      mockOrgState.primaryOrgId = "org-1";

      renderHook(() => useLoadTeam());

      expect(loadTeam).toHaveBeenCalledWith({ force: true });
      expect(loadTeam).toHaveBeenCalledTimes(1);
    });

    it("should NOT trigger loadTeam service when primaryOrgId is missing", () => {
      mockOrgState.primaryOrgId = null;

      renderHook(() => useLoadTeam());

      expect(loadTeam).not.toHaveBeenCalled();
    });

    it("should re-trigger loadTeam when primaryOrgId changes", () => {
      mockOrgState.primaryOrgId = "org-1";
      const { rerender } = renderHook(() => useLoadTeam());

      expect(loadTeam).toHaveBeenCalledTimes(1);

      // Change Org ID
      mockOrgState.primaryOrgId = "org-2";
      rerender();

      expect(loadTeam).toHaveBeenCalledTimes(2);
    });
  });

  // --- Section 2: useTeamForPrimaryOrg ---

  describe("useTeamForPrimaryOrg", () => {
    const mockTeams = {
      "team-1": { id: "team-1", name: "Alpha Squad" },
      "team-2": { id: "team-2", name: "Beta Squad" },
    };

    it("should return an empty array if primaryOrgId is missing", () => {
      mockOrgState.primaryOrgId = null;
      mockTeamState.teamsById = mockTeams;
      mockTeamState.teamIdsByOrgId = { "org-1": ["team-1"] };

      const { result } = renderHook(() => useTeamForPrimaryOrg());

      expect(result.current).toEqual([]);
    });

    it("should return an empty array if no team members exist for the organization", () => {
      mockOrgState.primaryOrgId = "org-1";
      mockTeamState.teamsById = mockTeams;
      mockTeamState.teamIdsByOrgId = {}; // No entry for org-1

      const { result } = renderHook(() => useTeamForPrimaryOrg());

      expect(result.current).toEqual([]);
    });

    it("should return mapped team objects for the organization", () => {
      mockOrgState.primaryOrgId = "org-1";
      mockTeamState.teamsById = mockTeams;
      mockTeamState.teamIdsByOrgId = { "org-1": ["team-1", "team-2"] };

      const { result } = renderHook(() => useTeamForPrimaryOrg());

      expect(result.current).toHaveLength(2);
      expect(result.current).toEqual([
        { id: "team-1", name: "Alpha Squad" },
        { id: "team-2", name: "Beta Squad" },
      ]);
    });

    it("should filter out undefined team members (broken references)", () => {
      mockOrgState.primaryOrgId = "org-1";
      mockTeamState.teamsById = mockTeams;
      // 'team-99' exists in ID list but not in teamsById map
      mockTeamState.teamIdsByOrgId = { "org-1": ["team-1", "team-99"] };

      const { result } = renderHook(() => useTeamForPrimaryOrg());

      // Should return only the valid team member
      expect(result.current).toHaveLength(1);
      expect(result.current[0]).toEqual({ id: "team-1", name: "Alpha Squad" });
    });
  });
});