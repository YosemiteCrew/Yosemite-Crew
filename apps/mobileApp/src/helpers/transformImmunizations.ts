// src/helpers/transformImmunizations.ts
import {
  type FHIRRawImmunization,
  type TransformedImmunization,
} from '@/types/api';

interface Options {
  useFhirId?: boolean;
}

export function transformImmunizations(
  immunizations: ({ resource: FHIRRawImmunization } | null | undefined)[],
  { useFhirId = false }: Options = {},
): TransformedImmunization[] {
  if (!Array.isArray(immunizations)) return [];

  return immunizations
    .filter((item): item is { resource: FHIRRawImmunization } => !!item && !!item.resource)
    .map((item, idx) => {
      const res = item.resource;
      const id = useFhirId ? res.id : idx;

      const vaccine = res.vaccineCode?.text || 'Unknown Vaccine';
      const status = res.status || 'unknown';
      const date = res.occurrenceDateTime || null;
      const manufacturer = res.manufacturer?.display || null;
      const lotNumber = res.lotNumber || null;
      const location = res.location?.display || null;
      const petImage = res.patient?.petImageUrl || null;
      const petId = res.patient?.reference?.split('/')?.[1] || null;

      let nextDue: string | null = null;
      let expiryDate: string | null = null;
      (res.note || []).forEach(n => {
        if (n.text?.startsWith('Next due:')) {
          nextDue = n.text.replace('Next due:', '').trim();
        } else if (n.text?.startsWith('Expiry date:')) {
          expiryDate = n.text.replace('Expiry date:', '').trim();
        }
      });

      const attachments: TransformedImmunization['attachments'] = [];
      (res.contained || []).forEach(doc => {
        (doc?.content || []).forEach(content => {
          const { attachment } = content;
          if (attachment?.contentType && attachment?.title && attachment?.url) {
            const type = attachment.contentType.includes('image')
              ? 'image'
              : attachment.contentType.includes('pdf')
              ? 'pdf'
              : 'other';
            attachments.push({ title: attachment.title, url: attachment.url, type });
          }
        });
      });

      return {
        id,
        status,
        vaccine,
        date,
        manufacturer,
        lotNumber,
        location,
        nextDue,
        expiryDate,
        petImage,
        petId,
        attachments,
      };
    });
}