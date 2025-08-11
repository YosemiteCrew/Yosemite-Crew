import {  DepartmentCustomFormat, FHIRDepartment, FHIRHealthcareService, NormalDepartment } from "@yosemite-crew/types";

export function convertDepartmentFromFHIR(fhir: FHIRDepartment): DepartmentCustomFormat {
  const phoneValue = fhir.telecom?.find((t) => t.system === "phone")?.value || "";
  return {
    departmentId: fhir.id,
    bussinessId: fhir.providedBy?.reference?.split("/")[1] || "",
    phone: phoneValue.split(" ")[1],               // assumes last 7 digits are phone
    countrycode: phoneValue.split(" ")[0],
    email: fhir.telecom?.find((t) => t.system === "email")?.value || "",
    biography: fhir.extension?.find((e) => e.url === "biography")?.valueString || "",
    departmentHeadId: fhir.extension?.find((e) => e.url === "departmentHeadId")?.valueString || "",
    services: fhir.serviceType?.map((s) => s.type.text) || [],
  };
}

export function convertToFHIRDepartment(data: DepartmentCustomFormat): FHIRDepartment {
  return {
    resourceType: "HealthcareService",
    id: data.departmentId,
    providedBy: {
      reference: `Organization/${data.bussinessId}`,
    },
    telecom: [
      {
        system: "phone",
        value: `${data.countrycode} ${data.phone}`,
      },
      {
        system: "email",
        value: data.email,
      },
    ],
    extension: [
      {
        url: "biography",
        valueString: data.biography,
      },
      {
        url: "departmentHeadId",
        valueString: data.departmentHeadId,
      },
    ],
    serviceType: data.services.map((service) => ({
      type: {
        text: service,
      },
    })),
  };
}




  // <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<For only departmentName>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> 

 export function convertDepartmentsToFHIR(departments: NormalDepartment[]): FHIRHealthcareService[] {
  return departments.map((dept) => ({
    resourceType: "HealthcareService",
    id: dept._id,
    name: dept.name.trim(),
  }));
}


export function convertDepartmentsFromFHIR(fhirResources: FHIRHealthcareService[]): NormalDepartment[] {
  return fhirResources.map((resource) => ({
    _id: resource.id,
    name: resource.name.trim(),
  }));
}