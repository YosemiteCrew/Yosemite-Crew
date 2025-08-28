import { WebAppointmentType } from "@yosemite-crew/types";

interface FhirExtension {
  url: string;
  valueString?: string;
  valueDecimal?: number;
  valueArray?: { valueString: string }[];
}

interface FhirActor {
  reference: string;
  display: string;
  extension?: FhirExtension[];
}

interface FhirParticipant {
  actor: FhirActor;
  required: "required" | "optional";
  status: "accepted" | "declined" | "tentative";
}

interface FhirAppointment {
  resourceType: "Appointment";
  id: string;
  status: string; // "pending" | "booked" | "cancelled" | etc.
  start: string; // ISO datetime string
  reasonCode: { text: string }[];
  extension: FhirExtension[];
  participant: FhirParticipant[];
}
class FHIRService {
  static convertAppointmentToFHIR(app : WebAppointmentType, vetMap :unknown, petMap :any, hospitalMap :any):FhirAppointment {
    const vet = vetMap[app.veterinarian] || {};
    const pet = petMap[app.petId] || {};
    const hospital = hospitalMap[app.hospitalId] || {};

    return {
      resourceType: "Appointment",
      id: app._id.toString(),
      status: app.appointmentStatus,
      start: app.appointmentDate,
      reasonCode: [{ text: "Veterinary Consultation" }],
      extension: [
        {
          url: "http://example.org/fhir/StructureDefinition/appointment-time-slot",
          valueString: app.appointmentTime
        }
      ],
      participant: [
        {
          actor: {
            reference: `Practitioner/${app.veterinarian || "unknown"}`,
            display: vet.name || "Unknown Veterinarian",
            extension: [
              {
                url: "http://example.org/fhir/StructureDefinition/vet-image",
                valueString: vet.image || ""
              },
              {
                url: "http://example.org/fhir/StructureDefinition/vet-qualification",
                valueString: vet.qualification || ""
              },
              {
                url: "http://example.org/fhir/StructureDefinition/vet-specialization",
                valueString: vet.specialization || ""
              },
              {
                url:'http://example.org/fhir/StructureDefinition/vet-department-id',
                valueString:vet.departmentId || ''
              }
            ]
          },
          required: "required",
          status: "accepted"
        },
        {
          actor: {
            reference: `Patient/${app.petId || "unknown"}`,
            display: pet.petName || "Unknown Pet",
            extension: [
              {
                url: "http://example.org/fhir/StructureDefinition/pet-images",
                valueArray: Array.isArray(pet.petImage)
                  ? pet.petImage.map((img:string)=> ({ valueString: img }))
                  : [{ valueString: pet.petImage?.url || "" }]
              }
            ]
          },
          required: "required",
          status: "accepted"
        },
        {
          actor: {
            reference: `Location/${app.hospitalId || "unknown"}`,
            display: hospital.name || "Unknown Hospital",
            extension: [
              {
                url: "http://example.org/fhir/StructureDefinition/hospital-latitude",
                valueDecimal: parseFloat(hospital.latitude) || 0
              },
              {
                url: "http://example.org/fhir/StructureDefinition/hospital-longitude",
                valueDecimal: parseFloat(hospital.longitude) || 0
              }
            ]
          },
          required: "required",
          status: "accepted"
        }
      ]
    };
  }
  
  
  }
  
export default FHIRService;
  