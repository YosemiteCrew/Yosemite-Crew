// src/helpers/buildMonthlySlotFHIRResource.ts
import { type MonthlySlotDetails, type FHIRAppointment } from '@/types/api';

export const buildMonthlySlotFHIRResource = ({
  startDate,
  month,
  year,
  practitionerId,
  status = 'proposed',
  description = 'Monthly slot request',
}: MonthlySlotDetails): FHIRAppointment => ({
  resourceType: 'Appointment',
  status,
  description,
  start: startDate,
  extension: [
    {
      url: 'http://example.org/fhir/StructureDefinition/slot-month',
      valueInteger: month,
    },
    {
      url: 'http://example.org/fhir/StructureDefinition/slot-year',
      valueInteger: year,
    },
  ],
  participant: [
    {
      actor: {
        reference: `Practitioner/${practitionerId}`,
      },
      status: 'accepted',
    },
  ],
});