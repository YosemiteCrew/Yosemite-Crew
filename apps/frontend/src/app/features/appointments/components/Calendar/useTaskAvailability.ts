import { useCallback, useRef, useState } from 'react';
import { Task } from '@/app/features/tasks/types/task';
import { getProfileForUserForPrimaryOrg } from '@/app/features/organization/services/teamService';
import { logger } from '@/app/lib/logger';
import {
  AvailabilityDayEntry,
  buildAvailabilityOutput,
  DropAvailabilityInterval,
  getCalendarDayKey,
  normalizeCalendarId,
  TASK_BLOCK_DURATION_MINUTES,
} from '@/app/features/appointments/components/Calendar/taskCalendarAvailabilityUtils';

type UseTaskAvailabilityOptions = {
  allTaskItems: Task[];
  draggedTaskId: string | null;
  resolveAssigneeId: (candidateId?: string) => string;
  shiftDayKey: (dayKey: string, offset: number) => string;
  shouldEnforceAvailability: (task: Task, targetAssigneeId?: string) => boolean;
};

export const useTaskAvailability = ({
  allTaskItems,
  draggedTaskId,
  resolveAssigneeId,
  shiftDayKey,
  shouldEnforceAvailability,
}: UseTaskAvailabilityOptions) => {
  const [availabilityVersion, setAvailabilityVersion] = useState(0);
  const availabilityCacheRef = useRef<Record<string, Record<string, DropAvailabilityInterval[]>>>(
    {}
  );
  const availabilityPendingRef = useRef<Partial<Record<string, Promise<void>>>>({});

  const ensureAssigneeAvailability = useCallback(
    async (assigneeId?: string) => {
      const resolvedAssigneeId = resolveAssigneeId(assigneeId);
      if (!resolvedAssigneeId) return;
      const cacheKey = normalizeCalendarId(resolvedAssigneeId);
      if (availabilityCacheRef.current[cacheKey]) return;
      if (availabilityPendingRef.current[cacheKey]) {
        await availabilityPendingRef.current[cacheKey];
        return;
      }
      const task = (async () => {
        try {
          const profile = (await getProfileForUserForPrimaryOrg(resolvedAssigneeId)) as {
            baseAvailability?: AvailabilityDayEntry[];
          };
          const baseAvailability = Array.isArray(profile?.baseAvailability)
            ? profile.baseAvailability
            : [];
          availabilityCacheRef.current[cacheKey] = buildAvailabilityOutput(
            baseAvailability,
            shiftDayKey
          );
        } catch (error) {
          logger.warn('Failed to load assignee availability.', error);
          availabilityCacheRef.current[cacheKey] = {};
        } finally {
          setAvailabilityVersion((version) => version + 1);
        }
      })();
      availabilityPendingRef.current[cacheKey] = task;
      await task;
      delete availabilityPendingRef.current[cacheKey];
    },
    [resolveAssigneeId, shiftDayKey]
  );

  const getDropAvailabilityIntervals = useCallback(
    (date: Date, assigneeId?: string): DropAvailabilityInterval[] => {
      const draggedTask = allTaskItems.find((item) => item._id === draggedTaskId);
      const targetAssigneeId = assigneeId || draggedTask?.assignedTo;
      if (draggedTask && !shouldEnforceAvailability(draggedTask, targetAssigneeId)) {
        return [{ startMinute: 0, endMinute: 24 * 60 - TASK_BLOCK_DURATION_MINUTES }];
      }
      const resolvedAssigneeId = resolveAssigneeId(targetAssigneeId);
      if (!resolvedAssigneeId) return [];
      const assigneeKey = normalizeCalendarId(resolvedAssigneeId);
      return availabilityCacheRef.current[assigneeKey]?.[getCalendarDayKey(date)] || [];
    },
    [allTaskItems, draggedTaskId, resolveAssigneeId, shouldEnforceAvailability]
  );

  const isMinuteAvailableForAssignee = useCallback(
    async (date: Date, minute: number, assigneeId?: string) => {
      const resolvedAssigneeId = resolveAssigneeId(assigneeId);
      if (!resolvedAssigneeId) return false;
      await ensureAssigneeAvailability(resolvedAssigneeId);
      const intervals = getDropAvailabilityIntervals(date, resolvedAssigneeId);
      if (intervals.length === 0) return false;
      return intervals.some(
        (interval) => minute >= interval.startMinute && minute <= interval.endMinute
      );
    },
    [ensureAssigneeAvailability, getDropAvailabilityIntervals, resolveAssigneeId]
  );

  return {
    availabilityVersion,
    ensureAssigneeAvailability,
    getDropAvailabilityIntervals,
    isMinuteAvailableForAssignee,
  };
};
