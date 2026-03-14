import Accordion from '@/app/ui/primitives/Accordion/Accordion';
import { Primary, Secondary } from '@/app/ui/primitives/Buttons';
import Fallback from '@/app/ui/overlays/Fallback';
import TaskFormFields from '@/app/features/tasks/components/TaskFormFields';
import { PermissionGate } from '@/app/ui/layout/guards/PermissionGate';
import { useTaskForm } from '@/app/hooks/useTaskForm';
import { PERMISSIONS } from '@/app/lib/permissions';
import { Appointment } from '@yosemite-crew/types';
import React, { useEffect, useMemo } from 'react';

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
    resetForm,
  } = useTaskForm({
    isCompanionTask: true,
    initialTask,
  });

  useEffect(() => {
    resetForm();
  }, [activeAppointment, resetForm]);

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

export default ParentTask;
