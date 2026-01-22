import EditableAccordion from "@/app/components/Accordion/EditableAccordion";
import Close from "@/app/components/Icons/Close";
import Modal from "@/app/components/Modal";
import { usePermissions } from "@/app/hooks/usePermissions";
import { useTeamForPrimaryOrg } from "@/app/hooks/useTeam";
import { updateTask } from "@/app/services/taskService";
import { Task, TaskKindOptions, TaskStatusOptions } from "@/app/types/task";
import { Team } from "@/app/types/team";
import { PERMISSIONS } from "@/app/utils/permissions";
import React, { useMemo } from "react";

type TaskInfoProps = {
  showModal: boolean;
  setShowModal: React.Dispatch<React.SetStateAction<boolean>>;
  activeTask: Task;
};

const TaskFields = [
  { label: "Task", key: "name", type: "text", required: true },
  {
    label: "Category",
    key: "category",
    type: "select",
    options: TaskKindOptions,
    required: true,
  },
  { label: "Description", key: "description", type: "text" },
  { label: "From", key: "assignedBy", type: "text", editable: false },
  { label: "To", key: "assignedTo", type: "text", editable: false },
  { label: "Due date", key: "dueAt", type: "date" },
  {
    label: "Status",
    key: "status",
    type: "select",
    options: TaskStatusOptions,
  },
];

const TaskInfo = ({ showModal, setShowModal, activeTask }: TaskInfoProps) => {
  const teams = useTeamForPrimaryOrg();
  const { can } = usePermissions();
  const canEditTasks = can(PERMISSIONS.TASKS_EDIT_ANY);

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
    [activeTask, teams],
  );

  const handleUpdate = async (values: any) => {
    try {
      const payload: Task = {
        ...activeTask,
        name: values.name,
        description: values.description,
        category: values.category,
        dueAt: new Date(values.dueAt),
        status: values.status,
      };
      await updateTask(payload);
      setShowModal(false);
    } catch (error) {
      console.log(error);
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
            <div className="text-body-1 text-text-primary">View task</div>
          </div>
          <Close onClick={() => setShowModal(false)} />
        </div>
        <div className="flex overflow-y-auto flex-1 scrollbar-hidden">
          <EditableAccordion
            key={"task-key"}
            title={"Task details"}
            fields={TaskFields}
            data={taskData}
            defaultOpen={true}
            onSave={(values) => handleUpdate(values)}
            showEditIcon={canEditTasks}
          />
        </div>
      </div>
    </Modal>
  );
};

export default TaskInfo;
