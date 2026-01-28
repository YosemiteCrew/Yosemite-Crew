import { Primary, Secondary } from "@/app/components/Buttons";
import Close from "@/app/components/Icons/Close";
import TaskFormFields from "@/app/components/Tasks/TaskFormFields";
import Modal from "@/app/components/Modal";
import {
  createTask,
  createTaskTemplate,
  getTaskLibrary,
  getTaskTemplatesForPrimaryOrg,
} from "@/app/services/taskService";
import { Option } from "@/app/types/companion";
import {
  EMPTY_COMPANION_TASK,
  Task,
  TaskLibrary,
  TaskTemplate,
} from "@/app/types/task";
import { applyUtcTime, generateTimeSlots } from "@/app/utils/date";
import React, { useEffect, useMemo, useState } from "react";
import { CompanionParent } from "./types";
import {
  applyTemplateToForm,
  buildTaskTemplate,
  toTemplateOptions,
  validateTaskForm,
} from "@/app/utils/taskForm";

type AddTaskProps = {
  showModal: boolean;
  setShowModal: React.Dispatch<React.SetStateAction<boolean>>;
  activeCompanion: CompanionParent;
};

const AddTask = ({ showModal, setShowModal, activeCompanion }: AddTaskProps) => {
  const [formData, setFormData] = useState<Task>(EMPTY_COMPANION_TASK);
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
    if (!showModal) return;
    setFormData({
      ...EMPTY_COMPANION_TASK,
      companionId: activeCompanion.companion.id,
      assignedTo: activeCompanion.parent.id,
    });
    setFormDataErrors({});
  }, [showModal, activeCompanion]);

  useEffect(() => {
    if (!due) return;
    setFormData((prev) => ({
      ...prev,
      dueAt: dueTimeUtc ? applyUtcTime(due, dueTimeUtc) : due,
    }));
  }, [due, dueTimeUtc]);

  useEffect(() => {
    if (!showModal) return;

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
  }, [showModal, formData.source]);

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
      setFormData(EMPTY_COMPANION_TASK);
      setFormDataErrors({});
      setError(null);
      setShowModal(false);
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
      setFormData(EMPTY_COMPANION_TASK);
      setFormDataErrors({});
      setError(null);
      setShowModal(false);
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
            templateOptions={TemplateOptions}
            timeSlots={timeSlots}
            due={due}
            setDue={setDue}
            dueTimeUtc={dueTimeUtc}
            setDueTimeUtc={setDueTimeUtc}
            onSelectTemplate={selectTemplate}
          />
        </div>
        <div className="flex justify-end items-end gap-3 w-full flex-col">
          {error && <div className="text-red-600 text-sm text-center">{error}</div>}
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
    </Modal>
  );
};

export default AddTask;
