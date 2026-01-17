import Accordion from "@/app/components/Accordion/Accordion";
import { Primary, Secondary } from "@/app/components/Buttons";
import Datepicker from "@/app/components/Inputs/Datepicker";
import LabelDropdown from "@/app/components/Inputs/Dropdown/LabelDropdown";
import FormDesc from "@/app/components/Inputs/FormDesc/FormDesc";
import FormInput from "@/app/components/Inputs/FormInput/FormInput";
import SelectLabel from "@/app/components/Inputs/SelectLabel";
import { useCompanionsForPrimaryOrg } from "@/app/hooks/useCompanion";
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
  TaskKind,
  TaskKindOptions,
  TaskLibrary,
  Task as TaskProps,
  TaskRecurrenceOptions,
  TaskTemplate,
} from "@/app/types/task";
import { applyUtcTime, generateTimeSlots } from "@/app/utils/date";
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

  const TemplateOptions: Option[] = useMemo(() => {
    const list =
      formData.source === "ORG_TEMPLATE" ? orgTemplates : libraryTemplates;
    return (list || []).map((t: any) => ({
      label: t.name || "Untitled template",
      value: t.id || t._id,
    }));
  }, [formData.source, orgTemplates, libraryTemplates]);

  const handleCreate = async () => {
    const errors: {
      name?: string;
      assignedTo?: string;
      category?: string;
      templateId?: string;
      libraryTaskId?: string;
    } = {};
    if (!formData.assignedTo)
      errors.assignedTo = "Please select a companion or staff";
    if (!formData.name) errors.name = "Name is required";
    if (!formData.category) errors.category = "Category is required";
    if (formData.source === "ORG_TEMPLATE" && !formData.templateId) {
      errors.templateId = "Template is required";
    }
    if (formData.source === "YC_LIBRARY" && !formData.libraryTaskId) {
      errors.libraryTaskId = "Library task is required";
    }
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
    const errors: {
      name?: string;
      assignedTo?: string;
      category?: string;
      templateId?: string;
    } = {};
    if (!formData.assignedTo)
      errors.assignedTo = "Please select a companion or staff";
    if (!formData.name) errors.name = "Name is required";
    if (!formData.category) errors.category = "Category is required";
    if (formData.source === "ORG_TEMPLATE" && !formData.templateId) {
      errors.templateId = "Template is required";
    }
    setFormDataErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }
    try {
      const template: TaskTemplate = {
        _id: "",
        source: "ORG_TEMPLATE",
        category: formData.category,
        name: formData.name,
        description: formData.description,
        defaultRole:
          formData.audience === "EMPLOYEE_TASK" ? "EMPLOYEE" : "PARENT",
        isActive: true,
        organisationId: "",
        createdBy: "",
        kind: formData.category as TaskKind,
      };
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
      setFormData((prev) => ({
        ...prev,
        category: template.kind,
        name: template.name || "",
        description:
          (template as TaskTemplate).description ||
          (template as TaskLibrary).defaultDescription ||
          "",
      }));
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
                assignedTo: "",
                companionId: undefined,
              })
            }
            defaultOption={formData.audience}
            options={TaskTypeOptions}
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
                const companion = companions?.find(
                  (c) => c.parentId === option.value
                );
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
          <LabelDropdown
            placeholder="Source"
            onSelect={(option) => {
              setFormData({
                ...formData,
                source: option.value as any,
                templateId: undefined,
                libraryTaskId: undefined,
                name: "",
                description: "",
                category: "CUSTOM",
              });
            }}
            defaultOption={formData.source}
            options={TaskSourceOptions}
          />
          {formData.source === "YC_LIBRARY" && (
            <LabelDropdown
              placeholder={"Template"}
              onSelect={(option) => {
                setFormData({
                  ...formData,
                  libraryTaskId: option.value,
                });
                selectTemplate(option.value);
              }}
              defaultOption={formData.libraryTaskId}
              options={TemplateOptions}
              error={formDataErrors.libraryTaskId}
            />
          )}
          {formData.source === "ORG_TEMPLATE" && (
            <LabelDropdown
              placeholder={"Template"}
              onSelect={(option) => {
                setFormData({
                  ...formData,
                  templateId: option.value,
                });
                selectTemplate(option.value);
              }}
              defaultOption={formData.templateId}
              options={TemplateOptions}
              error={formDataErrors.templateId}
            />
          )}
          <LabelDropdown
            placeholder={"Category"}
            onSelect={(option) =>
              setFormData({
                ...formData,
                category: option.value,
              })
            }
            defaultOption={formData.category}
            options={TaskKindOptions}
            error={formDataErrors.category}
          />
          <FormInput
            intype="text"
            inname="task"
            value={formData.name}
            inlabel="Task"
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            error={formDataErrors.name}
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
          <Datepicker
            currentDate={due}
            setCurrentDate={setDue}
            placeholder="Due date"
            type="input"
          />
          <LabelDropdown
            placeholder="Due time"
            onSelect={(option) => {
              setDueTimeUtc(option.value);
            }}
            defaultOption={dueTimeUtc}
            options={timeSlots}
          />
          <FormInput
            intype="number"
            inname="reminder"
            value={String(formData.reminder?.offsetMinutes) || ""}
            inlabel="Reminder (in minutes)"
            onChange={(e) => {
              const raw = e.target.value;
              if (raw === "") {
                setFormData({
                  ...formData,
                  reminder: undefined,
                });
                return;
              }
              const value = Number.parseInt(raw, 10);
              if (!Number.isFinite(value) || value === 0) return;
              setFormData({
                ...formData,
                reminder: {
                  enabled: true,
                  offsetMinutes: value,
                },
              });
            }}
          />
          <SelectLabel
            title="Reoccurrence"
            options={TaskRecurrenceOptions}
            activeOption={formData.recurrence?.type || "ONCE"}
            setOption={(value) =>
              setFormData({
                ...formData,
                recurrence: {
                  ...formData.recurrence,
                  type: value,
                  isMaster: false,
                },
              })
            }
          />
        </div>
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
  );
};

export default Task;
