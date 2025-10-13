export type AdminDepartmentItem = {
  _id: string;
  name: string;
};

export type AdminFHIRHealthcareService = {
  resourceType: "HealthcareService";
  id: string;
  name: string;
};
