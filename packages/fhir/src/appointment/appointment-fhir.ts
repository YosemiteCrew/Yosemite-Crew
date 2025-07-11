import { IFHIRAppointmentData, WebAppointmentType } from "@yosemite-crew/types";
  

import  {v4 as  uuidv4 }  from "uuid";
class FHIRTransformer {
    constructor() {}
    static parseAppointment(fhirData:IFHIRAppointmentData) {
        
      if (!fhirData || fhirData.resourceType !== "Appointment") {
        return {};
      }
      
      const startDateObj = new Date(fhirData.start);
     
      const appointmentDate = startDateObj.toISOString().split('T')[0];
      const timeslot = `${startDateObj.getHours() % 12 || 12}:${String(startDateObj.getMinutes()).padStart(2, '0')} ${startDateObj.getHours() >= 12 ? 'PM' : 'AM'}`;
      const purposeOfVisit = fhirData.reasonCode?.[0]?.text || '';
      const concernOfVisit = fhirData.description?.split(' - ')[1] || '';
  
      const participants = fhirData.participant || [];
      const petId = participants.find(p => p.actor.reference.startsWith('Patient/'))?.actor.reference.split('/')[1];
      const doctorId = participants.find(p => p.actor.reference.startsWith('Practitioner/'))?.actor.reference.split('/')[1];
      const hospitalId = participants.find(p => p.actor.reference.startsWith('Location/'))?.actor.reference.split('/')[1];
  
      const department = fhirData.serviceType?.[0]?.coding?.[0]?.code || '';
      const slotsId = fhirData.extension?.find(e => e.url.includes("slotsId"))?.valueString || '';
  
      return {
        appointmentDate,
        timeslot,
        purposeOfVisit,
        concernOfVisit,
        petId,
        doctorId,
        hospitalId,
        department,
        slotsId
      };
    }

  }

export { FHIRTransformer }

class fhirAppointmentFormatter{

//   static async formatAppointmentToFHIR({
//     appointmentDate,
//     appointmentTime24,
//     purposeOfVisit,
//     concernOfVisit,
//     petId,
//     doctorId,
//     petName,             
//     document,
//   }) {
  
//     return {
//       resourceType: "Appointment",
//       id: uuidv4(),
//       status: "booked",
//       description: purposeOfVisit,
//       start: new Date(`${appointmentDate}T${appointmentTime24}`).toISOString(),
//       created: new Date().toISOString(),
//       reasonCode: [{ text: concernOfVisit }],
//       participant: [
//         {
//           actor: {
//             reference: `Patient/${petId}`,
//             display: petName,
//           },
//           status: "accepted",
//         },
//         {
//           actor: {
//             reference: `Practitioner/${doctorId}`,
//             display: "Veterinarian",
//           },
//           status: "accepted",
//         },
//       ],
//       supportingInformation: Array.isArray(document)
//         ? document.map((doc, index) => ({
//             reference: doc.url,
//             display: doc.originalname || `Document ${index + 1}`,
//           }))
//         : [],
//     };
//   }
  


static toFHIR(appointment:WebAppointmentType,baseUrl:string) {
  return {
    resourceType: "Appointment",
    id: appointment._id,
    status: appointment.appointmentStatus, // should match FHIR's allowed values
    serviceType: [
      {
        text: appointment.purposeOfVisit,
      },
    ],
    description: appointment.concernOfVisit,
    start: `${appointment.appointmentDate}T${appointment.appointmentTime24}:00Z`,
    created: appointment.createdAt,
    participant: [
      {
        actor: {
          reference: `Patient/${appointment.userId}`,
          display: appointment.ownerName,
        },
        status: appointment.isCanceled ? "declined" : "accepted",
      },
      {
        actor: {
          reference: `Practitioner/${appointment.veterinarian}`,
          display: "Veterinarian",
        },
        status: "accepted",
      },
      {
        actor: {
          reference: `Location/${appointment.hospitalId}`,
          display: "Hospital",
        },
        status: "accepted",
      },
    ],
    reasonCode: [
      {
        text: appointment.purposeOfVisit,
      },
    ],
    extension: [
      {
        url: `${baseUrl}/fhir/StructureDefinition/petType`,
        valueString: appointment.petType,
      },
      {
        url: `${baseUrl}/fhir/StructureDefinition/petName`,
        valueString: appointment.petName,
      },
      {
        url: `${baseUrl}/fhir/StructureDefinition/petAge`,
        valueString: appointment.petAge,
      },
      {
        url: `${baseUrl}/fhir/StructureDefinition/petGender`,
        valueString: appointment.gender,
      },
      {
        url: `${baseUrl}/fhir/StructureDefinition/petBreed`,
        valueString: appointment.breed,
      },
      {
        url: `${baseUrl}/fhir/StructureDefinition/appointmentSource`,
        valueString: appointment.appointmentSource,
      },
      {
        url: `${baseUrl}/fhir/StructureDefinition/attachments`,
        valueAttachment: appointment.document?.map((doc) => ({
          contentType: "image/jpeg",
          title: doc
        }))
      }
    ]
  };
}

}

export {fhirAppointmentFormatter}
