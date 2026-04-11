import EditableAccordion from '@/app/ui/primitives/Accordion/EditableAccordion';
import Close from '@/app/ui/primitives/Icons/Close';
import Modal from '@/app/ui/overlays/Modal';
import { Primary } from '@/app/ui/primitives/Buttons';
import { usePermissions } from '@/app/hooks/usePermissions';
import { useTeamForPrimaryOrg } from '@/app/hooks/useTeam';
import { useCompanionsForPrimaryOrg } from '@/app/hooks/useCompanion';
import { changeTaskStatus, updateTask } from '@/app/features/tasks/services/taskService';
import {
  Task,
  TaskKindOptions,
  TaskRecurrenceOptions,
  TaskStatusOptions,
} from '@/app/features/tasks/types/task';
import { PERMISSIONS } from '@/app/lib/permissions';
import React, { useCallback, useMemo, useState } from 'react';
import { useMemberMap } from '@/app/hooks/useMemberMap';
import { useAuthStore } from '@/app/stores/authStore';
import {
  buildDateInPreferredTimeZone,
  getDatePartsInPreferredTimeZone,
  getPreferredTimeZone,
} from '@/app/lib/timezone';
import {
  canRescheduleTask,
  canShowTaskStatusChangeAction,
  canTransitionTaskStatus,
  getAllowedTaskStatusTransitions,
  getInvalidTaskStatusTransitionMessage,
  normalizeTaskStatus,
} from '@/app/lib/tasks';
import { useNotify } from '@/app/hooks/useNotify';

type TaskInfoProps = {
  showModal: boolean;
  setShowModal: React.Dispatch<React.SetStateAction<boolean>>;
  activeTask: Task;
  onReuseTask?: (task: Partial<Task>) => void;
};

const TaskInfo = ({ showModal, setShowModal, activeTask, onReuseTask }: TaskInfoProps) => {
  const { notify } = useNotify();
  const teams = useTeamForPrimaryOrg();
  const companions = useCompanionsForPrimaryOrg();
  const { resolveMemberName } = useMemberMap();
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
  const editMode = useMemo(() => {
    if (!hasTaskEditPermission) return 'NONE' as const;
    if (isAssignedByCurrentUser && isAssignedToCurrentUser) return 'FULL' as const;
    if (isAssignedByCurrentUser) return 'DETAILS_ONLY' as const;
    if (isAssignedToCurrentUser) return 'STATUS_ONLY' as const;
    return 'NONE' as const;
  }, [hasTaskEditPermission, isAssignedByCurrentUser, isAssignedToCurrentUser]);
  const canEditOnlyStatus = editMode === 'STATUS_ONLY';
  const canEditExceptStatus = editMode === 'DETAILS_ONLY';
  const canEditAllFields = editMode === 'FULL';
  const canEditDetails = canEditExceptStatus || canEditAllFields;
  const canEditStatus = canEditOnlyStatus || canEditAllFields;
  const [isReusing, setIsReusing] = useState(false);
  const isCompletedTask = activeTask.status === 'COMPLETED';
  const effectiveEditMode = isCompletedTask ? ('NONE' as const) : editMode;
  const resolveMemberDisplay = useCallback(
    (id?: string) => {
      if (!id) return '-';
      const resolved = resolveMemberName(id);
      return resolved === '-' ? id : resolved;
    },
    [resolveMemberName]
  );

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
    const options = companions
      .filter((companion) => Boolean(companion.parentId))
      .map((companion) => ({
        label: resolveMemberDisplay(companion.parentId) || companion.parentId || companion.id,
        value: companion.parentId,
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
  }, [activeTask.assignedTo, companions, resolveMemberDisplay]);

  const assigneeOptions = useMemo(
    () => (activeTask.audience === 'PARENT_TASK' ? parentTaskOptions : teamOptions),
    [activeTask.audience, parentTaskOptions, teamOptions]
  );

  const categoryOptions = useMemo(() => {
    if (!activeTask.category) return TaskKindOptions;
    const alreadyPresent = TaskKindOptions.some((option) => option.value === activeTask.category);
    if (alreadyPresent) return TaskKindOptions;
    return [...TaskKindOptions, { label: activeTask.category, value: activeTask.category }];
  }, [activeTask.category]);

  const reminderEnabledOptions = useMemo(
    () => [
      { label: 'Enabled', value: 'true' },
      { label: 'Disabled', value: 'false' },
    ],
    []
  );

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
        label: 'Description',
        key: 'description',
        type: 'text',
        editable: canEditDetails,
      },
      {
        label: 'Additional notes',
        key: 'additionalNotes',
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
        key: 'reminderEnabled',
        type: 'select',
        options: reminderEnabledOptions,
        editable: canEditDetails,
      },
      {
        label: 'Reminder offset (minutes)',
        key: 'reminderOffsetMinutes',
        type: 'number',
        editable: canEditDetails,
      },
      {
        label: 'Recurrence',
        key: 'recurrenceType',
        type: 'select',
        options: TaskRecurrenceOptions,
        editable: canEditDetails,
      },
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
      reminderEnabledOptions,
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
      assignedBy: resolveMemberDisplay(activeTask.assignedBy),
      assignedTo: resolveMemberDisplay(activeTask.assignedTo),
      assignedToId: activeTask.assignedTo,
      dueTime: `${String(dueParts.hour).padStart(2, '0')}:${String(dueParts.minute).padStart(
        2,
        '0'
      )}`,
      reminderEnabled: activeTask.reminder?.enabled ? 'true' : 'false',
      reminderOffsetMinutes:
        typeof activeTask.reminder?.offsetMinutes === 'number'
          ? String(activeTask.reminder.offsetMinutes)
          : '',
      recurrenceType: activeTask.recurrence?.type || 'ONCE',
      syncWithCalendar: activeTask.syncWithCalendar ? 'true' : 'false',
    };
  }, [activeTask, resolveMemberDisplay]);

  const statusData = useMemo(
    () => ({
      status: activeTask.status,
    }),
    [activeTask.status]
  );

  const handleStatusUpdate = async (values: any) => {
    try {
      if (effectiveEditMode === 'NONE' || !canEditStatus) return;

      const nextStatus = values.status || activeTask.status;
      if (nextStatus === activeTask.status) {
        setShowModal(false);
        return;
      }

      if (!canShowTaskStatusChangeAction(activeTask.status)) {
        notify('warning', {
          title: 'Status update blocked',
          text: 'No status changes are available for this task.',
        });
        return;
      }

      if (!canTransitionTaskStatus(activeTask.status, nextStatus)) {
        notify('warning', {
          title: 'Status update blocked',
          text: getInvalidTaskStatusTransitionMessage(activeTask.status, nextStatus),
        });
        return;
      }

      await changeTaskStatus({
        ...activeTask,
        status: nextStatus,
      });
      setShowModal(false);
    } catch (error) {
      console.log(error);
    }
  };

  const handleUpdate = async (values: any) => {
    try {
      if (effectiveEditMode === 'NONE' || !canEditDetails) {
        return;
      }

      const reminderEnabled = String(values.reminderEnabled ?? taskData.reminderEnabled) === 'true';
      const reminderOffsetRaw = String(
        values.reminderOffsetMinutes ?? taskData.reminderOffsetMinutes ?? ''
      ).trim();
      const reminderOffset = reminderOffsetRaw
        ? Number.parseInt(reminderOffsetRaw, 10)
        : Number.NaN;
      const reminder =
        reminderEnabled && Number.isFinite(reminderOffset) && reminderOffset > 0
          ? {
              enabled: true,
              offsetMinutes: reminderOffset,
            }
          : undefined;
      const dueDateValue = values.dueAt || activeTask.dueAt;
      let dueDate = new Date(dueDateValue);
      if (typeof dueDateValue === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dueDateValue)) {
        const [yyyy, mm, dd] = dueDateValue.split('-').map(Number);
        dueDate = new Date(yyyy, mm - 1, dd);
      }
      const dueTimeValue = String(values.dueTime || taskData.dueTime || '00:00');
      const [hourRaw, minuteRaw] = dueTimeValue.split(':');
      const hour = Number.parseInt(hourRaw ?? '0', 10);
      const minute = Number.parseInt(minuteRaw ?? '0', 10);
      const dueMinuteOfDay =
        (Number.isFinite(hour) ? hour : 0) * 60 + (Number.isFinite(minute) ? minute : 0);
      const nextDueAt = buildDateInPreferredTimeZone(dueDate, dueMinuteOfDay);
      if (
        nextDueAt.getTime() !== new Date(activeTask.dueAt).getTime() &&
        !canRescheduleTask(activeTask.status)
      ) {
        notify('warning', {
          title: 'Reschedule blocked',
          text: 'Completed and cancelled tasks cannot be rescheduled.',
        });
        return;
      }
      const resolveAssigneeId = () => {
        const raw = String(values.assignedToId ?? values.assignedTo ?? '').trim();
        if (!raw) return activeTask.assignedTo;
        const byValue = assigneeOptions.find((option) => String(option.value) === raw);
        if (byValue) return byValue.value;
        const byLabel = assigneeOptions.find((option) => String(option.label) === raw);
        if (byLabel) return byLabel.value;
        return raw;
      };
      const payload: Task = {
        ...activeTask,
        name: values.name,
        description: values.description,
        additionalNotes: values.additionalNotes,
        category: values.category,
        assignedTo: resolveAssigneeId(),
        dueAt: nextDueAt,
        timezone: activeTask.timezone || getPreferredTimeZone(),
        recurrence: {
          ...(activeTask.recurrence || { isMaster: false }),
          type: values.recurrenceType || activeTask.recurrence?.type || 'ONCE',
        },
        reminder,
        syncWithCalendar: String(values.syncWithCalendar ?? taskData.syncWithCalendar) === 'true',
        status: activeTask.status,
      };
      await updateTask(payload);
      setShowModal(false);
    } catch (error) {
      console.log(error);
    }
  };

  const handleReuseTask = useCallback(async () => {
    if (!isCompletedTask || isReusing) return;
    setIsReusing(true);
    try {
      onReuseTask?.({
        ...activeTask,
        _id: '',
        status: 'PENDING',
        dueAt: new Date(),
        completedAt: undefined,
        completedBy: undefined,
        createdAt: undefined,
        updatedAt: undefined,
        timezone: getPreferredTimeZone(),
        recurrence: activeTask.recurrence
          ? {
              ...activeTask.recurrence,
              isMaster: false,
              masterTaskId: undefined,
            }
          : activeTask.recurrence,
      });
      setShowModal(false);
    } catch (error) {
      console.log(error);
    } finally {
      setIsReusing(false);
    }
  }, [activeTask, isCompletedTask, isReusing, onReuseTask, setShowModal]);

  return (
    <Modal showModal={showModal} setShowModal={setShowModal}>
      <div className="flex flex-col h-full gap-6">
        <div className="flex justify-between items-center">
          <div className="opacity-0">
            <Close onClick={() => {}} />
          </div>
          <div className="flex justify-center items-center gap-2">
            <div className="text-body-1 text-text-primary">View task</div>
          </div>
          <Close onClick={() => setShowModal(false)} />
        </div>
        <div className="flex overflow-y-auto flex-1 scrollbar-hidden">
          <div className="flex w-full flex-col gap-3">
            <EditableAccordion
              key={`task-status-${activeTask._id}`}
              title={'Status'}
              fields={statusFields}
              data={statusData}
              defaultOpen={true}
              onSave={(values) => handleStatusUpdate(values)}
              showEditIcon={effectiveEditMode !== 'NONE' && canEditStatus && canChangeTaskStatus}
            />
            <EditableAccordion
              key={`task-${activeTask._id}`}
              title={'Task details'}
              fields={taskFields}
              data={taskData}
              defaultOpen={true}
              onSave={(values) => handleUpdate(values)}
              showEditIcon={effectiveEditMode !== 'NONE' && hasEditableFields}
            />
          </div>
        </div>
        {isCompletedTask && (
          <div className="flex justify-end">
            <Primary
              href="#"
              text={isReusing ? 'Reusing...' : 'Reuse task'}
              className="w-auto min-w-[140px]"
              onClick={handleReuseTask}
            />
          </div>
        )}
      </div>
    </Modal>
  );
};

export default TaskInfo;
