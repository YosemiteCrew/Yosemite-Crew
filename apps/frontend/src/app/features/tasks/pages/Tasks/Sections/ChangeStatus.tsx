import React, { useEffect, useMemo, useState } from 'react';
import CenterModal from '@/app/ui/overlays/Modal/CenterModal';
import ModalHeader from '@/app/ui/overlays/Modal/ModalHeader';
import LabelDropdown from '@/app/ui/inputs/Dropdown/LabelDropdown';
import { Primary, Secondary } from '@/app/ui/primitives/Buttons';
import { Task, TaskStatus, TaskStatusOptions } from '@/app/features/tasks/types/task';
import { changeTaskStatus } from '@/app/features/tasks/services/taskService';
import {
  canTransitionTaskStatus,
  getAllowedTaskStatusTransitions,
  getInvalidTaskStatusTransitionMessage,
  normalizeTaskStatus,
} from '@/app/lib/tasks';
import { useNotify } from '@/app/hooks/useNotify';

type ChangeTaskStatusProps = {
  showModal: boolean;
  setShowModal: React.Dispatch<React.SetStateAction<boolean>>;
  activeTask: Task;
  preferredStatus?: TaskStatus | null;
};

const ChangeTaskStatus = ({
  showModal,
  setShowModal,
  activeTask,
  preferredStatus = null,
}: ChangeTaskStatusProps) => {
  const { notify } = useNotify();
  const [selectedStatus, setSelectedStatus] = useState<TaskStatus>(activeTask.status);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const availableStatusOptions = useMemo(() => {
    const currentStatus = normalizeTaskStatus(activeTask.status);
    if (!currentStatus) return [];
    const allowed = new Set<TaskStatus>([
      currentStatus,
      ...getAllowedTaskStatusTransitions(currentStatus),
    ]);
    return TaskStatusOptions.filter((option) => allowed.has(option.value as TaskStatus));
  }, [activeTask.status]);

  useEffect(() => {
    const current = activeTask.status;
    if (!showModal) {
      setSelectedStatus(current);
      return;
    }
    if (
      preferredStatus &&
      canTransitionTaskStatus(current, preferredStatus) &&
      availableStatusOptions.some((option) => option.value === preferredStatus)
    ) {
      setSelectedStatus(preferredStatus);
      return;
    }
    setSelectedStatus(current);
  }, [activeTask.status, availableStatusOptions, preferredStatus, showModal]);

  const handleCancel = () => {
    setShowModal(false);
    setSelectedStatus(activeTask.status);
    setErrorMessage(null);
  };

  const handleSave = async () => {
    if (!activeTask?._id || saving) return;
    try {
      setSaving(true);
      setErrorMessage(null);
      if (activeTask.status === selectedStatus) {
        setShowModal(false);
        return;
      }
      if (!canTransitionTaskStatus(activeTask.status, selectedStatus)) {
        notify('warning', {
          title: 'Status update blocked',
          text: getInvalidTaskStatusTransitionMessage(activeTask.status, selectedStatus),
        });
        return;
      }
      await changeTaskStatus({
        ...activeTask,
        status: selectedStatus,
      });
      setShowModal(false);
    } catch (error) {
      console.log(error);
      setErrorMessage('Unable to update status. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <CenterModal showModal={showModal} setShowModal={setShowModal} onClose={handleCancel}>
      <div className="flex flex-col gap-4 w-full">
        <ModalHeader title="Change status" onClose={handleCancel} />
        <div className="flex flex-col gap-2">
          <div className={saving ? 'pointer-events-none opacity-60' : ''}>
            <LabelDropdown
              placeholder="Task status"
              options={availableStatusOptions}
              defaultOption={selectedStatus}
              searchable={false}
              onSelect={(option) => setSelectedStatus(option.value as TaskStatus)}
            />
          </div>
          {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}
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

export default ChangeTaskStatus;
