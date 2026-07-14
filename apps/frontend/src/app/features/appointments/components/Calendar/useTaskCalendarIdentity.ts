import { useCallback, useMemo } from 'react';
import { Task } from '@/app/features/tasks/types/task';
import { useTeamForPrimaryOrg } from '@/app/hooks/useTeam';
import { useMemberMap } from '@/app/hooks/useMemberMap';
import {
  buildTeamMemberNameMap,
  resolveMemberDisplayName,
  resolveTeamMemberPrimaryId,
} from '@/app/features/appointments/components/Calendar/appointmentDragAvailabilityUtils';
import {
  canCurrentUserEditTask,
  normalizeCalendarId,
  shiftWeekdayKey,
  shouldAllowTaskAvailabilityBypass,
} from '@/app/features/appointments/components/Calendar/taskCalendarAvailabilityUtils';

export const useTaskCalendarIdentity = (
  teams: ReturnType<typeof useTeamForPrimaryOrg>,
  authUserId: string
) => {
  const { resolveMemberName } = useMemberMap();
  const normalizeId = useCallback((value?: string) => normalizeCalendarId(value), []);

  const shiftDayKey = useCallback(shiftWeekdayKey, []);

  const resolveAssigneeId = useCallback(
    (candidateId?: string) => resolveTeamMemberPrimaryId(teams, candidateId, normalizeId),
    [normalizeId, teams]
  );

  const canEditTask = useCallback(
    (task: Task) => canCurrentUserEditTask(authUserId, task, normalizeId),
    [authUserId, normalizeId]
  );

  const teamNameById = useMemo(
    () => buildTeamMemberNameMap(teams, normalizeId),
    [normalizeId, teams]
  );

  const resolveDisplayName = useCallback(
    (memberId?: string) =>
      resolveMemberDisplayName(memberId, normalizeId, resolveMemberName, teamNameById),
    [normalizeId, resolveMemberName, teamNameById]
  );

  const shouldEnforceAvailability = useCallback(
    (task: Task, _targetAssigneeId?: string) =>
      shouldAllowTaskAvailabilityBypass(authUserId, task, normalizeId),
    [authUserId, normalizeId]
  );

  return {
    canEditTask,
    resolveAssigneeId,
    resolveDisplayName,
    shiftDayKey,
    shouldEnforceAvailability,
  };
};
