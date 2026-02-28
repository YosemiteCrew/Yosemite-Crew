import EditableAccordion from '@/app/ui/primitives/Accordion/EditableAccordion';
import Close from '@/app/ui/primitives/Icons/Close';
import Modal from '@/app/ui/overlays/Modal';
import { usePermissions } from '@/app/hooks/usePermissions';
import { useTeamForPrimaryOrg } from '@/app/hooks/useTeam';
import { useCompanionsForPrimaryOrg } from '@/app/hooks/useCompanion';
import { updateTask } from '@/app/features/tasks/services/taskService';
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
  const canEditTasks = can(PERMISSIONS.TASKS_EDIT_ANY);
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
    const options = companions.map((companion) => ({
      label: companion.name || companion.parentId || companion.id,
      value: companion.parentId,
    }));
    if (
      activeTask.assignedTo &&
      !options.some((option) => option.value === activeTask.assignedTo)
    ) {
      options.push({
        label: activeTask.assignedTo,
        value: activeTask.assignedTo,
      });
    }
    return options;
  }, [activeTask.assignedTo, companions]);

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
      { label: 'Task', key: 'name', type: 'text', required: true },
      {
        label: 'Category',
        key: 'category',
        type: 'select',
        options: categoryOptions,
        required: true,
      },
      { label: 'Description', key: 'description', type: 'text' },
      { label: 'Additional notes', key: 'additionalNotes', type: 'text' },
      { label: 'From', key: 'assignedBy', type: 'text', editable: false },
      {
        label: 'To',
        key: 'assignedToId',
        type: 'dropdown',
        options: assigneeOptions,
      },
      { label: 'Due date', key: 'dueAt', type: 'date' },
      {
        label: 'Due time',
        key: 'dueTime',
        type: 'dropdown',
        options: timeOptions,
      },
      {
        label: 'Reminder',
        key: 'reminderEnabled',
        type: 'select',
        options: reminderEnabledOptions,
      },
      {
        label: 'Reminder offset (minutes)',
        key: 'reminderOffsetMinutes',
        type: 'number',
      },
      {
        label: 'Recurrence',
        key: 'recurrenceType',
        type: 'select',
        options: TaskRecurrenceOptions,
      },
      {
        label: 'Sync with calendar',
        key: 'syncWithCalendar',
        type: 'select',
        options: syncOptions,
      },
      {
        label: 'Status',
        key: 'status',
        type: 'select',
        options: TaskStatusOptions,
      },
    ],
    [assigneeOptions, categoryOptions, reminderEnabledOptions, syncOptions, timeOptions]
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
      const payload: Task = {
        ...activeTask,
        name: values.name,
        description: values.description,
        additionalNotes: values.additionalNotes,
        category: values.category,
        assignedTo: values.assignedToId || activeTask.assignedTo,
        dueAt: applyUtcTime(dueDate, dueTimeValue),
        recurrence: {
          ...(activeTask.recurrence || { isMaster: false }),
          type: values.recurrenceType || activeTask.recurrence?.type || 'ONCE',
        },
        reminder,
        syncWithCalendar: String(values.syncWithCalendar ?? taskData.syncWithCalendar) === 'true',
        status: values.status,
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
            key={'task-key'}
            title={'Task details'}
            fields={taskFields}
            data={taskData}
            defaultOpen={true}
            onSave={(values) => handleUpdate(values)}
            showEditIcon={canEditTasks}
          />
        </div>
      </div>
    </Modal>
  );
};

export default TaskInfo;
