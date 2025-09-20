// src/helpers/transformDocuments.ts
import { type FHIRRawDocument, type TransformedDocument } from '@/types/api';

const toCamelCase = (str: string): string => {
  return str.replace(/-([a-z])/g, (_, char) => char.toUpperCase());
};

const formatDateToReadable = (dateString: string | undefined): string => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
};

export const transformDocuments = (
  rawData: ({ resource: FHIRRawDocument } | null | undefined)[],
): TransformedDocument[] => {
  if (!Array.isArray(rawData)) return [];

  return rawData
    .filter((item): item is { resource: FHIRRawDocument } => !!item && !!item.resource)
    .map(item => {
      const resource = item.resource;

      const transformed: TransformedDocument = {
        id: resource?.id || '',
        type: resource?.type?.text || '',
        description: resource?.description || '',
        date: resource?.date || '',
        expiry: resource?.context?.period?.end || '',
        createdDate: formatDateToReadable(resource?.effectiveDateTime),
        patientId: resource?.subject?.identifier?.value || '',
        petId: resource?.subject?.identifier?.value || '',
        petImageUrl: resource?.subject?.image || '',
        attachments:
          resource?.content?.map(c => ({
            url: c?.attachment?.url || '',
            title: c?.attachment?.title || '',
            contentType: c?.attachment?.contentType || '',
          })) || [],
      };

      resource.extension?.forEach(ext => {
        const rawKey = ext.url?.split('/').pop();
        const key = rawKey ? toCamelCase(rawKey) : '';

        const value =
          ext.valueString ??
          ext.valueInteger ??
          ext.valueBoolean ??
          ext.valueDateTime ??
          '';

        if (key) {
          transformed[key] = value;
        }
      });

      return transformed;
    });
};