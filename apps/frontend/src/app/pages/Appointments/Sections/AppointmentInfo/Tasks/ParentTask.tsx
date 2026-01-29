import Accordion from "@/app/components/Accordion/Accordion";
import { Primary, Secondary } from "@/app/components/Buttons";
import Fallback from "@/app/components/Fallback";
import TaskFormFields from "@/app/components/Tasks/TaskFormFields";
import { PermissionGate } from "@/app/components/PermissionGate";
import { useTaskForm } from "@/app/hooks/useTaskForm";
import { PERMISSIONS } from "@/app/utils/permissions";
import { Appointment } from "@yosemite-crew/types";
import React, { useEffect } from "react";

type ParentTaskProps = {
  activeAppointment: Appointment;
};

const ParentTask = ({ activeAppointment }: ParentTaskProps) => {
  const {
    formData,
    setFormData,
    due,
    setDue,
    dueTimeUtc,
    setDueTimeUtc,
    formDataErrors,
    error,
    timeSlots,
    templateOptions,
    selectTemplate,
    handleCreate,
    handleCreateTemplate,
    resetForm,
  } = useTaskForm({
    isCompanionTask: true,
  });

  useEffect(() => {
    setFormData((prev) => ({
      ...prev,
      companionId: activeAppointment.companion.id,
      assignedTo: activeAppointment.companion.parent.id,
    }));
    resetForm();
  }, [activeAppointment, setFormData, resetForm]);

  return (
    <PermissionGate
      allOf={[PERMISSIONS.TASKS_EDIT_ANY]}
      fallback={<Fallback />}
    >
      <div className="flex flex-col gap-6 w-full flex-1 justify-between overflow-y-auto scrollbar-hidden">
        <Accordion
          title="Task"
          defaultOpen
          showEditIcon={false}
          isEditing={true}
        >
          <TaskFormFields
            formData={formData}
            setFormData={setFormData}
            formDataErrors={formDataErrors}
            templateOptions={templateOptions}
            timeSlots={timeSlots}
            due={due}
            setDue={setDue}
            dueTimeUtc={dueTimeUtc}
            setDueTimeUtc={setDueTimeUtc}
            onSelectTemplate={selectTemplate}
          />
        </Accordion>
        <div className="flex justify-end items-end gap-3 w-full flex-col">
          {error && (
            <div className="text-red-600 text-sm text-center">{error}</div>
          )}
          <div className="flex gap-3 w-full">
            <Secondary
              href="#"
              text="Save as template"
              className="w-full hidden"
              onClick={handleCreateTemplate}
            />
            <Primary
              href="#"
              text="Save"
              classname="w-full"
              onClick={handleCreate}
            />
          </div>
        </div>
      </div>
    </PermissionGate>
  );
};

export default ParentTask;
