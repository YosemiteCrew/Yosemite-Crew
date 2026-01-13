import Accordion from "@/app/components/Accordion/Accordion";
import { Primary, Secondary } from "@/app/components/Buttons";
import Datepicker from "@/app/components/Inputs/Datepicker";
import LabelDropdown from "@/app/components/Inputs/Dropdown/LabelDropdown";
import FormDesc from "@/app/components/Inputs/FormDesc/FormDesc";
import FormInput from "@/app/components/Inputs/FormInput/FormInput";
import { useCompanionsForPrimaryOrg } from "@/app/hooks/useCompanion";
import { useTeamForPrimaryOrg } from "@/app/hooks/useTeam";
import { createTask } from "@/app/services/taskService";
import { EMPTY_TASK, Task as TaskProps } from "@/app/types/task";
import React, { useEffect, useMemo, useState } from "react";

const TaskSourceOptions = [
  { value: "YC_LIBRARY", label: "YC Library" },
  { value: "ORG_TEMPLATE", label: "Org Template" },
  { value: "CUSTOM", label: "Custom" },
];

const TaskTypeOptions = [
  { value: "EMPLOYEE_TASK", label: "Employee Task" },
  { value: "PARENT_TASK", label: "Parent Task" },
];

const Task = () => {
  const teams = useTeamForPrimaryOrg();
  const companions = useCompanionsForPrimaryOrg();
  const [formData, setFormData] = useState<TaskProps>(EMPTY_TASK);
  const [due, setDue] = useState<Date | null>(new Date());
  const [formDataErrors, setFormDataErrors] = useState<{
    name?: string;
    assignedTo?: string;
    category?: string;
  }>({});

  useEffect(() => {
    if (due) {
      setFormData((prev) => ({
        ...prev,
        dueAt: due,
      }));
    }
  }, [due]);

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
        label: team.name || team._id,
        value: team._id,
      })),
    [teams]
  );

  const handleCreate = async () => {
    const errors: {
      name?: string;
      assignedTo?: string;
      category?: string;
    } = {};
    if (!formData.assignedTo)
      errors.assignedTo = "Please select a companion or staff";
    if (!formData.name) errors.name = "Name is required";
    if (!formData.category) errors.category = "Category is required";
    setFormDataErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }
    try {
      await createTask(formData);
      setFormData(EMPTY_TASK);
      setFormDataErrors({});
    } catch (error) {
      console.log(error);
    }
  };

  const handleCreateTemplate = async () => {
    try {
      console.log(formData);
    } catch (error) {
      console.log(error);
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full flex-1 justify-between overflow-y-auto">
      <Accordion title="Task" defaultOpen showEditIcon={false} isEditing={true}>
        <div className="flex flex-col gap-3">
          <LabelDropdown
            placeholder="Type"
            onSelect={(option) =>
              setFormData({
                ...formData,
                audience: option.value as any,
              })
            }
            defaultOption={formData.audience}
            options={TaskTypeOptions}
          />
          <LabelDropdown
            placeholder="Source"
            onSelect={(option) =>
              setFormData({
                ...formData,
                source: option.value as any,
              })
            }
            defaultOption={formData.source}
            options={TaskSourceOptions}
          />
          <FormInput
            intype="text"
            inname="Category"
            value={formData.category}
            inlabel="Category"
            onChange={(e) =>
              setFormData({ ...formData, category: e.target.value })
            }
            error={formDataErrors.category}
            className="min-h-12!"
          />
          <FormInput
            intype="text"
            inname="task"
            value={formData.name}
            inlabel="Task"
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            error={formDataErrors.name}
            className="min-h-12!"
          />
          <FormDesc
            intype="text"
            inname="description"
            value={formData.description || ""}
            inlabel="Description (optional)"
            onChange={(e) =>
              setFormData({ ...formData, description: e.target.value })
            }
            className="min-h-[120px]!"
          />
          {formData.audience === "EMPLOYEE_TASK" ? (
            <LabelDropdown
              placeholder="To"
              onSelect={(option) =>
                setFormData({
                  ...formData,
                  assignedTo: option.value,
                })
              }
              defaultOption={formData.assignedTo}
              error={formDataErrors.assignedTo}
              options={TeamOptions}
            />
          ) : (
            <LabelDropdown
              placeholder="To"
              onSelect={(option) => {
                const companion = companions?.find((c) => c.id === option.value);
                if (companion) {
                  setFormData({
                    ...formData,
                    companionId: companion.id,
                    assignedTo: option.value,
                  });
                }
              }}
              defaultOption={formData.assignedTo}
              error={formDataErrors.assignedTo}
              options={CompanionOptions}
            />
          )}
          <Datepicker
            currentDate={due}
            setCurrentDate={setDue}
            placeholder="Due date"
            type="input"
          />
        </div>
      </Accordion>
      <div className="flex flex-col gap-2">
        <Secondary
          href="#"
          text="Save as template"
          className="h-13!"
          onClick={handleCreateTemplate}
        />
        <Primary
          href="#"
          text="Save"
          classname="h-13!"
          onClick={handleCreate}
        />
      </div>
    </div>
  );
};

export default Task;
