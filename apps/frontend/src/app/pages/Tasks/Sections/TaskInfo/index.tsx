import EditableAccordion from "@/app/components/Accordion/EditableAccordion";
import Modal from "@/app/components/Modal";
import { useTeamForPrimaryOrg } from "@/app/hooks/useTeam";
import { Task } from "@/app/types/task";
import { Team } from "@/app/types/team";
import React, { useMemo } from "react";
import { IoIosCloseCircleOutline } from "react-icons/io";

type TaskInfoProps = {
  showModal: boolean;
  setShowModal: React.Dispatch<React.SetStateAction<boolean>>;
  activeTask: Task;
};

const TaskFields = [
  { label: "Task", key: "task", type: "text" },
  {
    label: "Category",
    key: "category",
    type: "text",
  },
  { label: "Description", key: "description", type: "text" },
  { label: "From", key: "assignedBy", type: "text", editable: false },
  { label: "To", key: "assignedTo", type: "text" },
  { label: "Due", key: "dueAt", type: "date" },
  {
    label: "Status",
    key: "status",
    type: "dropdown",
    options: ["PENDING", "IN_PROGRESS", "COMPLETED", "CANCELLED"],
  },
];

const TaskInfo = ({ showModal, setShowModal, activeTask }: TaskInfoProps) => {
  const teams = useTeamForPrimaryOrg();

  const memberMap = useMemo(() => {
    const map = new Map<string, string>();
    teams?.forEach((member: Team) => {
      map.set(member._id, member.name || "-");
    });
    return map;
  }, [teams]);

  const resolveMemberName = (id?: string) =>
    id ? (memberMap.get(id) ?? "-") : "-";

  const taskData = useMemo(
    () => ({
      ...activeTask,
      assignedBy: resolveMemberName(activeTask.assignedBy),
      assignedTo: resolveMemberName(activeTask.assignedTo),
    }),
    [activeTask, teams]
  );

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
            data={taskData}
            defaultOpen={true}
          />
        </div>
      </div>
    </Modal>
  );
};

export default TaskInfo;
