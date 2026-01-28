import Accordion from "@/app/components/Accordion/Accordion";
import { Primary, Secondary } from "@/app/components/Buttons";
import Fallback from "@/app/components/Fallback";
import TaskFormFields from "@/app/components/Tasks/TaskFormFields";
import { PermissionGate } from "@/app/components/PermissionGate";
import { useTeamForPrimaryOrg } from "@/app/hooks/useTeam";
import {
  createTask,
  createTaskTemplate,
  getTaskLibrary,
  getTaskTemplatesForPrimaryOrg,
} from "@/app/services/taskService";
import { Option } from "@/app/types/companion";
import {
  EMPTY_TASK,
  TaskLibrary,
  Task as TaskProps,
  TaskTemplate,
} from "@/app/types/task";
import { applyUtcTime, generateTimeSlots } from "@/app/utils/date";
import { PERMISSIONS } from "@/app/utils/permissions";
import React, { useEffect, useMemo, useState } from "react";
import {
  applyTemplateToForm,
  buildTaskTemplate,
  toTemplateOptions,
  validateTaskForm,
} from "@/app/utils/taskForm";

const Task = () => {
  const teams = useTeamForPrimaryOrg();
  const [formData, setFormData] = useState<TaskProps>(EMPTY_TASK);
  const [due, setDue] = useState<Date | null>(new Date());
  const [dueTimeUtc, setDueTimeUtc] = useState("05:30");

  const [formDataErrors, setFormDataErrors] = useState<{
    name?: string;
    assignedTo?: string;
    category?: string;
    templateId?: string;
    libraryTaskId?: string;
  }>({});
  const [orgTemplates, setOrgTemplates] = useState<TaskTemplate[]>([]);
  const [libraryTemplates, setLibraryTemplates] = useState<TaskLibrary[]>([]);
  const [error, setError] = useState<string | null>(null);

  const timeSlots = useMemo(() => {
    return generateTimeSlots(15);
  }, []);

  useEffect(() => {
    if (!due) return;
    setFormData((prev) => ({
      ...prev,
      dueAt: dueTimeUtc ? applyUtcTime(due, dueTimeUtc) : due,
    }));
  }, [due, dueTimeUtc]);

  useEffect(() => {
    const load = async () => {
      if (
        formData.source !== "ORG_TEMPLATE" &&
        formData.source !== "YC_LIBRARY"
      )
        return;
      try {
        if (formData.source === "ORG_TEMPLATE") {
          const data = await getTaskTemplatesForPrimaryOrg();
          setOrgTemplates(data);
        } else if (formData.source === "YC_LIBRARY") {
          const data = await getTaskLibrary();
          setLibraryTemplates(data);
        }
      } catch (error) {
        console.log("Error loading templates:", error);
      }
    };
    load();
  }, [formData.source]);

  const TeamOptions = useMemo(
    () =>
      teams?.map((team) => ({
        label: team.name || team.practionerId || team._id,
        value: team.practionerId || team._id,
      })),
    [teams],
  );

  const TemplateOptions: Option[] = useMemo(() => {
    const list =
      formData.source === "ORG_TEMPLATE" ? orgTemplates : libraryTemplates;
    return toTemplateOptions(list);
  }, [formData.source, orgTemplates, libraryTemplates]);

  const handleCreate = async () => {
    const errors = validateTaskForm(formData);
    setFormDataErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }
    try {
      await createTask(formData);
      setFormData(EMPTY_TASK);
      setFormDataErrors({});
      setError(null);
    } catch (error) {
      console.log(error);
      setError("Failed to create task. Please try again.");
    }
  };

  const handleCreateTemplate = async () => {
    const errors = validateTaskForm(formData);
    delete errors.libraryTaskId;
    setFormDataErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }
    try {
      const template: TaskTemplate = buildTaskTemplate(formData);
      await createTaskTemplate(template);
      await createTask(formData);
      setFormData(EMPTY_TASK);
      setFormDataErrors({});
      setError(null);
    } catch (error) {
      console.log(error);
      setError("Failed to create task template. Please try again.");
    }
  };

  const selectTemplate = (templateId: string) => {
    let template;
    if (formData.source === "ORG_TEMPLATE") {
      template = orgTemplates.find((t) => t._id === templateId);
    } else if (formData.source === "YC_LIBRARY") {
      template = libraryTemplates.find((t) => t._id === templateId);
    }
    if (template) {
      setFormData((prev) => applyTemplateToForm(prev, template));
    }
  };

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
            templateOptions={TemplateOptions}
            timeSlots={timeSlots}
            due={due}
            setDue={setDue}
            dueTimeUtc={dueTimeUtc}
            setDueTimeUtc={setDueTimeUtc}
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

export default Task;
