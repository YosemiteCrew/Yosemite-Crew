import { AdminDepartmentItem, AdminFHIRHealthcareService } from "@yosemite-crew/types";

export const convertFHIRToAdminDepartments = (
  fhirList: AdminFHIRHealthcareService[]
): AdminDepartmentItem[] => {
  return fhirList.map((item) => ({
    _id: item.id,
    name: item.name,
  }));
};
