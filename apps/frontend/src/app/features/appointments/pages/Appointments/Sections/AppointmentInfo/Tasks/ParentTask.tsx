import React, { useEffect, useMemo } from 'react';
import { Appointment } from '@yosemite-crew/types';
import { useTaskForm } from '@/app/hooks/useTaskForm';
import TaskFormBody from '@/app/features/tasks/components/TaskFormBody';
import { getAppointmentCompanion } from '@/app/lib/appointments';

type ParentTaskProps = {
  activeAppointment: Appointment;
};

const ParentTask = ({ activeAppointment }: ParentTaskProps) => {
  const companion = getAppointmentCompanion(activeAppointment);
  const initialTask = useMemo(
    () => ({
      companionId: companion.id,
      assignedTo: companion.parent.id,
    }),
    [companion.id, companion.parent.id]
  );

  const taskForm = useTaskForm({ isCompanionTask: true, initialTask });
  const { resetForm } = taskForm;

  useEffect(() => {
    resetForm();
  }, [activeAppointment, resetForm]);

  return <TaskFormBody {...taskForm} />;
};

export default ParentTask;
