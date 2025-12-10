import Accordion from "@/app/components/Accordion/Accordion";
import { Primary, Secondary } from "@/app/components/Buttons";
import { LeadOptions } from "@/app/components/CompanionInfo/Sections/AddAppointment";
import Datepicker from "@/app/components/Inputs/Datepicker";
import Dropdown from "@/app/components/Inputs/Dropdown/Dropdown";
import FormDesc from "@/app/components/Inputs/FormDesc/FormDesc";
import FormInput from "@/app/components/Inputs/FormInput/FormInput";
import Modal from "@/app/components/Modal";
import React, { useState } from "react";
import { IoIosCloseCircleOutline } from "react-icons/io";

const CategoryOptions = ["Custom", "Template", "Library"];

type AddTaskProps = {
  showModal: boolean;
  setShowModal: React.Dispatch<React.SetStateAction<boolean>>;
};

type FormDataType = {
  category: string;
  task: string;
  description: string;
  from: string;
  to: string;
  reminders: string[];
};

const AddTask = ({ showModal, setShowModal }: AddTaskProps) => {
  const [formData, setFormData] = useState<FormDataType>({
    category: "Custom",
    task: "",
    description: "",
    from: "",
    to: "",
    reminders: [],
  });
  const [due, setDue] = useState(new Date());
  const [formDataErrors] = useState<{
    task?: string;
    to?: string;
  }>({});

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
                placeholder="Category"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e })}
                className="min-h-12!"
                dropdownClassName="top-[55px]! !h-fit"
                options={CategoryOptions}
              />
              <FormInput
                intype="text"
                inname="task"
                value={formData.task}
                inlabel="Task"
                onChange={(e) =>
                  setFormData({ ...formData, task: e.target.value })
                }
                error={formDataErrors.task}
                className="min-h-12!"
              />
              <FormDesc
                intype="text"
                inname="description"
                value={formData.description}
                inlabel="Description (optional)"
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                className="min-h-[120px]!"
              />
              <Dropdown
                placeholder="From"
                value={formData.from}
                onChange={(e) => setFormData({ ...formData, from: e })}
                className="min-h-12!"
                dropdownClassName="top-[55px]! !h-fit"
                options={LeadOptions}
              />
              <Dropdown
                placeholder="To"
                value={formData.to}
                onChange={(e) => setFormData({ ...formData, to: e })}
                error={formDataErrors.to}
                className="min-h-12!"
                dropdownClassName="top-[55px]! !h-fit"
                options={LeadOptions}
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
            <Secondary href="#" text="Save as template" className="h-13!" />
            <Primary href="#" text="Save" classname="h-13!" />
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default AddTask;
