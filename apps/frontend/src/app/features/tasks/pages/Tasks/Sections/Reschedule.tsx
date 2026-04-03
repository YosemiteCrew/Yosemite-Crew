import React, { useEffect, useState } from 'react';
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

type RescheduleTaskProps = {
  showModal: boolean;
  setShowModal: React.Dispatch<React.SetStateAction<boolean>>;
  activeTask: Task;
};

const RescheduleTask = ({ showModal, setShowModal, activeTask }: RescheduleTaskProps) => {
  const { notify } = useNotify();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date(activeTask.dueAt));
  const [dueTimeValue, setDueTimeValue] = useState(
    getPreferredTimeValue(activeTask.dueAt, '00:00')
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setSelectedDate(new Date(activeTask.dueAt));
    setDueTimeValue(getPreferredTimeValue(activeTask.dueAt, '00:00'));
  }, [activeTask]);

  useEffect(() => {
    if (!showModal) return;
    if (canRescheduleTask(activeTask.status)) return;
    notify('warning', {
      title: 'Reschedule blocked',
      text: 'Completed and cancelled tasks cannot be rescheduled.',
    });
    setShowModal(false);
  }, [activeTask.status, notify, setShowModal, showModal]);

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

    try {
      setSaving(true);
      await updateTask({
        ...activeTask,
        dueAt: nextDueAt,
        timezone: activeTask.timezone || getPreferredTimeZone(),
      });
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

  return (
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
            className="min-h-12!"
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
            classname="w-auto min-w-[120px]"
          />
        </div>
      </div>
    </CenterModal>
  );
};

export default RescheduleTask;
