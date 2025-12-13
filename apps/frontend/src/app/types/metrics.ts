export type DashboardSummary = {
  revenue: number;
  appointments: number;
  tasks: number;
  staffOnDuty: number;
};

export const EMPTY_EXPLORE: DashboardSummary = {
  revenue: 0,
  appointments: 0,
  tasks: 0,
  staffOnDuty: 0,
};
