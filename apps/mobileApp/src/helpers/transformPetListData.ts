// src/helpers/transformPetListData.ts
import { type FHIRPatientForList, type ExtractedPet } from '@/types/api';

const toCamelCase = (str: string): string => {
  return str.replace(/-([a-z])/g, (_, char) => char.toUpperCase());
};

export const transformPets = (
  rawData: ({ resource: FHIRPatientForList } | null | undefined)[]
): ExtractedPet[] => {
  if (!Array.isArray(rawData)) return [];

  return rawData
    .filter((item): item is { resource: FHIRPatientForList } => !!item && !!item.resource)
    .map(item => {
      const resource = item.resource;

      const transformed: ExtractedPet = {
        id: resource?.id || '',
        name: resource?.name?.[0]?.text || '',
        gender: resource?.gender,
        birthDate: resource?.birthDate || '',
        species: resource?.animal?.species?.coding?.[0]?.display || '',
        breed: resource?.animal?.breed?.coding?.[0]?.display || '',
        genderStatus: resource?.animal?.genderStatus?.coding?.[0]?.display || '',
        percentage: resource?.profileCompletion || 0,
      };

      resource.extension?.forEach(ext => {
        const rawKey = ext.url?.split('/').pop();
        const key = rawKey ? toCamelCase(rawKey) : '';

        let value: string | number | boolean = '';
        if (ext.valueString && typeof ext.valueString === 'object') {
          value = ext.valueString.url || '';
        } else {
          value =
            (ext.valueString as string) ??
            ext.valueInteger ??
            ext.valueBoolean ??
            '';
        }

        if (key) {
          transformed[key] = value;
        }
      });

      return transformed;
    });
};