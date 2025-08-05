import { AdminDepartmentItem, AdminFHIRHealthcareService } from "@yosemite-crew/types";

export const convertAdminDepartmentsToFHIR = (
  departments: AdminDepartmentItem[]
): AdminFHIRHealthcareService[] => {
  return departments.map((dept) => ({
    resourceType: "HealthcareService",
    id: dept._id,
    name: dept.name,
  }));
};


export const convertFHIRToAdminDepartments = (
  fhirList: AdminFHIRHealthcareService[]
): AdminDepartmentItem[] => {
  return fhirList.map((item) => ({
    _id: item.id,
    name: item.name,
  }));
};
