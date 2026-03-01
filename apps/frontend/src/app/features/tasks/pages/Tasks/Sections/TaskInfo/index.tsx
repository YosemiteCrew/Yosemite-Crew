import EditableAccordion from '@/app/ui/primitives/Accordion/EditableAccordion';
import Close from '@/app/ui/primitives/Icons/Close';
import Modal from '@/app/ui/overlays/Modal';
import { usePermissions } from '@/app/hooks/usePermissions';
import { useTeamForPrimaryOrg } from '@/app/hooks/useTeam';
import { useCompanionsForPrimaryOrg } from '@/app/hooks/useCompanion';
import { updateTask, changeTaskStatus } from '@/app/features/tasks/services/taskService';
import {
  Task,
  TaskKindOptions,
  TaskRecurrenceOptions,
  TaskStatusOptions,
} from '@/app/features/tasks/types/task';
import { PERMISSIONS } from '@/app/lib/permissions';
import React, { useCallback, useMemo } from 'react';
import { applyUtcTime, generateTimeSlots } from '@/app/lib/date';
import { useMemberMap } from '@/app/hooks/useMemberMap';
import { useAuthStore } from '@/app/stores/authStore';

type TaskInfoProps = {
  showModal: boolean;
  setShowModal: React.Dispatch<React.SetStateAction<boolean>>;
  activeTask: Task;
};

const TaskInfo = ({ showModal, setShowModal, activeTask }: TaskInfoProps) => {
  const teams = useTeamForPrimaryOrg();
  const companions = useCompanionsForPrimaryOrg();
  const { resolveMemberName } = useMemberMap();
  const { can } = usePermissions();
  const hasTaskEditPermission = can(PERMISSIONS.TASKS_EDIT_ANY) || can(PERMISSIONS.TASKS_EDIT_OWN);
  const currentUserId = useAuthStore((s) => s.attributes?.sub || '');
  const normalizeId = useCallback(
    (value?: string) =>
      String(value || '')
        .trim()
        .toLowerCase(),
    []
  );
  const isAssignedByCurrentUser = useMemo(
    () => normalizeId(activeTask.assignedBy) === normalizeId(currentUserId),
    [activeTask.assignedBy, currentUserId, normalizeId]
  );
  const isAssignedToCurrentUser = useMemo(
    () => normalizeId(activeTask.assignedTo) === normalizeId(currentUserId),
    [activeTask.assignedTo, currentUserId, normalizeId]
  );
  const editMode = useMemo(() => {
    if (!hasTaskEditPermission) return 'NONE' as const;
    if (isAssignedByCurrentUser) return 'DETAILS_ONLY' as const;
    if (isAssignedToCurrentUser) return 'STATUS_ONLY' as const;
    return 'NONE' as const;
  }, [hasTaskEditPermission, isAssignedByCurrentUser, isAssignedToCurrentUser]);
  const canEditOnlyStatus = editMode === 'STATUS_ONLY';
  const canEditExceptStatus = editMode === 'DETAILS_ONLY';
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

  const timeOptions = useMemo(
    () =>
      generateTimeSlots(15).map((slot) => ({
        label: slot.value,
        value: slot.value,
      })),
    []
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

  const taskFields = useMemo(
    () => [
      {
        label: 'Task',
        key: 'name',
        type: 'text',
        required: true,
        editable: !canEditOnlyStatus,
      },
      {
        label: 'Category',
        key: 'category',
        type: 'select',
        options: categoryOptions,
        required: true,
        editable: !canEditOnlyStatus,
      },
      {
        label: 'Description',
        key: 'description',
        type: 'text',
        editable: !canEditOnlyStatus,
      },
      {
        label: 'Additional notes',
        key: 'additionalNotes',
        type: 'text',
        editable: !canEditOnlyStatus,
      },
      { label: 'From', key: 'assignedBy', type: 'text', editable: false },
      {
        label: 'To',
        key: 'assignedToId',
        type: 'dropdown',
        options: assigneeOptions,
        editable: !canEditOnlyStatus,
      },
      { label: 'Due date', key: 'dueAt', type: 'date', editable: !canEditOnlyStatus },
      {
        label: 'Due time',
        key: 'dueTime',
        type: 'dropdown',
        options: timeOptions,
        editable: !canEditOnlyStatus,
      },
      {
        label: 'Reminder',
        key: 'reminderEnabled',
        type: 'select',
        options: reminderEnabledOptions,
        editable: !canEditOnlyStatus,
      },
      {
        label: 'Reminder offset (minutes)',
        key: 'reminderOffsetMinutes',
        type: 'number',
        editable: !canEditOnlyStatus,
      },
      {
        label: 'Recurrence',
        key: 'recurrenceType',
        type: 'select',
        options: TaskRecurrenceOptions,
        editable: !canEditOnlyStatus,
      },
      {
        label: 'Sync with calendar',
        key: 'syncWithCalendar',
        type: 'select',
        options: syncOptions,
        editable: !canEditOnlyStatus,
      },
      {
        label: 'Status',
        key: 'status',
        type: 'select',
        options: TaskStatusOptions,
        editable: !canEditExceptStatus,
      },
    ],
    [
      assigneeOptions,
      canEditExceptStatus,
      canEditOnlyStatus,
      categoryOptions,
      reminderEnabledOptions,
      syncOptions,
      timeOptions,
    ]
  );

  const hasEditableFields = useMemo(
    () => taskFields.some((field) => field.editable !== false),
    [taskFields]
  );

  const taskData = useMemo(
    () => ({
      ...activeTask,
      assignedBy: resolveMemberDisplay(activeTask.assignedBy),
      assignedTo: resolveMemberDisplay(activeTask.assignedTo),
      assignedToId: activeTask.assignedTo,
      dueTime: `${String(new Date(activeTask.dueAt).getUTCHours()).padStart(2, '0')}:${String(
        new Date(activeTask.dueAt).getUTCMinutes()
      ).padStart(2, '0')}`,
      reminderEnabled: activeTask.reminder?.enabled ? 'true' : 'false',
      reminderOffsetMinutes:
        typeof activeTask.reminder?.offsetMinutes === 'number'
          ? String(activeTask.reminder.offsetMinutes)
          : '',
      recurrenceType: activeTask.recurrence?.type || 'ONCE',
      syncWithCalendar: activeTask.syncWithCalendar ? 'true' : 'false',
    }),
    [activeTask, resolveMemberDisplay]
  );

  const handleUpdate = async (values: any) => {
    try {
      if (editMode === 'NONE') {
        return;
      }
      if (canEditOnlyStatus) {
        await changeTaskStatus({
          ...activeTask,
          status: values.status || activeTask.status,
        });
        setShowModal(false);
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
      const dueDate = new Date(values.dueAt || activeTask.dueAt);
      const dueTimeValue = String(values.dueTime || taskData.dueTime);
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
        dueAt: applyUtcTime(dueDate, dueTimeValue),
        recurrence: {
          ...(activeTask.recurrence || { isMaster: false }),
          type: values.recurrenceType || activeTask.recurrence?.type || 'ONCE',
        },
        reminder,
        syncWithCalendar: String(values.syncWithCalendar ?? taskData.syncWithCalendar) === 'true',
        status: canEditExceptStatus ? activeTask.status : values.status,
      };
      await updateTask(payload);
      setShowModal(false);
    } catch (error) {
      console.log(error);
    }
  };

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
          <EditableAccordion
            key={`task-${activeTask._id}`}
            title={'Task details'}
            fields={taskFields}
            data={taskData}
            defaultOpen={true}
            onSave={(values) => handleUpdate(values)}
            showEditIcon={editMode !== 'NONE' && hasEditableFields}
          />
        </div>
      </div>
    </Modal>
  );
};

export default TaskInfo;
