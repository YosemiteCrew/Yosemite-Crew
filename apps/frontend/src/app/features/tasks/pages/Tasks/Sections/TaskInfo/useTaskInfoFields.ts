import { useMemo } from 'react';
import { useCompanionsForPrimaryOrg } from '@/app/hooks/useCompanion';
import { useMemberMap } from '@/app/hooks/useMemberMap';
import { useTeamForPrimaryOrg } from '@/app/hooks/useTeam';
import { Task, TaskKindOptions, TaskStatusOptions } from '@/app/features/tasks/types/task';
import {
  offsetToReminderValue,
  recurrenceToRepeatValue,
  TASK_REMINDER_OPTIONS,
  TASK_REPEAT_OPTIONS,
} from '@/app/features/tasks/constants/taskTaxonomy';
import { getDatePartsInPreferredTimeZone } from '@/app/lib/timezone';
import {
  canRescheduleTask,
  canShowTaskStatusChangeAction,
  getAllowedTaskStatusTransitions,
  getTaskInstructions,
  normalizeTaskStatus,
} from '@/app/lib/tasks';

type UseTaskInfoFieldsArgs = {
  activeTask: Task;
  canEditDetails: boolean;
  canEditStatus: boolean;
};

export const useTaskInfoFields = ({
  activeTask,
  canEditDetails,
  canEditStatus,
}: UseTaskInfoFieldsArgs) => {
  const teams = useTeamForPrimaryOrg();
  const companions = useCompanionsForPrimaryOrg();
  const { resolveMemberName } = useMemberMap();

  const resolveMemberDisplay = useMemo(() => {
    return (id?: string) => {
      if (!id) return '-';
      const resolved = resolveMemberName(id);
      return resolved === '-' ? id : resolved;
    };
  }, [resolveMemberName]);

  const teamOptions = useMemo(() => {
    const options = teams.map((team) => ({
      label: team.name || team.practionerId || team._id,
      value: team.practionerId || team._id,
    }));
    if (
      activeTask.assignedTo &&
      !options.some((option) => option.value === activeTask.assignedTo)
    ) {
      options.push({
        label: resolveMemberDisplay(activeTask.assignedTo),
        value: activeTask.assignedTo,
      });
    }
    return options;
  }, [activeTask.assignedTo, resolveMemberDisplay, teams]);

  const parentTaskOptions = useMemo(() => {
    const options = companions.reduce<Array<{ label: string; value: string }>>(
      (items, companion) => {
        const parentId = companion.parentId;
        if (!parentId) return items;
        items.push({
          label: resolveMemberDisplay(parentId) || parentId || companion.id,
          value: parentId,
        });
        return items;
      },
      []
    );
    if (
      activeTask.assignedTo &&
      !options.some((option) => option.value === activeTask.assignedTo)
    ) {
      options.push({
        label: resolveMemberDisplay(activeTask.assignedTo),
        value: activeTask.assignedTo,
      });
    }
    return options;
  }, [activeTask.assignedTo, companions, resolveMemberDisplay]);

  const assigneeOptions = activeTask.audience === 'PARENT_TASK' ? parentTaskOptions : teamOptions;

  const categoryOptions = useMemo(() => {
    if (!activeTask.category) return TaskKindOptions;
    const alreadyPresent = TaskKindOptions.some((option) => option.value === activeTask.category);
    if (alreadyPresent) return TaskKindOptions;
    return [...TaskKindOptions, { label: activeTask.category, value: activeTask.category }];
  }, [activeTask.category]);

  const syncOptions = useMemo(
    () => [
      { label: 'Yes', value: 'true' },
      { label: 'No', value: 'false' },
    ],
    []
  );

  const allowedStatusOptions = useMemo(() => {
    const currentStatus = normalizeTaskStatus(activeTask.status);
    if (!currentStatus) return [];
    const allowed = new Set([currentStatus, ...getAllowedTaskStatusTransitions(currentStatus)]);
    return TaskStatusOptions.filter((option) => allowed.has(option.value as any));
  }, [activeTask.status]);
  const canChangeTaskStatus = canShowTaskStatusChangeAction(activeTask.status);
  const canRescheduleCurrentTask = canRescheduleTask(activeTask.status);
  const isRecurringTask = (activeTask.recurrence?.type ?? 'ONCE') !== 'ONCE';

  const taskFields = useMemo(
    () => [
      {
        label: 'Task',
        key: 'name',
        type: 'text',
        required: true,
        editable: canEditDetails,
      },
      {
        label: 'Category',
        key: 'category',
        type: 'select',
        options: categoryOptions,
        required: true,
        editable: canEditDetails,
      },
      {
        label: 'Instructions (optional)',
        key: 'description',
        type: 'text',
        editable: canEditDetails,
      },
      { label: 'From', key: 'assignedBy', type: 'text', editable: false },
      {
        label: 'To',
        key: 'assignedToId',
        type: 'dropdown',
        options: assigneeOptions,
        editable: canEditDetails,
      },
      {
        label: 'Due date',
        key: 'dueAt',
        type: 'date',
        editable: canEditDetails && canRescheduleCurrentTask,
      },
      {
        label: 'Due time',
        key: 'dueTime',
        type: 'timeInput',
        editable: canEditDetails && canRescheduleCurrentTask,
      },
      {
        label: 'Reminder',
        key: 'reminder',
        type: 'select',
        options: TASK_REMINDER_OPTIONS,
        editable: canEditDetails,
      },
      {
        label: 'Repeat',
        key: 'repeat',
        type: 'select',
        options: TASK_REPEAT_OPTIONS,
        editable: canEditDetails,
      },
      // End date only applies to a repeating task (one-off tasks have just a due date).
      ...(isRecurringTask
        ? [
            {
              label: 'End date',
              key: 'endDate',
              type: 'date',
              editable: canEditDetails,
            },
          ]
        : []),
      {
        label: 'Sync with calendar',
        key: 'syncWithCalendar',
        type: 'select',
        options: syncOptions,
        editable: canEditDetails,
      },
    ],
    [
      assigneeOptions,
      canEditDetails,
      canRescheduleCurrentTask,
      categoryOptions,
      isRecurringTask,
      syncOptions,
    ]
  );

  const statusFields = useMemo(
    () => [
      {
        label: 'Status',
        key: 'status',
        type: 'select',
        options: allowedStatusOptions,
        editable: canEditStatus && canChangeTaskStatus,
      },
    ],
    [allowedStatusOptions, canChangeTaskStatus, canEditStatus]
  );

  const hasEditableFields = useMemo(
    () => taskFields.some((field) => field.editable !== false),
    [taskFields]
  );

  const taskData = useMemo(() => {
    const dueParts = getDatePartsInPreferredTimeZone(new Date(activeTask.dueAt));
    return {
      ...activeTask,
      description: getTaskInstructions(activeTask),
      assignedBy: resolveMemberDisplay(activeTask.assignedBy),
      assignedTo: resolveMemberDisplay(activeTask.assignedTo),
      assignedToId: activeTask.assignedTo,
      dueTime: `${String(dueParts.hour).padStart(2, '0')}:${String(dueParts.minute).padStart(
        2,
        '0'
      )}`,
      reminder: offsetToReminderValue(activeTask.reminder?.offsetMinutes),
      repeat: recurrenceToRepeatValue(activeTask.recurrence),
      endDate: activeTask.recurrence?.endDate
        ? new Date(activeTask.recurrence.endDate).toISOString().slice(0, 10)
        : '',
      syncWithCalendar: activeTask.syncWithCalendar ? 'true' : 'false',
    };
  }, [activeTask, resolveMemberDisplay]);

  const statusData = useMemo(
    () => ({
      status: activeTask.status,
    }),
    [activeTask.status]
  );

  return {
    assigneeOptions,
    canChangeTaskStatus,
    hasEditableFields,
    statusData,
    statusFields,
    taskData,
    taskFields,
  };
};
