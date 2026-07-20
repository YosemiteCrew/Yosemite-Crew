import EditableAccordion from '@/app/ui/primitives/Accordion/EditableAccordion';
import Close from '@/app/ui/primitives/Icons/Close';
import Modal from '@/app/ui/overlays/Modal';
import { Primary } from '@/app/ui/primitives/Buttons';
import { changeTaskStatus, updateTask } from '@/app/features/tasks/services/taskService';
import { Task } from '@/app/features/tasks/types/task';
import {
  isSeriesTask,
  reminderValueToOffset,
  repeatValueToRecurrence,
  type RecurrenceScope,
} from '@/app/features/tasks/constants/taskTaxonomy';
import RecurrenceScopeModal from '@/app/features/tasks/components/RecurrenceScopeModal';
import React, { useCallback, useRef, useState } from 'react';
import { buildDateInPreferredTimeZone, getPreferredTimeZone } from '@/app/lib/timezone';
import {
  canRescheduleTask,
  canShowTaskStatusChangeAction,
  canTransitionTaskStatus,
  getInvalidTaskStatusTransitionMessage,
} from '@/app/lib/tasks';
import { useNotify } from '@/app/hooks/useNotify';
import { useTaskEditMode } from './useTaskEditMode';
import { useTaskInfoFields } from './useTaskInfoFields';

type TaskInfoProps = {
  showModal: boolean;
  setShowModal: React.Dispatch<React.SetStateAction<boolean>>;
  activeTask: Task;
  onReuseTask?: (task: Partial<Task>) => void;
};

const TaskInfo = ({ showModal, setShowModal, activeTask, onReuseTask }: TaskInfoProps) => {
  const { notify } = useNotify();
  const { editMode } = useTaskEditMode(activeTask);
  const canEditOnlyStatus = editMode === 'STATUS_ONLY';
  const canEditExceptStatus = editMode === 'DETAILS_ONLY';
  const canEditAllFields = editMode === 'FULL';
  const canEditDetails = canEditExceptStatus || canEditAllFields;
  const canEditStatus = canEditOnlyStatus || canEditAllFields;
  const [isReusing, setIsReusing] = useState(false);
  const [scopeModalOpen, setScopeModalOpen] = useState(false);
  const pendingEditPayloadRef = useRef<Task | null>(null);
  const [scopeBusy, setScopeBusy] = useState(false);
  const isCompletedTask = activeTask.status === 'COMPLETED';
  const effectiveEditMode = isCompletedTask ? ('NONE' as const) : editMode;
  const {
    assigneeOptions,
    canChangeTaskStatus,
    hasEditableFields,
    statusData,
    statusFields,
    taskData,
    taskFields,
  } = useTaskInfoFields({ activeTask, canEditDetails, canEditStatus });

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

      const reminderOffset = reminderValueToOffset(String(values.reminder ?? taskData.reminder));
      const reminder = reminderOffset
        ? {
            enabled: true,
            offsetMinutes: reminderOffset,
          }
        : undefined;
      const nextRecurrence = repeatValueToRecurrence(String(values.repeat ?? taskData.repeat));
      // End date only applies to a repeating task; parse the YYYY-MM-DD value.
      const endDateRaw = String(values.endDate ?? taskData.endDate ?? '').trim();
      const nextEndDate =
        nextRecurrence.type !== 'ONCE' && /^\d{4}-\d{2}-\d{2}$/.test(endDateRaw)
          ? new Date(`${endDateRaw}T23:59:59`)
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
        category: values.category,
        priority: (values.priority ?? activeTask.priority) as Task['priority'],
        assignedTo: resolveAssigneeId(),
        dueAt: nextDueAt,
        timezone: activeTask.timezone || getPreferredTimeZone(),
        recurrence: {
          ...(activeTask.recurrence || { isMaster: false }),
          type: nextRecurrence.type,
          cronExpression: nextRecurrence.cronExpression,
          isMaster: nextRecurrence.type !== 'ONCE',
          endDate: nextEndDate,
        },
        reminder,
        syncWithCalendar: String(values.syncWithCalendar ?? taskData.syncWithCalendar) === 'true',
        status: activeTask.status,
      };
      // A task in a recurring series asks which occurrences the edit applies to.
      if (isSeriesTask(activeTask.recurrence)) {
        pendingEditPayloadRef.current = payload;
        setScopeModalOpen(true);
        return;
      }
      await updateTask(payload);
      setShowModal(false);
    } catch (error) {
      console.log(error);
    }
  };

  // Commit the held edit against the chosen series scope.
  const handleScopeConfirm = async (scope: RecurrenceScope) => {
    if (!pendingEditPayloadRef.current) return;
    setScopeBusy(true);
    try {
      await updateTask(pendingEditPayloadRef.current, scope);
      setScopeModalOpen(false);
      pendingEditPayloadRef.current = null;
      setShowModal(false);
    } catch (error) {
      console.log(error);
    } finally {
      setScopeBusy(false);
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
    <>
      <Modal showModal={showModal} setShowModal={setShowModal}>
        <div className="flex flex-col h-full gap-6">
          <div className="flex justify-between items-center">
            <div className="size-8" aria-hidden="true" />
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
                className="w-auto min-w-35"
                onClick={handleReuseTask}
              />
            </div>
          )}
        </div>
      </Modal>
      {scopeModalOpen && (
        <RecurrenceScopeModal
          showModal={scopeModalOpen}
          setShowModal={setScopeModalOpen}
          action="edit"
          taskName={activeTask.name}
          busy={scopeBusy}
          onConfirm={handleScopeConfirm}
        />
      )}
    </>
  );
};

export default TaskInfo;
