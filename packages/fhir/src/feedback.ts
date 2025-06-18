import mongoose, { Types } from 'mongoose';
import type { feedbackData } from "@yosemite-crew/types";



/** -----------------------------
 * Convert Normal Feedbacks to FHIR Observation Bundle
 --------------------------------*/
export const convertToFhir = (feedbacks: feedbackData[]) => {
  return {
    resourceType: 'Bundle',
    type: 'searchset',
    total: feedbacks.length,
    entry: feedbacks.map((resource: feedbackData) => ({
      resource: {
        resourceType: 'Observation',
        id: resource._id.toString(),
        status: 'final',
        code: {
          coding: [
            {
              system: 'http://loinc.org',
              code: '71007-4',
              display: 'Patient satisfaction',
            },
          ],
          text: 'Feedback Rating',
        },
        subject: {
          reference: `Patient/${resource.petId}`,
        },
        performer: [
          {
            reference: `Practitioner/${resource.doctorId}`,
            display: `${resource.doctorDetails?.personalInfo?.firstName || ''} ${resource.doctorDetails?.personalInfo?.lastName || ''}`.trim(),
          },
        ],
        effectiveDateTime: resource.createdAt
          ? new Date(resource.createdAt).toISOString()
          : new Date().toISOString(),
        valueInteger: resource.rating ?? undefined,
        note: resource.feedback ? [{ text: resource.feedback }] : [],
        extension: [
          {
            url: 'http://example.org/fhir/StructureDefinition/meeting-id',
            valueString: resource.meetingId || '',
          },
          {
            url: 'http://example.org/fhir/StructureDefinition/doctor-qualification',
            valueString: resource.doctorDetails?.professionalBackground?.qualification || '',
          },
          {
            url: 'http://example.org/fhir/StructureDefinition/doctor-department',
            valueString: resource.department || '',
          },
          {
            url: 'http://example.org/fhir/StructureDefinition/doctor-image',
            valueUrl: resource.doctorDetails?.personalInfo?.image || '',
          },
        ],
      },
    })),
  };
};

/** -----------------------------
 * Convert FHIR Observation to Normal Feedback Format
 --------------------------------*/
export const convertFhirToNormal = (feedbackFHIR: any) : Partial<feedbackData> => {
  const performerReference = feedbackFHIR?.performer?.[0]?.reference || null;
  const subjectReference = feedbackFHIR?.subject?.reference || null;
  const appointmentReference = feedbackFHIR?.basedOn?.[0]?.reference || null;

  const doctorId = performerReference ? performerReference.split('/')[1] : null;
  const petId = subjectReference ? subjectReference.split('/')[1] : null;
  const meetingIdRaw = appointmentReference ? appointmentReference.split('/')[1] : null;
  const meetingId = meetingIdRaw;
  const feedbackText = feedbackFHIR?.valueString || '';
  const ratingValue = feedbackFHIR?.component?.[0]?.valueQuantity?.value || null;

  return {
    doctorId,
    petId,
    meetingId,
    feedback: feedbackText,
    rating: ratingValue,
  };
};