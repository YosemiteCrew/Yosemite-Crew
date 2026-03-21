import React, { useEffect, useMemo } from 'react';
import { Appointment } from '@yosemite-crew/types';
import { useTaskForm } from '@/app/hooks/useTaskForm';
import TaskFormBody from '@/app/features/tasks/components/TaskFormBody';

type ParentTaskProps = {
  activeAppointment: Appointment;
};

const ParentTask = ({ activeAppointment }: ParentTaskProps) => {
  const initialTask = useMemo(
    () => ({
      companionId: activeAppointment.companion.id,
      assignedTo: activeAppointment.companion.parent.id,
    }),
    [activeAppointment.companion.id, activeAppointment.companion.parent.id]
  );

  const taskForm = useTaskForm({ isCompanionTask: true, initialTask });
  const { resetForm } = taskForm;

  useEffect(() => {
    resetForm();
  }, [activeAppointment, resetForm]);

  return <TaskFormBody {...taskForm} />;
};

export default ParentTask;
