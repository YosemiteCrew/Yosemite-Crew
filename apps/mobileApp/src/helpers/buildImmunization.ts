// src/helpers/buildImmunization.ts
import { type ImmunizationDetails, type FHIRImmunization } from '@/types/api';

export const buildImmunization = ({
  manufacturer,
  vaccineName,
  batchNumber,
  expiryDate,
  vaccinationDate,
  businessName,
  nextDueOn,
  patientId,
}: ImmunizationDetails): FHIRImmunization => ({
  resourceType: 'Immunization',
  status: 'completed',
  vaccineCode: {
    coding: [
      {
        system: 'http://hl7.org/fhir/sid/cvx',
        code: vaccineName.toLowerCase(),
        display: vaccineName,
      },
    ],
    text: vaccineName,
  },
  patient: {
    reference: `Pet/${patientId}`,
  },
  occurrenceDateTime: vaccinationDate,
  primarySource: true,
  manufacturer: { display: manufacturer },
  lotNumber: batchNumber,
  expirationDate: expiryDate,
  performer: [
    {
      actor: {
        display: businessName,
      },
    },
  ],
  note: [
    {
      text: `Next due date: ${nextDueOn}`,
    },
  ],
});