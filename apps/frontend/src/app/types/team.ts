import { Speciality, UserOrganizationRequestDTO } from "@yosemite-crew/types";
import { BusinessType } from "./org";

export type EmploymentTypesProps = "FULL_TIME" | "PART_TIME" | "CONTRACTOR";

export type InviteStatusprops =
  | "PENDING"
  | "ACCEPTED"
  | "EXPIRED"
  | "CANCELLED";

export type TeamStatusProps =
  | "Consulting"
  | "Available"
  | "Off-Duty"
  | "Requested";

export type RoleProps =
  | "ADMIN"
  | "SUPERVISOR"
  | "VETERINARIAN"
  | "TECHNICIAN"
  | "ASSISTANT"
  | "RECEPTIONIST";

export type Invite = {
  _id: string;
  organisationId: string;
  organisationName: string;
  organisationType: BusinessType;
  invitedByUserId: string;
  departmentId: string;
  inviteeEmail: string;
  role: RoleProps;
  employmentType: EmploymentTypesProps;
  token: string;
  status: InviteStatusprops;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
};

export type Team = {
  _id: string;
  organisationId: string;
  name?: string;
  image?: string;
  role: string;
  speciality: Speciality;
  todayAppointment?: string;
  weeklyWorkingHours?: string;
  status: TeamStatusProps;
};

export type TeamAdd = {
  _id: string;
  organisationId: string;
  name?: string;
  image?: string;
  role: string;
  speciality: string;
  todayAppointment?: string;
  weeklyWorkingHours?: string;
  status: TeamStatusProps;
};

export type TeamResponse = {
  userOrganisation: UserOrganizationRequestDTO;
  name?: string;
  profileUrl?: string;
  speciality: Speciality;
  currentStatus: TeamStatusProps;
  weeklyHours?: string;
  count?: string;
};

export type TeamFormDataType = {
  email: string;
  speciality: {
    name: string;
    key: string;
  };
  role: string;
  type: string;
};
