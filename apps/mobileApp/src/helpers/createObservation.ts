import {
  type ObservationDetails,
  type FHIRObservationFeedback,
} from '@/types/api';

export const createObservation = ({
  appointmentId,
  patientId,
  practitionerId,
  valueString,
  rating,
}: ObservationDetails): FHIRObservationFeedback => {
  return {
    resourceType: 'Observation',
    status: 'final',
    category: [
      {
        coding: [
          {
            system:
              'https://terminology.hl7.org/CodeSystem/observation-category',
            code: 'survey',
            display: 'Survey',
          },
        ],
      },
    ],
    code: {
      coding: [
        {
          system: 'https://loinc.org',
          code: '76490-0',
          display: 'Patient feedback',
        },
      ],
      text: 'Appointment Feedback',
    },
    subject: {
      reference: `Patient/${patientId}`,
    },
    performer: [
      {
        reference: `Practitioner/${practitionerId}`,
      },
    ],
    basedOn: [
      {
        reference: `Appointment/${appointmentId}`,
      },
    ],
    effectiveDateTime: new Date().toISOString(),
    valueString: valueString,
    component: [
      {
        code: {
          coding: [
            {
              system: 'https://loinc.org',
              code: '45489-6',
              display: 'Satisfaction rating',
            },
          ],
        },
        valueQuantity: {
          value: rating,
          unit: 'stars',
          system: 'https://unitsofmeasure.org',
          code: '{score}',
        },
      },
    ],
  };
};