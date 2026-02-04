export type StatusStyle = {
  color: string;
  backgroundColor: string;
};

export type StatusLabel = {
  name: string;
  key: string;
  bg: string;
  text: string;
};

const statusStyles: Record<string, StatusStyle> = {
  no_payment: { color: "#fff", backgroundColor: "#5C614B" },
  in_progress: { color: "#fff", backgroundColor: "#BF9FAA" },
  completed: { color: "#fff", backgroundColor: "#D28F9A" },
  checked_in: { color: "#fff", backgroundColor: "#A8A181" },
  requested: { color: "#fff", backgroundColor: "#747283" },
  cancelled: { color: "#fff", backgroundColor: "#D9A488" },
  no_show: { color: "#fff", backgroundColor: "#747283" },
  pending: { color: "#fff", backgroundColor: "#747283" },
  upcoming: { color: "#000", backgroundColor: "#F1D4B0" },
};

const defaultStatusStyle: StatusStyle = { color: "#000", backgroundColor: "#F1D4B0" };

export const getStatusStyle = (status: string): StatusStyle => {
  return statusStyles[status?.toLowerCase()] ?? defaultStatusStyle;
};

export const AppointmentLabels: StatusLabel[] = [
  { name: "Requested", key: "requested", bg: "#747283", text: "#fff" },
  { name: "Upcoming", key: "upcoming", bg: "#F1D4B0", text: "#000" },
  { name: "Checked-in", key: "checked_in", bg: "#A8A181", text: "#fff" },
  { name: "In progress", key: "in_progress", bg: "#BF9FAA", text: "#fff" },
  { name: "Completed", key: "completed", bg: "#D28F9A", text: "#fff" },
  { name: "Cancelled", key: "cancelled", bg: "#D9A488", text: "#fff" },
];

export const TaskLabels: StatusLabel[] = [
  { name: "Pending", key: "pending", bg: "#747283", text: "#fff" },
  { name: "In progress", key: "in_progress", bg: "#BF9FAA", text: "#fff" },
  { name: "Completed", key: "completed", bg: "#D28F9A", text: "#fff" },
  { name: "Cancelled", key: "cancelled", bg: "#D9A488", text: "#fff" },
];
