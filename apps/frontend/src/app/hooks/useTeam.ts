import { useEffect, useMemo } from "react";
import { useOrgStore } from "../stores/orgStore";
import { loadTeam } from "../services/teamService";
import { Team } from "../types/team";
import { useTeamStore } from "../stores/teamStore";

export const useLoadTeam = () => {
  const primaryOrgId = useOrgStore((s) => s.primaryOrgId);
  const teamStatus = useTeamStore((s) => s.status);

  useEffect(() => {
    if (!primaryOrgId) return;
    if (teamStatus === "idle") {
      void loadTeam();
    }
  }, [primaryOrgId]);
};

export const useTeamForPrimaryOrg = (): Team[] => {
  const primaryOrgId = useOrgStore((s) => s.primaryOrgId);
  const teamIdsByOrgId = useTeamStore((s) => s.teamIdsByOrgId);
  const teamsById = useTeamStore((s) => s.teamsById);

  return useMemo(() => {
    if (!primaryOrgId) return [];
    const ids = teamIdsByOrgId[primaryOrgId] ?? [];
    return ids.map((id) => teamsById[id]).filter(Boolean);
  }, [primaryOrgId, teamIdsByOrgId, teamsById]);
};
