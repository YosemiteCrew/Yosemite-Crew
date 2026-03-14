import Accordion from '@/app/ui/primitives/Accordion/Accordion';
import { Primary, Secondary } from '@/app/ui/primitives/Buttons';
import Fallback from '@/app/ui/overlays/Fallback';
import TaskFormFields from '@/app/features/tasks/components/TaskFormFields';
import { PermissionGate } from '@/app/ui/layout/guards/PermissionGate';
import { useTeamForPrimaryOrg } from '@/app/hooks/useTeam';
import { useTaskForm } from '@/app/hooks/useTaskForm';
import { PERMISSIONS } from '@/app/lib/permissions';
import React, { useMemo } from 'react';

const Task = () => {
  const teams = useTeamForPrimaryOrg();
  const {
    formData,
    setFormData,
    due,
    setDue,
    dueTimeValue,
    setDueTimeValue,
    formDataErrors,
    error,
    isLoading,
    templateOptions,
    selectTemplate,
    handleCreate,
    handleCreateTemplate,
  } = useTaskForm({
    isCompanionTask: false,
  });

  const TeamOptions = useMemo(
    () =>
      teams?.map((team) => ({
        label: team.name || team.practionerId || team._id,
        value: team.practionerId || team._id,
      })),
    [teams]
  );

  return (
    <PermissionGate allOf={[PERMISSIONS.TASKS_EDIT_ANY]} fallback={<Fallback />}>
      <div className="flex flex-col gap-6 w-full flex-1 justify-between overflow-y-auto scrollbar-hidden">
        <Accordion title="Task" defaultOpen showEditIcon={false} isEditing={true}>
          <TaskFormFields
            formData={formData}
            setFormData={setFormData}
            formDataErrors={formDataErrors}
            templateOptions={templateOptions}
            due={due}
            setDue={setDue}
            dueTimeValue={dueTimeValue}
            setDueTimeValue={setDueTimeValue}
            onSelectTemplate={selectTemplate}
            showAssigneeSelect
            assigneeOptions={TeamOptions}
            onAssigneeSelect={(option) =>
              setFormData({
                ...formData,
                assignedTo: option.value,
              })
            }
          />
        </Accordion>
        <div className="flex justify-end items-center gap-3 w-full flex-col pb-3">
          {error && <div className="text-red-600 text-sm text-center">{error}</div>}
          <div className="flex gap-3 justify-center w-full flex-wrap">
            <Secondary
              href="#"
              text="Save as template"
              className="hidden"
              onClick={handleCreateTemplate}
            />
            <Primary
              href="#"
              text={isLoading ? 'Saving...' : 'Save'}
              classname="w-auto min-w-[140px]"
              onClick={handleCreate}
              isDisabled={isLoading}
            />
          </div>
        </div>
      </div>
    </PermissionGate>
  );
};

export default Task;
