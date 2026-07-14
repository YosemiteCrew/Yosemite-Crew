import { useCallback, useMemo } from 'react';
import { usePermissions } from '@/app/hooks/usePermissions';
import { useTeamForPrimaryOrg } from '@/app/hooks/useTeam';
import { Task } from '@/app/features/tasks/types/task';
import { PERMISSIONS } from '@/app/lib/permissions';
import { useAuthStore } from '@/app/stores/authStore';

export type TaskEditMode = 'NONE' | 'FULL' | 'DETAILS_ONLY' | 'STATUS_ONLY';

export const useTaskEditMode = (activeTask: Task) => {
  const teams = useTeamForPrimaryOrg();
  const { can } = usePermissions();
  const hasTaskEditPermission = can(PERMISSIONS.TASKS_EDIT_ANY) || can(PERMISSIONS.TASKS_EDIT_OWN);
  const authAttributes = useAuthStore((s) => s.attributes);
  const normalizeId = useCallback(
    (value?: string) =>
      (
        String(value || '')
          .trim()
          .split('/')
          .pop() ?? ''
      ).toLowerCase(),
    []
  );
  const currentUserAliases = useMemo(() => {
    const aliases = new Set<string>();
    const addAlias = (value?: string) => {
      const normalized = normalizeId(value);
      if (normalized) aliases.add(normalized);
    };

    addAlias(authAttributes?.sub);
    addAlias(authAttributes?.email);
    addAlias(authAttributes?.['cognito:username']);

    const matchedTeamMember = teams.find((team) => {
      const candidateIds = [
        team.practionerId,
        team._id,
        (team as any).userId,
        (team as any).id,
        (team as any).userOrganisation?.userId,
        (team as any).email,
      ];
      return candidateIds.some((candidate) => {
        const normalizedCandidate = normalizeId(candidate);
        return normalizedCandidate && aliases.has(normalizedCandidate);
      });
    });

    if (matchedTeamMember) {
      [
        matchedTeamMember.practionerId,
        matchedTeamMember._id,
        (matchedTeamMember as any).userId,
        (matchedTeamMember as any).id,
        (matchedTeamMember as any).userOrganisation?.userId,
        (matchedTeamMember as any).email,
      ].forEach(addAlias);
    }

    return aliases;
  }, [authAttributes, normalizeId, teams]);

  const isAssignedByCurrentUser = useMemo(
    () => currentUserAliases.has(normalizeId(activeTask.assignedBy)),
    [activeTask.assignedBy, currentUserAliases, normalizeId]
  );
  const isAssignedToCurrentUser = useMemo(
    () => currentUserAliases.has(normalizeId(activeTask.assignedTo)),
    [activeTask.assignedTo, currentUserAliases, normalizeId]
  );
  const editMode = useMemo<TaskEditMode>(() => {
    if (!hasTaskEditPermission) return 'NONE';
    if (isAssignedByCurrentUser && isAssignedToCurrentUser) return 'FULL';
    if (isAssignedByCurrentUser) return 'DETAILS_ONLY';
    if (isAssignedToCurrentUser) return 'STATUS_ONLY';
    return 'NONE';
  }, [hasTaskEditPermission, isAssignedByCurrentUser, isAssignedToCurrentUser]);

  return { editMode };
};
