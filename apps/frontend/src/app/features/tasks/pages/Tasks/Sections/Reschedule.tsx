import React, { useRef, useState } from 'react';
import CenterModal from '@/app/ui/overlays/Modal/CenterModal';
import ModalHeader from '@/app/ui/overlays/Modal/ModalHeader';
import { Primary, Secondary } from '@/app/ui/primitives/Buttons';
import Datepicker from '@/app/ui/inputs/Datepicker';
import Timepicker from '@/app/ui/inputs/Timepicker';
import { Task } from '@/app/features/tasks/types/task';
import { updateTask } from '@/app/features/tasks/services/taskService';
import { buildDateInPreferredTimeZone, getPreferredTimeZone } from '@/app/lib/timezone';
import { getPreferredTimeValue } from '@/app/lib/date';
import { canRescheduleTask } from '@/app/lib/tasks';
import { useNotify } from '@/app/hooks/useNotify';
import RecurrenceScopeModal from '@/app/features/tasks/components/RecurrenceScopeModal';
import { isSeriesTask, type RecurrenceScope } from '@/app/features/tasks/constants/taskTaxonomy';

type RescheduleTaskProps = {
  showModal: boolean;
  setShowModal: React.Dispatch<React.SetStateAction<boolean>>;
  activeTask: Task;
};

const RescheduleTask = ({ showModal, setShowModal, activeTask }: RescheduleTaskProps) => {
  const { notify } = useNotify();
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date(activeTask.dueAt));
  const [dueTimeValue, setDueTimeValue] = useState(() =>
    getPreferredTimeValue(activeTask.dueAt, '00:00')
  );
  const [saving, setSaving] = useState(false);
  const [scopeModalOpen, setScopeModalOpen] = useState(false);
  // Holds the new due date while the series scope is chosen.
  const pendingDueAtRef = useRef<Date | null>(null);

  const prevActiveTaskRef = useRef(activeTask);
  if (prevActiveTaskRef.current !== activeTask) {
    prevActiveTaskRef.current = activeTask;
    setSelectedDate(new Date(activeTask.dueAt));
    setDueTimeValue(getPreferredTimeValue(activeTask.dueAt, '00:00'));
  }

  const handleCancel = () => {
    setShowModal(false);
    setSelectedDate(new Date(activeTask.dueAt));
    setDueTimeValue(getPreferredTimeValue(activeTask.dueAt, '00:00'));
  };

  const handleSave = async () => {
    if (saving) return;
    if (!canRescheduleTask(activeTask.status)) {
      notify('warning', {
        title: 'Reschedule blocked',
        text: 'Completed and cancelled tasks cannot be rescheduled.',
      });
      setShowModal(false);
      return;
    }
    const [hourRaw, minuteRaw] = String(dueTimeValue || '00:00').split(':');
    const hour = Number.parseInt(hourRaw ?? '0', 10);
    const minute = Number.parseInt(minuteRaw ?? '0', 10);
    const nextDueAt = buildDateInPreferredTimeZone(
      selectedDate,
      (Number.isFinite(hour) ? hour : 0) * 60 + (Number.isFinite(minute) ? minute : 0)
    );

    // A task in a recurring series asks which occurrences the move applies to,
    // rather than silently rescheduling only this one.
    if (isSeriesTask(activeTask.recurrence)) {
      pendingDueAtRef.current = nextDueAt;
      setScopeModalOpen(true);
      return;
    }

    await commitReschedule(nextDueAt);
  };

  const commitReschedule = async (nextDueAt: Date, scope?: RecurrenceScope) => {
    try {
      setSaving(true);
      await updateTask(
        {
          ...activeTask,
          dueAt: nextDueAt,
          timezone: activeTask.timezone || getPreferredTimeZone(),
        },
        scope
      );
      setScopeModalOpen(false);
      pendingDueAtRef.current = null;
      setShowModal(false);
    } catch (error) {
      console.log(error);
      notify('error', {
        title: 'Unable to reschedule',
        text: 'Please try again.',
      });
    } finally {
      setSaving(false);
    }
  };

  // Commit the held reschedule against the chosen series scope.
  const handleScopeConfirm = async (scope: RecurrenceScope) => {
    const nextDueAt = pendingDueAtRef.current;
    if (!nextDueAt) return;
    await commitReschedule(nextDueAt, scope);
  };

  return (
    <>
      <CenterModal showModal={showModal} setShowModal={setShowModal} onClose={handleCancel}>
        <div className="flex flex-col gap-4 w-full">
          <ModalHeader title="Reschedule" onClose={handleCancel} />
          <div className="grid gap-3">
            <Datepicker
              currentDate={selectedDate}
              setCurrentDate={setSelectedDate}
              type="input"
              placeholder="Due date"
            />
            <Timepicker
              value={dueTimeValue}
              label="Due time"
              name="dueTime"
              onChange={setDueTimeValue}
            />
          </div>
          <div className="flex items-center justify-center gap-2 w-full pb-3 flex-wrap">
            <Secondary
              href="#"
              text="Cancel"
              onClick={handleCancel}
              isDisabled={saving}
              className="w-auto min-w-[120px]"
            />
            <Primary
              href="#"
              text={saving ? 'Saving...' : 'Update'}
              onClick={handleSave}
              isDisabled={saving}
              className="w-auto min-w-[120px]"
            />
          </div>
        </div>
      </CenterModal>
      {scopeModalOpen && (
        <RecurrenceScopeModal
          showModal={scopeModalOpen}
          setShowModal={setScopeModalOpen}
          action="edit"
          taskName={activeTask.name}
          busy={saving}
          onConfirm={handleScopeConfirm}
        />
      )}
    </>
  );
};

export default RescheduleTask;
