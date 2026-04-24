export type StatusStyle = {
  color: string;
  backgroundColor: string;
  borderColor: string;
};

export type StatusLabel = {
  name: string;
  key: string;
  bg: string;
  text: string;
  border: string;
};

const statusStyles: Record<string, StatusStyle> = {
  no_payment: { color: '#9a3412', backgroundColor: '#fff7ed', borderColor: '#f97316' },
  in_progress: { color: '#5b21b6', backgroundColor: '#f5f3ff', borderColor: '#8b5cf6' },
  completed: { color: '#166534', backgroundColor: '#f0fdf4', borderColor: '#64c487' },
  checked_in: { color: '#3730a3', backgroundColor: '#eef2ff', borderColor: '#6366f1' },
  requested: { color: '#5c5956', backgroundColor: '#f5f3f1', borderColor: '#a9a39e' },
  cancelled: { color: '#9a3412', backgroundColor: '#fff7ed', borderColor: '#f97316' },
  no_show: { color: '#9a3412', backgroundColor: '#fff7ed', borderColor: '#f97316' },
  pending: { color: '#5c5956', backgroundColor: '#f5f3f1', borderColor: '#a9a39e' },
  upcoming: { color: '#0057c2', backgroundColor: '#e6f2ff', borderColor: '#007cf5' },
};

const defaultStatusStyle: StatusStyle = {
  color: '#5c5956',
  backgroundColor: '#f5f3f1',
  borderColor: '#a9a39e',
};

export const getStatusStyle = (status: string): StatusStyle => {
  return statusStyles[status?.toLowerCase()] ?? defaultStatusStyle;
};

export const AppointmentLabels: StatusLabel[] = [
  { name: 'Requested', key: 'requested', bg: '#f5f3f1', text: '#5c5956', border: '#a9a39e' },
  { name: 'Upcoming', key: 'upcoming', bg: '#e6f2ff', text: '#0057c2', border: '#007cf5' },
  { name: 'Checked-in', key: 'checked_in', bg: '#eef2ff', text: '#3730a3', border: '#6366f1' },
  { name: 'In progress', key: 'in_progress', bg: '#f5f3ff', text: '#5b21b6', border: '#8b5cf6' },
  { name: 'Completed', key: 'completed', bg: '#f0fdf4', text: '#166534', border: '#64c487' },
  { name: 'Cancelled', key: 'cancelled', bg: '#fff7ed', text: '#9a3412', border: '#f97316' },
];

export const TaskLabels: StatusLabel[] = [
  { name: 'Pending', key: 'pending', bg: '#f5f3f1', text: '#5c5956', border: '#a9a39e' },
  { name: 'In progress', key: 'in_progress', bg: '#f5f3ff', text: '#5b21b6', border: '#8b5cf6' },
  { name: 'Completed', key: 'completed', bg: '#f0fdf4', text: '#166534', border: '#64c487' },
  { name: 'Cancelled', key: 'cancelled', bg: '#fff7ed', text: '#9a3412', border: '#f97316' },
];
