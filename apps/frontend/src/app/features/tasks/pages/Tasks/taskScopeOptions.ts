/**
 * Assignee scope: whose tasks, as against the audience chips beside it, which say
 * who the task is for. It is a segmented control rather than a chip to mark that
 * difference, but shape alone was not enough - the audience chip for
 * `employee_task` was also called "Team", so two adjacent buttons in the same
 * toolbar carried the same word. That chip is "Staff" now (../../types/task.ts).
 *
 * Lifted out of the page component so the guard in TaskFilterBar.test.tsx can
 * compare these names against the audience labels without importing the page.
 *
 * "My tasks" narrows every view to the tasks assigned to the signed-in member.
 */
export const TASK_SCOPE_OPTIONS = [
  { key: 'mine', name: 'My tasks' },
  { key: 'team', name: 'Team' },
];
