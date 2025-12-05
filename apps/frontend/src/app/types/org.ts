export type BusinessType = "HOSPITAL" | "BREEDER" | "BOARDER" | "GROOMER";

export const RolesByBusinessType: string[] = [
  "Owner",
  "Admin",
  "Veterinarian",
  "Technician",
  "Supervisor",
  "Assistant",
  "Receptionist",
  "Groomer"
];

export type Org = {
  id: string;
  name: string;
  type: BusinessType;
  isActive: boolean;
  isVerified: boolean;
  specialities?: Speciality[];
};

export type Membership = {
  orgId: string;
  role: string;
  permissions?: string[];
};

export type OrgWithMembership = Org & {
  membership: Membership;
};

export type Speciality = {
  name: string;
  head?: string;
  staff?: string[];
  services?: Service[];
};

export type Service = {
  name: string;
  description?: string;
  duration?: number;
  charge?: number;
  maxDiscount?: number;
};
