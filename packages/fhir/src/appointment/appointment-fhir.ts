import { AppointmentInput, AppointmentStatus, FHIRAppointment, FHIRAppointmentBundleParams, IFHIRAppointmentData, SimplifiedAppointment, WebAppointmentType, } from "@yosemite-crew/types";
  

import  {v4 as  uuidv4 }  from "uuid";
// class FHIRTransformer {
//     constructor() {}
//     static parseAppointment(fhirData:IFHIRAppointmentData) {
        
//       if (!fhirData || fhirData.resourceType !== "Appointment") {
//         return {};
//       }
      
//       const startDateObj = new Date(fhirData.start);
     
//       const appointmentDate = startDateObj.toISOString().split('T')[0];
//       const timeslot = `${startDateObj.getHours() % 12 || 12}:${String(startDateObj.getMinutes()).padStart(2, '0')} ${startDateObj.getHours() >= 12 ? 'PM' : 'AM'}`;
//       const purposeOfVisit = fhirData.reasonCode?.[0]?.text || '';
//       const concernOfVisit = fhirData.description?.split(' - ')[1] || '';
  
//       const participants = fhirData.participant || [];
//       const petId = participants.find(p => p.actor.reference.startsWith('Patient/'))?.actor.reference.split('/')[1];
//       const doctorId = participants.find(p => p.actor.reference.startsWith('Practitioner/'))?.actor.reference.split('/')[1];
//       const hospitalId = participants.find(p => p.actor.reference.startsWith('Location/'))?.actor.reference.split('/')[1];
  
//       const department = fhirData.serviceType?.[0]?.coding?.[0]?.code || '';
//       const slotsId = fhirData.extension?.find(e => e.url.includes("slotsId"))?.valueString || '';
  
//       return {
//         appointmentDate,
//         timeslot,
//         purposeOfVisit,
//         concernOfVisit,
//         petId,
//         doctorId,
//         hospitalId,
//         department,
//         slotsId
//       };
//     }

//   }

// export { FHIRTransformer }

// class fhirAppointmentFormatter{

// //   static async formatAppointmentToFHIR({
// //     appointmentDate,
// //     appointmentTime24,
// //     purposeOfVisit,
// //     concernOfVisit,
// //     petId,
// //     doctorId,
// //     petName,             
// //     document,
// //   }) {
  
// //     return {
// //       resourceType: "Appointment",
// //       id: uuidv4(),
// //       status: "booked",
// //       description: purposeOfVisit,
// //       start: new Date(`${appointmentDate}T${appointmentTime24}`).toISOString(),
// //       created: new Date().toISOString(),
// //       reasonCode: [{ text: concernOfVisit }],
// //       participant: [
// //         {
// //           actor: {
// //             reference: `Patient/${petId}`,
// //             display: petName,
// //           },
// //           status: "accepted",
// //         },
// //         {
// //           actor: {
// //             reference: `Practitioner/${doctorId}`,
// //             display: "Veterinarian",
// //           },
// //           status: "accepted",
// //         },
// //       ],
// //       supportingInformation: Array.isArray(document)
// //         ? document.map((doc, index) => ({
// //             reference: doc.url,
// //             display: doc.originalname || `Document ${index + 1}`,
// //           }))
// //         : [],
// //     };
// //   }
  


// static toFHIR(appointment:WebAppointmentType,baseUrl:string) {
//   return {
//     resourceType: "Appointment",
//     id: appointment._id,
//     status: appointment.appointmentStatus, // should match FHIR's allowed values
//     serviceType: [
//       {
//         text: appointment.purposeOfVisit,
//       },
//     ],
//     description: appointment.concernOfVisit,
//     start: `${appointment.appointmentDate}T${appointment.appointmentTime24}:00Z`,
//     created: appointment.createdAt,
//     participant: [
//       {
//         actor: {
//           reference: `Patient/${appointment.userId}`,
//           display: appointment.ownerName,
//         },
//         status: appointment.isCanceled ? "declined" : "accepted",
//       },
//       {
//         actor: {
//           reference: `Practitioner/${appointment.veterinarian}`,
//           display: "Veterinarian",
//         },
//         status: "accepted",
//       },
//       {
//         actor: {
//           reference: `Location/${appointment.hospitalId}`,
//           display: "Hospital",
//         },
//         status: "accepted",
//       },
//     ],
//     reasonCode: [
//       {
//         text: appointment.purposeOfVisit,
//       },
//     ],
//     extension: [
//       {
//         url: `${baseUrl}/fhir/StructureDefinition/petType`,
//         valueString: appointment.petType,
//       },
//       {
//         url: `${baseUrl}/fhir/StructureDefinition/petName`,
//         valueString: appointment.petName,
//       },
//       {
//         url: `${baseUrl}/fhir/StructureDefinition/petAge`,
//         valueString: appointment.petAge,
//       },
//       {
//         url: `${baseUrl}/fhir/StructureDefinition/petGender`,
//         valueString: appointment.gender,
//       },
//       {
//         url: `${baseUrl}/fhir/StructureDefinition/petBreed`,
//         valueString: appointment.breed,
//       },
//       {
//         url: `${baseUrl}/fhir/StructureDefinition/appointmentSource`,
//         valueString: appointment.appointmentSource,
//       },
//       {
//         url: `${baseUrl}/fhir/StructureDefinition/attachments`,
//         valueAttachment: appointment.document?.map((doc) => ({
//           contentType: "image/jpeg",
//           title: doc
//         }))
//       }
//     ]
//   };
// }

// }

export function parseAppointment(fhirData: IFHIRAppointmentData): Partial<WebAppointmentType> | null {

  try{
  if (!fhirData || fhirData.resourceType !== "Appointment") {
    return null;
  }
  const startDateObj = new Date(fhirData.start);
 
  const appointmentDate :number|string|null = fhirData.start || "";
      const purposeOfVisit = fhirData.description || "";
       
      const concernOfVisit = fhirData.reasonCode[0]?.text || "";
  
      // Extract slotId from extensions
      const slotsId =
        fhirData.extension?.find(
          (ext: any) =>
            ext.url ===
            "http://example.org/fhir/StructureDefinition/slotsId"
        )?.valueString || "";

      // Extract patientId, doctorId, and hospitalId from participants
      let petId = "";
      let doctorId = "";
      let hospitalId = "";

      (fhirData.participant || []).forEach((p: any) => {
        const ref = p.actor?.reference || "";
        if (ref.startsWith("Patient/")) {
          petId = ref.replace("Patient/", "");
        } else if (ref.startsWith("Practitioner/")) {
          doctorId = ref.replace("Practitioner/", "");
        } else if (ref.startsWith("Location/")) {
          hospitalId = ref.replace("Location/", "");
        }
      });

      // Extract department info from serviceType
      const department =
        fhirData.serviceType?.[0]?.coding?.[0]?.code ||
        "";


      // Optional: derive timeslot from appointment start
      let timeslot = "";
      if (appointmentDate) {
        const dateObj = new Date(appointmentDate);
        timeslot = dateObj.toTimeString().split(" ")[0]; // HH:MM:SS
      }

      return {
        appointmentDate : appointmentDate as string,
        purposeOfVisit,
        hospitalId,
        department,
        petId,
        slotsId,
        veterinarian:doctorId,
        // timeslot
      };
    } catch (err) {
      console.error("Error parsing FHIR Appointment:", err);
      return null;
    }
  }


export function convertAppointmentsToFHIRBundle({
  status = "Calendar",
  appointments,
  totalCount,
}: FHIRAppointmentBundleParams) {
  const fhirAppointments = appointments.map((appt:any) =>
    convertToFHIRMyCalender(appt)
  );

  return {
    resourceType: "Bundle",
    type: "collection",
    total: totalCount,
    meta: {
      profile: ["http://hl7.org/fhir/StructureDefinition/Appointment"],
    },
    entry: fhirAppointments,
  };
}

// export function convertToFHIRMyCalender(appointment: AppointmentInput) {
//   return {
//     fullUrl: `urn:uuid:${appointment._id}`,
//     resource: {
//       resourceType: "Appointment",
//       id: appointment._id,
//       status: mapStatus(appointment.appointmentStatus as unknown as AppointmentStatus),
//       description: `Appointment for ${appointment.petName ?? "Unknown Pet"}`,
//       start:  appointment.appointmentTime,
//       participant: [
//         {
//           actor: {
//             display: appointment.veterinarian ?? "Unknown Veterinarian",
//           },
//           status: "accepted",
//         },
//         {
//           actor: {
//             display: appointment.ownerName ?? "Unknown Owner",
//           },
//           status: "accepted",
//         },
//       ],
//       specialty: [
//         {
//           text: appointment.department ?? "General",
//         },
//       ],
//     },
//   };
// }

export function formatDateTime(date: string | Date, time?: string): string {
  const isoDate = new Date(date).toISOString().split("T")[0];
  return time ? `${isoDate}T${time}` : `${isoDate}`;
}

export function mapStatus(status: AppointmentStatus): string {
  const mapping: Record<string, string> = {
    confirmed: "booked",
    cancelled: "cancelled",
    completed: "fulfilled",
    pending: "proposed",
  };
  return mapping[status as unknown as string] || "booked";
}

export function convertFHIRToPlainJSON(fhirBundle: any): SimplifiedAppointment[] {
  if (!fhirBundle || !Array.isArray(fhirBundle.entry)) return [];

  return fhirBundle.entry.map((entry: any) => {
    const resource = entry.resource;

    const petName = resource.description?.replace("Appointment for ", "") || "Unknown";
    const veterinarian = resource.participant?.[0]?.actor?.display || "Unknown Veterinarian";
    const ownerName = resource.participant?.[1]?.actor?.display || "Unknown Owner";
    const department = resource.specialty?.[0]?.text || "General";

    return {
      id: resource.id,
      petName,
      veterinarian,
      ownerName,
      department,
      dateTime: resource.start,
      status: resource.status,
    };
  });
}





export function convertToFHIRMyCalender(fhirAppointments: FHIRAppointment[]): AppointmentInput[] {
  return fhirAppointments.map((appt: FHIRAppointment) => {
    const dateObj = new Date(appt.start);

    const hours = dateObj.getHours();
    const minutes = dateObj.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const hour12 = hours % 12 || 12; // convert 0 to 12
    const paddedMinutes = minutes.toString().padStart(2, '0');

    const appointmentTime = `${hour12}:${paddedMinutes} ${ampm}`;
    const appointmentDate = dateObj.toISOString().split('T')[0]; // only YYYY-MM-DD

    const ownerParticipant = appt.participant.find(p => p.actor?.display?.startsWith("Owner:"));
    const petParticipant = appt.participant.find(p => p.actor?.display?.startsWith("Pet:"));
    const vetParticipant = appt.participant.find(p => p.actor?.display?.startsWith("Veterinarian:"));

    const hospitalExt = appt.extension?.find(ext => ext.url.includes("hospitalId"));

    return {
      _id: appt.id,
      appointmentDate,
      appointmentTime,
      appointmentStatus: appt.status,
      department: appt.serviceType?.[0]?.text || '',
      ownerName: ownerParticipant?.actor?.display?.replace("Owner: ", "") || '',
      petName: petParticipant?.actor?.display?.replace("Pet: ", "") || '',
      veterinarian: vetParticipant?.actor?.display?.replace("Veterinarian: ", "") || '',
      hospitalId: hospitalExt?.valueString || '',
    };
  });
}









export function convertFromFHIRAppointments(fhirData: FHIRAppointment[]): AppointmentInput[] {
  return fhirData.map((fhir) => {
    const dateObj = new Date(fhir.start);

    // Extract time in "HH:MM AM/PM" format
    const hours = dateObj.getHours();
    const minutes = dateObj.getMinutes();
    const period = hours >= 12 ? "PM" : "AM";
    const hour12 = hours % 12 === 0 ? 12 : hours % 12;
    const formattedTime = `${hour12}:${minutes.toString().padStart(2, "0")} ${period}`;

    // Extract participants
    let ownerName = "";
    let petName = "";
    let veterinarian: string | null = null;

    fhir.participant.forEach((p) => {
      const name = p.actor.display;
      if (name.startsWith("Owner: ")) {
        ownerName = name.replace("Owner: ", "");
      } else if (name.startsWith("Pet: ")) {
        petName = name.replace("Pet: ", "");
      } else if (name.startsWith("Veterinarian: ")) {
        veterinarian = name.replace("Veterinarian: ", "");
      }
    });

    const hospitalExtension = fhir.extension?.find(
      (ext) => ext.url === "http://example.org/fhir/StructureDefinition/hospitalId"
    );

    return {
      _id: fhir.id,
      ownerName,
      petName,
      appointmentTime: formattedTime,
      hospitalId: hospitalExtension?.valueString || "",
      appointmentStatus: fhir.status,
      appointmentDate: new Date(dateObj.setHours(0, 0, 0, 0)).toISOString(),
      department: fhir.serviceType[0]?.text || "",
      veterinarian,
    };
  });
}