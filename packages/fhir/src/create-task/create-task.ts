import { FormTaskData, UploadedFileForCreateTask } from "@yosemite-crew/types";

//
// Convert Form -> FHIR
//
export const convertTaskToFHIR = (formData: FormTaskData) => {
  return {
    resourceType: "Task",
    status: "requested",
    intent: "order",
    description: formData.description, // <-- only description here
    note: [
      {
        text: formData.taskTitle, // <-- store taskTitle separately in note
      },
    ],
    priority:
      formData.priority === "High Priority"
        ? "asap"
        : formData.priority === "Medium Priority"
        ? "urgent"
        : "routine",
    executionPeriod: {
      start: formData.startDate || undefined,
      end: formData.endDate || undefined,
    },
    for: {
      reference: `Patient/${formData.patientName}`,
      display: formData.patientName,
    },
    owner: {
      reference: `Practitioner/${formData.assignedTo}`,
      display: formData.assignedTo,
    },
    requester: {
      display: "Dr. David Brown", // replace dynamically if you have actual requester
    },
    extension: [
      {
        url: "http://example.org/fhir/StructureDefinition/taskCategory",
        valueString: formData.taskCategory,
      },
      {
        url: "http://example.org/fhir/StructureDefinition/assignedDepartment",
        valueString: formData.assignedDepartment,
      },
      {
        url: "http://example.org/fhir/StructureDefinition/parentName",
        valueString: formData.parentName,
      },
      {
        url: "http://example.org/fhir/StructureDefinition/appointmentId",
        valueString: formData.appointmentId,
      },
    ],
  };
};

//
// Convert FHIR -> Form
//
export const convertTaskFromFHIR = (
  fhirTask: any
): {
  formData: FormTaskData;
  uploadedFiles: UploadedFileForCreateTask[];
} => {
  const getExt = (url: string) =>
    fhirTask.extension?.find((e: any) => e.url === url)?.valueString || "";

  return {
    formData: {
      taskTitle: fhirTask.note?.[0]?.text || "", // <-- extract taskTitle separately
      description: fhirTask.description || "",
      taskCategory: getExt("http://example.org/fhir/StructureDefinition/taskCategory"),
      priority:
        fhirTask.priority === "asap"
          ? "High Priority"
          : fhirTask.priority === "urgent"
          ? "Medium Priority"
          : "Low Priority",
      startDate: fhirTask.executionPeriod?.start || null,
      endDate: fhirTask.executionPeriod?.end || null,
      assignedTo: fhirTask.owner?.display || "",
      assignedDepartment: getExt("http://example.org/fhir/StructureDefinition/assignedDepartment"),
      patientName: fhirTask.for?.display || "",
      parentName: getExt("http://example.org/fhir/StructureDefinition/parentName"),
      appointmentId: getExt("http://example.org/fhir/StructureDefinition/appointmentId"),
    },
    uploadedFiles: [], // still no files in FHIR
  };
};
