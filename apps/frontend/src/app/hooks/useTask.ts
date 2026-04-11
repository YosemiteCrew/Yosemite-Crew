import { useEffect, useMemo } from "react";
import { useOrgStore } from "@/app/stores/orgStore";
import { loadTasksForPrimaryOrg } from "@/app/features/tasks/services/taskService";
import { Task } from "@/app/features/tasks/types/task";
import { useTaskStore } from "@/app/stores/taskStore";

export const useLoadTasksForPrimaryOrg = () => {
  const primaryOrgId = useOrgStore((s) => s.primaryOrgId);

  useEffect(() => {
    if (!primaryOrgId) return;
    void loadTasksForPrimaryOrg({ force: true });
  }, [primaryOrgId]);
};

export const useTasksForPrimaryOrg = (): Task[] => {
  const primaryOrgId = useOrgStore((s) => s.primaryOrgId);
  const tasksById = useTaskStore((s) => s.tasksById);

  const taskIdsByOrgId = useTaskStore((s) => s.taskIdsByOrgId);

  return useMemo(() => {
    if (!primaryOrgId) return [];
    const ids = taskIdsByOrgId[primaryOrgId] ?? [];
    return ids.map((id) => tasksById[id]).filter(Boolean);
  }, [primaryOrgId, tasksById, taskIdsByOrgId]);
};

export const useTasksAssignedToUser = (userId?: string): Task[] => {
  const primaryOrgId = useOrgStore((s) => s.primaryOrgId);
  const tasksById = useTaskStore((s) => s.tasksById);
  const taskIdsByOrgId = useTaskStore((s) => s.taskIdsByOrgId);

  return useMemo(() => {
    if (!primaryOrgId || !userId) return [];
    const ids = taskIdsByOrgId[primaryOrgId] ?? [];
    return ids
      .map((id) => tasksById[id])
      .filter(
        (task): task is Task =>
          Boolean(task) && task.assignedTo === userId
      );
  }, [primaryOrgId, userId, tasksById, taskIdsByOrgId]);
};
