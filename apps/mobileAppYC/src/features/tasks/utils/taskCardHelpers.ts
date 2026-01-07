import type {User} from '@/features/auth/types';
import type {Task} from '@/features/tasks/types';

export type TaskCardMeta = {
  isPending: boolean;
  isCompleted: boolean;
  assignedToData?: {
    avatar?: string;
    name: string;
  };
  isObservationalToolTask: boolean;
};

export const getTaskCardMeta = (task: Task, authUser: User | null | undefined): TaskCardMeta => {
  const statusUpper = String(task.status).toUpperCase();
  const isPending = statusUpper === 'PENDING';
  const isCompleted = statusUpper === 'COMPLETED';

  const selfId = authUser?.parentId ?? authUser?.id;
  const assignedToData =
    task.assignedTo === selfId
      ? {
          avatar: authUser?.profilePicture ?? undefined,
          name: authUser?.firstName || 'User',
        }
      : undefined;

  const isObservationalToolTask =
    task.category === 'health' &&
    task.details &&
    'taskType' in task.details &&
    task.details.taskType === 'take-observational-tool';

  return {
    isPending,
    isCompleted,
    assignedToData,
    isObservationalToolTask,
  };
};
