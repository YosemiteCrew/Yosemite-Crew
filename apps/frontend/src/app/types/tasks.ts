export type Status = "Upcoming" | "In-progress" | "Completed";

export type TasksProps = {
  task: string;
  description: string;
  category: string;
  from: string;
  to: string;
  toLabel: string;
  due: string;
  status: Status;
};
