const { v4: uuidv4 } = require("uuid");
class fhirAppointmentFormatter{

  static async formatAppointmentToFHIR({
    appointmentDate,
    appointmentTime24,
    purposeOfVisit,
    concernOfVisit,
    petId,
    doctorId,
    petName,
    document,
  }) {
    console.log(document);
  
    return {
      resourceType: "Appointment",
      id: uuidv4(),
      status: "booked",
      description: purposeOfVisit,
      start: new Date(`${appointmentDate}T${appointmentTime24}`).toISOString(),
      created: new Date().toISOString(),
      reasonCode: [{ text: concernOfVisit }],
      participant: [
        {
          actor: {
            reference: `Patient/${petId}`,
            display: petName,
          },
          status: "accepted",
        },
        {
          actor: {
            reference: `Practitioner/${doctorId}`,
            display: "Veterinarian",
          },
          status: "accepted",
        },
      ],
      supportingInformation: Array.isArray(document)
        ? document.map((doc, index) => ({
            reference: doc.url,
            display: doc.originalname || `Document ${index + 1}`,
          }))
        : [],
    };
  }
  


static toFHIR(appointment,baseUrl) {
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

module.exports =  fhirAppointmentFormatter;
