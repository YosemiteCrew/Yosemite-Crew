// src/helpers/createPetAppointmentFHIRResource.ts
import {
  type PetAppointmentDetails,
  type FHIRPetAppointment,
} from '@/types/api';

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
}: PetAppointmentDetails): FHIRPetAppointment => {
  return {
    resourceType: 'Appointment',
    status: 'booked',
    start: startDateTime,
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