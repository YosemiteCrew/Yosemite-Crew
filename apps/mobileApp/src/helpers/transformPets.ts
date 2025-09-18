// src/helpers/transformPets.ts
import { type FHIRPatientForPetList, type TransformedPet } from '@/types/api';

interface TransformPetsOptions {
  useFhirId?: boolean;
  fallbackText?: string;
}

export function transformPets(
  patients: ({ resource: FHIRPatientForPetList } | null | undefined)[],
  { useFhirId = false, fallbackText = 'Pet' }: TransformPetsOptions = {},
): TransformedPet[] {
  if (!Array.isArray(patients)) return [];

  return patients
    .filter((p): p is { resource: FHIRPatientForPetList } => !!p && !!p.resource)
    .map((p, idx) => {
      const res = p.resource;
      const nameObj = res.name?.[0] || {};
      const title = (nameObj.text || `${fallbackText} ${idx + 1}`).trim();

      let petImage: string | null = null;
      const extensions = res.extension || [];
      for (const ext of extensions) {
        const key = ext.url?.split('/').pop();
        if ((ext.title === 'petImage' || key === 'petImage') && ext.valueString) {
          petImage =
            typeof ext.valueString === 'string'
              ? ext.valueString
              : ext.valueString.url ?? null;
          break;
        }
      }

      return {
        id: useFhirId ? res.id : idx,
        title,
        textColor: '#3E3E3E',
        petImage,
      };
    });
}