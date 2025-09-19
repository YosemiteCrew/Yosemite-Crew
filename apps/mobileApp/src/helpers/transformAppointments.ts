// src/helpers/transformAppointments.ts
import {
  type FHIRRawAppointment,
  type TransformedAppointment,
  type AllAppointmentsApiResponse,
  type AllAppointments,
} from '@/types/api';

const transformAppointments = (
  appointments: (FHIRRawAppointment | null | undefined)[] = [],
): TransformedAppointment[] => {
  return appointments
    .filter((app): app is FHIRRawAppointment => !!app) // Safely filter out nulls/undefined
    .map(appointment => {
      const vetParticipant = appointment.participant.find(p =>
        p.actor.reference.startsWith('Practitioner/'),
      );
      const patientParticipant = appointment.participant.find(p =>
        p.actor.reference.startsWith('Patient/'),
      );
      const locationParticipant = appointment.participant.find(p =>
        p.actor.reference.startsWith('Location/'),
      );

      const vetExtensions = vetParticipant?.actor?.extension || [];
      const patientExtensions = patientParticipant?.actor?.extension || [];

      const timeExtension = appointment.extension?.find(
        ext =>
          ext.url ===
          'http://example.org/fhir/StructureDefinition/appointment-time-slot',
      );
      const slotId = appointment.extension?.find(
        ext => ext.url === 'http://example.org/fhir/StructureDefinition/slot-id',
      );
      const petImageData = patientExtensions.find(
        ext =>
          ext.url === 'http://example.org/fhir/StructureDefinition/pet-images',
      )?.valueArray?.[0]?.valueString;

      return {
        id: appointment.id,
        date: appointment.start,
        time: timeExtension?.valueString || '',
        slotId: slotId?.valueString || '',
        status: appointment.status,
        reason: appointment.reasonCode?.[0]?.text || '',
        vetId: vetParticipant?.actor?.reference.split('/')[1] || '',
        petId: patientParticipant?.actor?.reference.split('/')[1] || '',
        vet: {
          name: vetParticipant?.actor?.display || '',
          departmentId:
            vetExtensions.find(
              ext =>
                ext.url ===
                'http://example.org/fhir/StructureDefinition/vet-department-id',
            )?.valueString || '',
          qualification:
            vetExtensions.find(
              ext =>
                ext.url ===
                'http://example.org/fhir/StructureDefinition/vet-qualification',
            )?.valueString || '',
          specialization:
            vetExtensions.find(
              ext =>
                ext.url ===
                'http://example.org/fhir/StructureDefinition/vet-specialization',
            )?.valueString || '',
          image:
            vetExtensions.find(
              ext =>
                ext.url ===
                'http://example.org/fhir/StructureDefinition/vet-image',
            )?.valueString || '',
        },
        pet: {
          name: patientParticipant?.actor?.display || '',
          image: petImageData || '',
        },
        location: locationParticipant?.actor?.display || '',
        businessId: locationParticipant?.actor?.reference.split('/')[1] || '',
      };
    });
};

export const transformAllAppointments = (
  apiResponse: AllAppointmentsApiResponse,
): AllAppointments => {
  const sections: Array<keyof AllAppointments> = ['upcoming', 'pending', 'past', 'cancel'];
  const result = {} as AllAppointments;

  sections.forEach(section => {
    result[section] = transformAppointments(
      apiResponse?.data?.[section]?.data || [],
    );
  });
  return result;
};