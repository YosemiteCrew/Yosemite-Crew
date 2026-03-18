import React, { useMemo } from 'react';
import { useTeamForPrimaryOrg } from '@/app/hooks/useTeam';
import { useTaskForm } from '@/app/hooks/useTaskForm';
import TaskFormBody from '@/app/features/tasks/components/TaskFormBody';

const Task = () => {
  const teams = useTeamForPrimaryOrg();
  const taskForm = useTaskForm({ isCompanionTask: false });

  const assigneeOptions = useMemo(
    () =>
      teams?.map((team) => ({
        label: team.name || team.practionerId || team._id,
        value: team.practionerId || team._id,
      })),
    [teams]
  );

  return (
    <TaskFormBody
      {...taskForm}
      showAssigneeSelect
      assigneeOptions={assigneeOptions}
      onAssigneeSelect={(option) =>
        taskForm.setFormData({ ...taskForm.formData, assignedTo: option.value })
      }
    />
  );
};

export default Task;
