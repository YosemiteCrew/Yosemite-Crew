import { Primary, Secondary } from "@/app/components/Buttons";
import Close from "@/app/components/Icons/Close";
import TaskFormFields from "@/app/components/Tasks/TaskFormFields";
import Modal from "@/app/components/Modal";
import { useCompanionsForPrimaryOrg } from "@/app/hooks/useCompanion";
import { useTeamForPrimaryOrg } from "@/app/hooks/useTeam";
import { useTaskForm } from "@/app/hooks/useTaskForm";
import React, { useMemo } from "react";

const TaskTypeOptions = [
  { value: "EMPLOYEE_TASK", label: "Employee Task" },
  { value: "PARENT_TASK", label: "Parent Task" },
];

type AddTaskProps = {
  showModal: boolean;
  setShowModal: React.Dispatch<React.SetStateAction<boolean>>;
};

const AddTask = ({ showModal, setShowModal }: AddTaskProps) => {
  const teams = useTeamForPrimaryOrg();
  const companions = useCompanionsForPrimaryOrg();
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
  } = useTaskForm({
    isCompanionTask: false,
    onSuccess: () => setShowModal(false),
  });

  const CompanionOptions = useMemo(
    () =>
      companions?.map((companion) => ({
        label: companion.name,
        value: companion.parentId,
      })),
    [companions]
  );

  const TeamOptions = useMemo(
    () =>
      teams?.map((team) => ({
        label: team.name || team.practionerId,
        value: team.practionerId,
      })),
    [teams]
  );

  return (
    <Modal showModal={showModal} setShowModal={setShowModal}>
      <div className="flex flex-col h-full gap-6">
        <div className="flex justify-between items-center">
          <div className="opacity-0">
            <Close onClick={() => {}} />
          </div>
          <div className="flex justify-center items-center gap-2">
            <div className="text-body-1 text-text-primary">Add task</div>
          </div>
          <Close onClick={() => setShowModal(false)} />
        </div>

        <div className="flex flex-col gap-6 w-full flex-1 justify-start overflow-y-auto scrollbar-hidden pt-1.5">
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
            showAudienceSelect
            audienceOptions={TaskTypeOptions}
            onAudienceSelect={(option) =>
              setFormData({
                ...formData,
                audience: option.value as any,
                assignedTo: "",
                companionId: undefined,
              })
            }
            showAssigneeSelect
            assigneeOptions={
              formData.audience === "EMPLOYEE_TASK"
                ? TeamOptions
                : CompanionOptions
            }
            onAssigneeSelect={(option) => {
              if (formData.audience === "EMPLOYEE_TASK") {
                setFormData({
                  ...formData,
                  assignedTo: option.value,
                });
                return;
              }
              const companion = companions?.find(
                (c) => c.parentId === option.value,
              );
              if (companion) {
                setFormData({
                  ...formData,
                  companionId: companion.id,
                  assignedTo: option.value,
                });
              }
            }}
          />
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
      </div>
    </Modal>
  );
};

export default AddTask;
