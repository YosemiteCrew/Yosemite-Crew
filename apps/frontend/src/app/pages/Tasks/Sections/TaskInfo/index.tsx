import EditableAccordion from "@/app/components/Accordion/EditableAccordion";
import Modal from "@/app/components/Modal";
import { TasksProps } from "@/app/types/tasks";
import React from "react";
import { IoIosCloseCircleOutline } from "react-icons/io";

type TaskInfoProps = {
  showModal: boolean;
  setShowModal: React.Dispatch<React.SetStateAction<boolean>>;
  activeTask: TasksProps;
};

const TaskFields = [
  { label: "Task", key: "task", type: "text" },
  {
    label: "Category",
    key: "category",
    type: "select",
    options: ["Custom", "Template", "Library"],
  },
  { label: "Description", key: "description", type: "text" },
  { label: "From", key: "from", type: "text" },
  { label: "To", key: "to", type: "text" },
  { label: "Due", key: "due", type: "date" },
  { label: "Status", key: "status", type: "text" },
];

const TaskInfo = ({ showModal, setShowModal, activeTask }: TaskInfoProps) => {
  return (
    <Modal showModal={showModal} setShowModal={setShowModal}>
      <div className="px-4! py-8! flex flex-col h-full gap-6">
        <div className="flex justify-between">
          <IoIosCloseCircleOutline
            size={28}
            color="#302f2e"
            className="opacity-0"
          />
          <div className="flex justify-center font-grotesk text-black-text font-medium text-[28px]">
            View task
          </div>
          <IoIosCloseCircleOutline
            size={28}
            color="#302f2e"
            onClick={() => setShowModal(false)}
            className="cursor-pointer"
          />
        </div>
        <div className="flex overflow-y-auto flex-1">
          <EditableAccordion
            key={"task-key"}
            title={"Task details"}
            fields={TaskFields}
            data={activeTask}
            defaultOpen={true}
          />
        </div>
      </div>
    </Modal>
  );
};

export default TaskInfo;
