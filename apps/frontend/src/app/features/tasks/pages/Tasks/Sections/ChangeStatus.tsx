import React from 'react';
import { Task, TaskStatus, TaskStatusOptions } from '@/app/features/tasks/types/task';
import { changeTaskStatus } from '@/app/features/tasks/services/taskService';
import {
  canTransitionTaskStatus,
  getAllowedTaskStatusTransitions,
  getInvalidTaskStatusTransitionMessage,
  normalizeTaskStatus,
} from '@/app/lib/tasks';
import ChangeStatusModal from '@/app/ui/overlays/Modal/ChangeStatusModal';

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
  const currentStatus = (normalizeTaskStatus(activeTask.status) ?? activeTask.status) as TaskStatus;

  const availableStatusOptions = React.useMemo(() => {
    const allowed = new Set<TaskStatus>([
      currentStatus,
      ...getAllowedTaskStatusTransitions(currentStatus),
    ]);
    return TaskStatusOptions.filter((option) => allowed.has(option.value as TaskStatus)) as Array<{
      value: TaskStatus;
      label: string;
    }>;
  }, [currentStatus]);

  return (
    <ChangeStatusModal<TaskStatus>
      showModal={showModal}
      setShowModal={setShowModal}
      currentStatus={currentStatus}
      defaultStatus={activeTask.status}
      preferredStatus={preferredStatus}
      statusOptions={availableStatusOptions}
      placeholder="Task status"
      canTransition={canTransitionTaskStatus}
      getInvalidMessage={getInvalidTaskStatusTransitionMessage}
      onSave={(newStatus) => changeTaskStatus({ ...activeTask, status: newStatus })}
    />
  );
};

export default ChangeTaskStatus;
