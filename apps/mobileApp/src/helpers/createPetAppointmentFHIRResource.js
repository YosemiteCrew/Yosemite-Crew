export const createPetAppointmentFHIRResource = ({
  petId,
  doctorId,
  businessId,
  startDateTime,
  description,
  reasonText,
  departmentId,
  departmentName,
  slotId,
}) => {
  return {
    resourceType: 'Appointment',
    status: 'booked',
    start: startDateTime, // e.g., "2025-04-10T11:00:00+05:30"
    description: description,
    participant: [
      {
        actor: {
          reference: `Patient/${petId}`,
        },
        status: 'accepted',
      },
      {
        actor: {
          reference: `Practitioner/${doctorId}`,
        },
        status: 'accepted',
      },
      {
        actor: {
          reference: `Location/${businessId}`,
        },
        status: 'accepted',
      },
    ],
    reasonCode: [
      {
        text: reasonText,
      },
    ],
    serviceType: [
      {
        coding: [
          {
            system: 'http://example.org/fhir/department',
            code: departmentId,
            display: departmentName,
          },
        ],
      },
    ],
    extension: [
      {
        url: 'http://example.org/fhir/StructureDefinition/slotsId',
        valueString: slotId,
      },
    ],
  };
};
