// src/helpers/createDocumentReference.ts
import {
  type DocumentReferenceDetails,
  type FHIRDocumentReference,
} from '@/types/api';

export const createDocumentReference = ({
  resourceType = 'DocumentReference',
  typeText,
  description,
  date,
  contextPeriodEnd,
  patientId,
  folderId,
}: DocumentReferenceDetails): FHIRDocumentReference => {
  return {
    resourceType,
    type: { text: typeText || '', reference: folderId },
    author: {
      display: 'petOwner',
    },
    description,
    date,
    context: {
      period: {
        end: contextPeriodEnd,
      },
    },
    subject: {
      reference: `Patient/${patientId}`,
    },
  };
};