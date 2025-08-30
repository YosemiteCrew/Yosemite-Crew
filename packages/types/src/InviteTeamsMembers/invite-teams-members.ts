export type TeamInviteMember = {
  bussinessId:string;
  department: string;
  role: string;
  name:string;
  email: string;
  invitedBy: string; 
  invitedAt?: Date;
  inviteCode?: string; // Optional, can be generated later
  status?: "pending" | "accepted" | "declined"; // Default is "pending"
};

export interface InvitePayload {
  name: string;
  email: string;
  role: string;
  department: string;
  invitedBy: string;
};


export type InviteItem = {
  _id: string;
  email: string;
  department: string;
  role: string;
  invitedBy: string;
  inviteCode: string;
  status: string;
  invitedAt: string; // ISO string
  invitedByName: string;
  invitedAtFormatted?: string;
  name?: string;
  bussinessId?: string;
  departmentId?: string; // Optional, can be used for filtering
};

export type InviteCard = {
  name?: string;
  email?: string;
  specialize?: string;
  inviteon?: string;
  inviteby?: string;
  status?: string;
  action?: string;
};


export type TeamOverview = {
  totalWebUsers: number;
  onDutyCount: number;
  departmentCount: number;
  invitedCount: number;
};

export type FhirTeamOverview = {
  resourceType: "Observation";
  id: string;
  status: "final";
  code: {
    text: "Team Overview Summary";
  };
  component: Array<{
    code: { text: string };
    valueInteger: number;
  }>;
};




export type WebUserType = {
    _id: string;
    cognitoId: string;
    bussinessId: string;
    businessType?: string;
    role?: string;
    department?: string;
    doctorsInfo?: DoctorType[];
    image?: string;
    documents?: { name?: string; url?: string }[];
};

export type DoctorType = {
    image?: string;
    documents?: { name: string; url: string }[];
    [key: string]: any;
};




export type AvailabilityTime = {
  from: { hour: string; minute: string; period: string };
  to: { hour: string; minute: string; period: string };
  _id?: string;
};

export type AvailabilityDay = {
  day: string;
  times: AvailabilityTime[];
  _id?: string;
};

export type DocumentItem = {
  name: string;
  type: string;
  date: string;
  _id?: string;
};

export type TeamMember = {
  _id: string;
  userId: string;
  role: string;
  department: string;
  bussinessId: string;
  registrationNumber: string;
  addressLine1: string;
  availability: AvailabilityDay[];
  biography: string;
  city: string;
  countrycode: string;
  dateOfBirth: string;
  documents: DocumentItem[];
  duration: string;
  email: string;
  firstName: string;
  gender: string;
  image: string;
  lastName: string;
  linkedin: string;
  medicalLicenseNumber: string;
  mobileNumber: string;
  postalCode: string;
  specialization: string;
  stateProvince: string;
  area: string;
  status: string;
};



export type DepartmentsForInvite = {
  _id: string;
  name: string;
};

// types.ts
export type PractitionerData = {
  cognitoId: string;
  name: string;
  departmentName: string;
  image: string;
  status: string;
  weekWorkingHours: number;
  specialization: string;
  yearsOfExperience: number;
  email: string;
  mobileNumber: string;
};
