import { create } from "zustand";
import { Team } from "../types/team";

type TeamStatus = "idle" | "loading" | "loaded" | "error";

type TeamState = {
  teamsById: Record<string, Team>;
  teamIdsByOrgId: Record<string, string[]>;

  status: TeamStatus;
  error: string | null;
  lastFetchedAt: string | null;

  setTeams: (teams: Team[]) => void;
  addTeam: (team: Team) => void;
  updateTeam: (team: Team) => void;
  removeTeam: (id: string) => void;
  getTeamsByOrgId: (orgId: string) => Team[];
  clearTeams: () => void;
  startLoading: () => void;
  endLoading: () => void;
  setError: (message: string) => void;
};

export const useTeamStore = create<TeamState>()((set, get) => ({
  teamsById: {},
  teamIdsByOrgId: {},
  status: "idle",
  error: null,
  lastFetchedAt: null,

  setTeams: (teams) =>
    set(() => {
      const teamsById: Record<string, Team> = {};
      const teamIdsByOrgId: Record<string, string[]> = {};
      for (const t of teams) {
        const id = t._id;
        const orgId = t.organisationId;
        teamsById[id] = { ...t, _id: id };
        if (!teamIdsByOrgId[orgId]) {
          teamIdsByOrgId[orgId] = [];
        }
        teamIdsByOrgId[orgId].push(id);
      }
      return { teamsById, teamIdsByOrgId, status: "loaded" };
    }),

  addTeam: (team) =>
    set((state) => {
      const id = team._id;
      const orgId = team.organisationId;
      const teamsById = {
        ...state.teamsById,
        [id]: { ...team, _id: id },
      };
      const existingIds = state.teamIdsByOrgId[orgId] ?? [];
      const alreadyExists = existingIds.includes(id);
      const teamIdsByOrgId = {
        ...state.teamIdsByOrgId,
        [orgId]: alreadyExists ? existingIds : [...existingIds, id],
      };
      return { teamsById, teamIdsByOrgId, status: "loaded" };
    }),

  updateTeam: (updated) =>
    set((state) => {
      const id = updated._id;
      if (!id || !state.teamsById[id]) {
        console.warn("updateTeam: team not found:", updated);
        return state;
      }
      return {
        teamsById: {
          ...state.teamsById,
          [id]: {
            ...state.teamsById[id],
            ...updated,
          },
        },
        status: "loaded",
      };
    }),

  getTeamsByOrgId: (orgId) => {
    const { teamsById, teamIdsByOrgId } = get();
    const ids = teamIdsByOrgId[orgId] ?? [];
    return ids.map((id) => teamsById[id]).filter((t): t is Team => t != null);
  },

  removeTeam: (id: string) =>
    set((state) => {
      const { [id]: _, ...restTeamsById } = state.teamsById;
      const teamIdsByOrgId: Record<string, string[]> = {};
      for (const [orgId, ids] of Object.entries(state.teamIdsByOrgId)) {
        teamIdsByOrgId[orgId] = ids.filter((teamId) => teamId !== id);
      }
      return {
        teamsById: restTeamsById,
        teamIdsByOrgId,
      };
    }),

  clearTeams: () =>
    set(() => ({
      teamsById: {},
      teamIdsByOrgId: {},
      status: "idle",
      error: null
    })),

  startLoading: () =>
    set(() => ({
      status: "loading",
      error: null,
    })),

  endLoading: () =>
    set(() => ({
      status: "loaded",
      error: null,
    })),

  setError: (message: string) =>
    set(() => ({
      status: "error",
      error: message,
    })),
}));
