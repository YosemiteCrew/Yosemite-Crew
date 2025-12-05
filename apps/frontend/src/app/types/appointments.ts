export type Status =
  | "Requested"
  | "Upcoming"
  | "Checked-in"
  | "In-progress"
  | "Completed"
  | "Cancelled"
  | "Post-care";

export type AppointmentsProps = {
  name: string;
  parentName: string;
  image: string;
  reason: string;
  emergency: boolean;
  service: string;
  room: string;
  time: string;
  date: string;
  lead: string;
  leadDepartment: string;
  support: string[];
  status: Status;
  breed: string;
  species: string;
};
