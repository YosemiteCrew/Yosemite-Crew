'use client';
import React from 'react';
import dynamic from 'next/dynamic';
import { Task, TaskStatus } from '@/app/features/tasks/types/task';

const AddTask = dynamic(() => import('@/app/features/tasks/pages/Tasks/Sections/AddTask'));
const TaskInfo = dynamic(() => import('@/app/features/tasks/pages/Tasks/Sections/TaskInfo'));
const ChangeTaskStatus = dynamic(
  () => import('@/app/features/tasks/pages/Tasks/Sections/ChangeStatus')
);
const RescheduleTask = dynamic(
  () => import('@/app/features/tasks/pages/Tasks/Sections/Reschedule')
);

type TaskModalsProps = {
  addPopup: boolean;
  setAddPopup: React.Dispatch<React.SetStateAction<boolean>>;
  addTaskPrefill: Partial<Task> | null;
  setAddTaskPrefill: React.Dispatch<React.SetStateAction<Partial<Task> | null>>;
  activeTask: Task | null;
  viewPopup: boolean;
  setViewPopup: React.Dispatch<React.SetStateAction<boolean>>;
  onReuseTask: (prefill: Partial<Task>) => void;
  canEditTasks: boolean;
  changeStatusPopup: boolean;
  setChangeStatusPopup: React.Dispatch<React.SetStateAction<boolean>>;
  changeStatusPreferredStatus: TaskStatus | null;
  reschedulePopup: boolean;
  setReschedulePopup: React.Dispatch<React.SetStateAction<boolean>>;
};

/**
 * The planner's four side modals. They are siblings of the planner rather than
 * children of it, so they live in their own component and the page keeps the
 * state that opens them.
 */
const TaskModals = ({
  addPopup,
  setAddPopup,
  addTaskPrefill,
  setAddTaskPrefill,
  activeTask,
  viewPopup,
  setViewPopup,
  onReuseTask,
  canEditTasks,
  changeStatusPopup,
  setChangeStatusPopup,
  changeStatusPreferredStatus,
  reschedulePopup,
  setReschedulePopup,
}: TaskModalsProps) => (
  <>
    <AddTask
      showModal={addPopup}
      setShowModal={(value) => {
        setAddPopup(value);
        if (value === false) setAddTaskPrefill(null);
      }}
      prefill={addTaskPrefill}
    />
    {activeTask && viewPopup && (
      <TaskInfo
        showModal={viewPopup}
        setShowModal={setViewPopup}
        activeTask={activeTask}
        onReuseTask={onReuseTask}
      />
    )}
    {activeTask && canEditTasks && (
      <ChangeTaskStatus
        showModal={changeStatusPopup}
        setShowModal={setChangeStatusPopup}
        activeTask={activeTask}
        preferredStatus={changeStatusPreferredStatus}
      />
    )}
    {activeTask && canEditTasks && (
      <RescheduleTask
        showModal={reschedulePopup}
        setShowModal={setReschedulePopup}
        activeTask={activeTask}
      />
    )}
  </>
);

export default TaskModals;
