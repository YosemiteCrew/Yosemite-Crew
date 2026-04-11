import { Service, Speciality } from "@yosemite-crew/types";

export type SpecialityWeb = Omit<Speciality, "services"> & {
  services?: Service[];
};