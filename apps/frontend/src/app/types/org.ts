import {
  Organisation,
  ServiceRequestDTO,
  SpecialityRequestDTO,
  UserOrganization,
} from "@yosemite-crew/types";

export type BusinessType = "HOSPITAL" | "BREEDER" | "BOARDER" | "GROOMER";

export const BusinessTypes: BusinessType[] = [
  "HOSPITAL",
  "BREEDER",
  "BOARDER",
  "GROOMER",
];

export const RolesByBusinessType: string[] = [
  "Owner",
  "Admin",
  "Veterinarian",
  "Technician",
  "Supervisor",
  "Assistant",
  "Receptionist",
  "Groomer",
];

export type OrgWithMembership = {
  org: Organisation;
  membership: UserOrganization | null;
};

export type SpecialityWithServices = {
  speciality: SpecialityRequestDTO;
  services: ServiceRequestDTO[];
};

export type InviteProps = {
  id: string;
  name: string;
  type: string;
  role: string;
  employmentType: string;
};

export type Speciality = {
  name: string;
  head?: string;
  staff?: string[];
  services?: ServiceWeb[];
};

export type ServiceWeb = {
  name: string;
  description?: string;
  duration?: number;
  charge?: number;
  maxDiscount?: number;
};
