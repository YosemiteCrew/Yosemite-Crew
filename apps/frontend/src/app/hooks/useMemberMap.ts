import { useMemo } from 'react';
import { useTeamForPrimaryOrg } from '@/app/hooks/useTeam';
import { Team } from '@/app/features/organization/types/team';
import { useParentStore } from '@/app/stores/parentStore';
import { useAuthStore } from '@/app/stores/authStore';

const toParentDisplayName = (parent?: {
  firstName?: string;
  lastName?: string;
  email?: string;
}) => {
  if (!parent) return '-';
  const fullName = `${parent.firstName ?? ''} ${parent.lastName ?? ''}`.trim();
  if (fullName) return fullName;
  if (parent.email) return parent.email;
  return '-';
};

export const useMemberMap = () => {
  const teams = useTeamForPrimaryOrg();
  const parentsById = useParentStore((s) => s.parentsById);
  const currentUserId = useAuthStore((s) => s.attributes?.sub || '');
  const currentUserName = useAuthStore((s) => {
    const first = s.attributes?.given_name || '';
    const last = s.attributes?.family_name || '';
    const full = `${first} ${last}`.trim();
    return full || s.attributes?.email || '';
  });

  const memberMap = useMemo(() => {
    const map = new Map<string, string>();
    teams?.forEach((member: Team) => {
      const name = member.name || '-';
      if (member.practionerId) {
        map.set(member.practionerId, name);
      }
      if (member._id) {
        map.set(member._id, name);
      }
    });
    Object.entries(parentsById).forEach(([id, parent]) => {
      map.set(id, toParentDisplayName(parent));
    });
    if (currentUserId && currentUserName) {
      map.set(currentUserId, currentUserName);
    }
    return map;
  }, [teams, parentsById, currentUserId, currentUserName]);

  const resolveMemberName = (id?: string) => (id ? (memberMap.get(id) ?? '-') : '-');

  return { memberMap, resolveMemberName };
};
