import Accordion from "@/app/components/Accordion/Accordion";
import { Primary, Secondary } from "@/app/components/Buttons";
import Datepicker from "@/app/components/Inputs/Datepicker";
import Dropdown from "@/app/components/Inputs/Dropdown/Dropdown";
import FormDesc from "@/app/components/Inputs/FormDesc/FormDesc";
import FormInput from "@/app/components/Inputs/FormInput/FormInput";
import Modal from "@/app/components/Modal";
import { useCompanionsForPrimaryOrg } from "@/app/hooks/useCompanion";
import { useTeamForPrimaryOrg } from "@/app/hooks/useTeam";
import { createTask } from "@/app/services/taskService";
import { EMPTY_TASK, Task } from "@/app/types/task";
import { Icon } from "@iconify/react/dist/iconify.js";
import React, { useEffect, useMemo, useState } from "react";
import { IoIosCloseCircleOutline } from "react-icons/io";

const TaskSourceOptions = [
  { value: "YC_LIBRARY", label: "YC Library" },
  { value: "ORG_TEMPLATE", label: "Org Template" },
  { value: "CUSTOM", label: "Custom" },
];

const TaskTypeOptions = [
  { value: "EMPLOYEE_TASK", label: "Employee Task" },
  { value: "PARENT_TASK", label: "Parent Task" },
];

type AddTaskProps = {
  showModal: boolean;
  setShowModal: React.Dispatch<React.SetStateAction<boolean>>;
  showErrorTost: any;
};

const AddTask = ({ showModal, setShowModal, showErrorTost }: AddTaskProps) => {
  const teams = useTeamForPrimaryOrg();
  const companions = useCompanionsForPrimaryOrg();
  const [formData, setFormData] = useState<Task>(EMPTY_TASK);
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

  const Options = useMemo(() => {
    if (formData.audience === "EMPLOYEE_TASK") {
      return (
        teams?.map((team) => ({
          label: team.name || team._id,
          value: team._id,
        })) || []
      );
    }
    if (formData.audience === "PARENT_TASK") {
      return (
        companions?.map((companion) => ({
          label: companion.name,
          value: companion.parentId,
        })) || []
      );
    }
    return [];
  }, [formData.audience, teams, companions]);

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
      setShowModal(false);
      setFormData(EMPTY_TASK);
      setFormDataErrors({});
      showErrorTost({
        message: "Task created",
        errortext: "Success",
        iconElement: (
          <Icon
            icon="solar:check-circle-bold"
            width="20"
            height="20"
            color="#008F5D"
          />
        ),
        className: "CongratsBg",
      });
    } catch (error) {
      console.log(error);
      showErrorTost({
        message: "Error creating task",
        errortext: "Error",
        iconElement: (
          <Icon
            icon="solar:danger-triangle-bold"
            width="20"
            height="20"
            color="#EA3729"
          />
        ),
        className: "errofoundbg",
      });
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
    <Modal showModal={showModal} setShowModal={setShowModal}>
      <div className="px-4! py-8! flex flex-col h-full gap-6">
        <div className="flex items-center justify-between">
          <IoIosCloseCircleOutline
            size={28}
            color="#302f2e"
            className="opacity-0"
          />
          <div className="flex justify-center font-grotesk text-black-text font-medium text-[28px]">
            Add task
          </div>
          <IoIosCloseCircleOutline
            size={28}
            color="#302f2e"
            onClick={() => setShowModal(false)}
            className="cursor-pointer"
          />
        </div>

        <div className="flex flex-col gap-6 w-full flex-1 justify-between overflow-y-auto">
          <Accordion
            title="Add task"
            defaultOpen
            showEditIcon={false}
            isEditing={true}
          >
            <div className="flex flex-col gap-3">
              <Dropdown
                placeholder="Type"
                value={formData.audience}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    audience: e.value,
                  })
                }
                className="min-h-12!"
                dropdownClassName="top-[55px]! !h-fit"
                options={TaskTypeOptions}
                returnObject
              />
              <Dropdown
                placeholder="Source"
                value={formData.source}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    source: e.value,
                  })
                }
                className="min-h-12!"
                dropdownClassName="top-[55px]! !h-fit"
                options={TaskSourceOptions}
                returnObject
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
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
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
              <Dropdown
                placeholder="To"
                value={formData.assignedTo}
                onChange={(e) => {
                  if (formData.audience === "EMPLOYEE_TASK") {
                    setFormData({
                      ...formData,
                      assignedTo: e.value,
                    });
                  } else {
                    const companion = companions?.find((c) => c.id === e.value);
                    if (companion) {
                      setFormData({
                        ...formData,
                        companionId: companion.id,
                        assignedTo: e.value,
                      });
                    }
                  }
                }}
                error={formDataErrors.assignedTo}
                className="min-h-12!"
                options={Options}
                dropdownClassName="h-fit! max-h-[150px]!"
                returnObject
              />
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
      </div>
    </Modal>
  );
};

export default AddTask;
