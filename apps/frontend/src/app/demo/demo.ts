import { InviteProps } from "../types/org";
import { Organisation } from "@yosemite-crew/types";

export const demoOrgs: Organisation[] = [
  {
    _id: "1",
    isActive: false,
    isVerified: false,
    name: "Paws & Tails Health Club",
    type: "HOSPITAL",
    phoneNo: "",
    taxId: ""
  },
  {
    _id: "2",
    isActive: false,
    isVerified: true,
    name: "Paws & Tails Health Club",
    type: "HOSPITAL",
    phoneNo: "",
    taxId: ""
  },
  {
    _id: "3",
    isActive: true,
    isVerified: true,
    name: "Paws & Tails Health Club",
    type: "BOARDER",
    phoneNo: "",
    taxId: ""
  },
];

export const demoInvites: InviteProps[] = [
  {
    id: "1",
    name: "Paws & Tails Health Club",
    type: "Hospital",
    role: "Vet",
    employmentType: "Full time",
  },
  {
    id: "2",
    name: "Paws & Tails Health Club",
    type: "Hospital",
    role: "Nurse",
    employmentType: "Part time",
  },
];
