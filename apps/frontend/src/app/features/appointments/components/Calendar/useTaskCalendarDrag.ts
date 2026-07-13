import { useState } from 'react';
import { Task } from '@/app/features/tasks/types/task';
import { useTeamForPrimaryOrg } from '@/app/hooks/useTeam';
import { useAppointmentDragAutoScroll } from '@/app/features/appointments/components/Calendar/useAppointmentDragAutoScroll';
import { useTaskAvailability } from '@/app/features/appointments/components/Calendar/useTaskAvailability';
import { useTaskCalendarDragState } from '@/app/features/appointments/components/Calendar/useTaskCalendarDragState';
import { useTaskCalendarIdentity } from '@/app/features/appointments/components/Calendar/useTaskCalendarIdentity';

type UseTaskCalendarDragOptions = {
  allTaskItems: Task[];
  teams: ReturnType<typeof useTeamForPrimaryOrg>;
  authUserId: string;
};

// Compose the task-calendar drag concerns — identity resolution, assignee
// availability, and drag state — into a single hook so the container consumes
// one cohesive surface instead of wiring three hooks together itself.
export const useTaskCalendarDrag = ({
  allTaskItems,
  teams,
  authUserId,
}: UseTaskCalendarDragOptions) => {
  const [draggedTaskIdForAvailability, setDraggedTaskIdForAvailability] = useState<string | null>(
    null
  );

  const {
    canEditTask,
    resolveAssigneeId,
    resolveDisplayName,
    shiftDayKey,
    shouldEnforceAvailability,
  } = useTaskCalendarIdentity(teams, authUserId);

  const {
    availabilityVersion,
    ensureAssigneeAvailability,
    getDropAvailabilityIntervals,
    isMinuteAvailableForAssignee,
  } = useTaskAvailability({
    allTaskItems,
    draggedTaskId: draggedTaskIdForAvailability,
    resolveAssigneeId,
    shiftDayKey,
    shouldEnforceAvailability,
  });

  const dragState = useTaskCalendarDragState({
    allTaskItems,
    canDragTask: canEditTask,
    canEditTask,
    ensureAssigneeAvailability,
    isMinuteAvailableForAssignee,
    onDraggedTaskChange: setDraggedTaskIdForAvailability,
    resolveAssigneeId,
    shouldEnforceAvailability,
  });

  useAppointmentDragAutoScroll(dragState.draggedTaskId, availabilityVersion);

  return {
    canEditTask,
    resolveAssigneeId,
    resolveDisplayName,
    getDropAvailabilityIntervals,
    ...dragState,
  };
};
