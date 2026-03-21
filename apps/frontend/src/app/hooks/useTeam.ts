import { useEffect, useMemo } from 'react';
import { useOrgStore } from '@/app/stores/orgStore';
import { loadTeam } from '@/app/features/organization/services/teamService';
import { Team } from '@/app/features/organization/types/team';
import { useTeamStore } from '@/app/stores/teamStore';

export const useLoadTeam = () => {
  const primaryOrgId = useOrgStore((s) => s.primaryOrgId);
  const teamIdsByOrgId = useTeamStore((s) => s.teamIdsByOrgId);

  useEffect(() => {
    if (!primaryOrgId) return;
    if (useTeamStore.getState().status === 'loading') return;
    if (Object.hasOwn(teamIdsByOrgId, primaryOrgId)) return;
    void loadTeam();
  }, [primaryOrgId, teamIdsByOrgId]);
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
