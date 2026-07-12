import { useCallback, useMemo } from 'react';
import { Task } from '@/app/features/tasks/types/task';
import { useTeamForPrimaryOrg } from '@/app/hooks/useTeam';
import { useMemberMap } from '@/app/hooks/useMemberMap';
import {
  findTeamMemberByIdentity,
  getTeamMemberIdentityIds,
} from '@/app/features/appointments/components/Calendar/appointmentDragAvailabilityUtils';
import {
  normalizeCalendarId,
  shouldAllowTaskAvailabilityBypass,
  WEEKDAY_ORDER,
} from '@/app/features/appointments/components/Calendar/taskCalendarAvailabilityUtils';

export const useTaskCalendarIdentity = (
  teams: ReturnType<typeof useTeamForPrimaryOrg>,
  authUserId: string
) => {
  const { resolveMemberName } = useMemberMap();
  const normalizeId = useCallback((value?: string) => normalizeCalendarId(value), []);

  const shiftDayKey = useCallback((dayKey: string, offset: number): string => {
    const index = WEEKDAY_ORDER.indexOf(String(dayKey || '').toUpperCase());
    if (index < 0) return String(dayKey || '').toUpperCase();
    const shifted = (index + offset) % WEEKDAY_ORDER.length;
    const safe = shifted < 0 ? shifted + WEEKDAY_ORDER.length : shifted;
    return WEEKDAY_ORDER[safe];
  }, []);

  const resolveAssigneeId = useCallback(
    (candidateId?: string) => {
      if (!candidateId) return '';
      const member = findTeamMemberByIdentity(teams, candidateId, normalizeId);
      return (
        member?.practionerId ||
        (member as any)?.userId ||
        (member as any)?.id ||
        (member as any)?.userOrganisation?.userId ||
        member?._id ||
        candidateId
      );
    },
    [normalizeId, teams]
  );

  const canEditTask = useCallback(
    (task: Task) => {
      const normalizedCurrentUser = normalizeId(authUserId);
      const isAssignedByCurrentUser =
        !!normalizedCurrentUser && normalizeId(task.assignedBy) === normalizedCurrentUser;
      return task.status !== 'COMPLETED' && task.status !== 'CANCELLED' && isAssignedByCurrentUser;
    },
    [authUserId, normalizeId]
  );

  const teamNameById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const member of teams) {
      const name = member.name || (member as any).displayName || '-';
      for (const normalized of getTeamMemberIdentityIds(member, normalizeId)) {
        map[normalized] = name;
      }
    }
    return map;
  }, [normalizeId, teams]);

  const resolveDisplayName = useCallback(
    (memberId?: string) => {
      const raw = String(memberId ?? '').trim();
      if (!raw) return '-';
      const resolved = resolveMemberName(raw);
      if (resolved && resolved !== '-') return resolved;
      return teamNameById[normalizeId(raw)] || raw;
    },
    [normalizeId, resolveMemberName, teamNameById]
  );

  const shouldEnforceAvailability = useCallback(
    (task: Task, targetAssigneeId?: string) =>
      shouldAllowTaskAvailabilityBypass(
        authUserId,
        task,
        normalizeId,
        resolveAssigneeId,
        targetAssigneeId
      ),
    [authUserId, normalizeId, resolveAssigneeId]
  );

  return {
    canEditTask,
    resolveAssigneeId,
    resolveDisplayName,
    shiftDayKey,
    shouldEnforceAvailability,
  };
};
