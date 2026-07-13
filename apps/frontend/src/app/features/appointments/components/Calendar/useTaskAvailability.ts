import { useCallback, useRef, useState } from 'react';
import { Task } from '@/app/features/tasks/types/task';
import {
  DropAvailabilityInterval,
  fetchAssigneeAvailability,
  isMinuteWithinIntervals,
  normalizeCalendarId,
  readDropAvailabilityIntervals,
  runOncePerKey,
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
      await runOncePerKey(availabilityPendingRef.current, cacheKey, async () => {
        availabilityCacheRef.current[cacheKey] = await fetchAssigneeAvailability(
          resolvedAssigneeId,
          shiftDayKey
        );
        setAvailabilityVersion((version) => version + 1);
      });
    },
    [resolveAssigneeId, shiftDayKey]
  );

  const getDropAvailabilityIntervals = useCallback(
    (date: Date, assigneeId?: string): DropAvailabilityInterval[] => {
      const draggedTask = allTaskItems.find((item) => item._id === draggedTaskId);
      return readDropAvailabilityIntervals(
        availabilityCacheRef.current,
        date,
        assigneeId || draggedTask?.assignedTo,
        { draggedTask, resolveAssigneeId, shouldEnforceAvailability }
      );
    },
    [allTaskItems, draggedTaskId, resolveAssigneeId, shouldEnforceAvailability]
  );

  const isMinuteAvailableForAssignee = useCallback(
    async (date: Date, minute: number, assigneeId?: string) => {
      const resolvedAssigneeId = resolveAssigneeId(assigneeId);
      if (!resolvedAssigneeId) return false;
      await ensureAssigneeAvailability(resolvedAssigneeId);
      return isMinuteWithinIntervals(
        minute,
        getDropAvailabilityIntervals(date, resolvedAssigneeId)
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
