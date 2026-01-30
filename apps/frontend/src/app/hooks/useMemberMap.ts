import { useMemo } from "react";
import { useTeamForPrimaryOrg } from "@/app/hooks/useTeam";
import { Team } from "@/app/types/team";

export const useMemberMap = () => {
  const teams = useTeamForPrimaryOrg();

  const memberMap = useMemo(() => {
    const map = new Map<string, string>();
    teams?.forEach((member: Team) => {
      const name = member.name || "-";
      if (member.practionerId) {
        map.set(member.practionerId, name);
      }
      if (member._id) {
        map.set(member._id, name);
      }
    });
    return map;
  }, [teams]);

  const resolveMemberName = (id?: string) =>
    id ? (memberMap.get(id) ?? "-") : "-";

  return { memberMap, resolveMemberName };
};
