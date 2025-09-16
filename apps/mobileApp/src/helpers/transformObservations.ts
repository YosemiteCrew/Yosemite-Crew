// src/helpers/transformObservations.ts
import {
  type FHIRRawObservationFeedback,
  type TransformedObservation,
} from '@/types/api';

export const transformObservations = (
  observations: ({ resource: FHIRRawObservationFeedback } | null | undefined)[] = [],
): TransformedObservation[] => {
  return observations
    .filter((obs): obs is { resource: FHIRRawObservationFeedback } => !!obs && !!obs.resource)
    .map(({ resource }) => {
      const appointmentId =
        resource.extension?.find(
          (ext) =>
            ext.url === 'http://example.org/fhir/StructureDefinition/meeting-id',
        )?.valueString || '';

      const vetId = resource.performer?.[0]?.reference?.split('/')[1] || '';
      const petId = resource.subject?.reference?.split('/')[1] || '';
      const feedBackId = resource?.id;
      const rating = resource.valueInteger || null;
      const feedbackText = resource.note?.[0]?.text || '';

      const dateObj = new Date(resource.effectiveDateTime || new Date());
      const formattedDate = dateObj.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      });

      const vet = {
        name: '', // This would be populated by a real data lookup
        qualification: '',
        specialization: '',
        image: '',
      };

      return {
        appointmentId,
        vetId,
        petId,
        feedbackText,
        rating,
        date: formattedDate,
        vet,
        feedBackId,
      };
    });
};