// src/helpers/extractPetData.ts
import { type FHIRBundle, type ExtractedPet } from '@/types/api';

export function extractPetData(bundle: FHIRBundle): ExtractedPet[] {
  if (!bundle || !Array.isArray(bundle.entry)) {
    return [];
  }

  return bundle.entry.map(({ resource }) => {
    const { id, name, gender, birthDate, animal, extension } = resource;

    // Use a Record to create a flexible, typed object
    const extensionData: Record<string, any> = {};
    if (Array.isArray(extension)) {
      extension.forEach((ext) => {
        const title = ext.title;
        const value =
          ext.valueString ||
          ext.valueInteger ||
          ext.valueBoolean ||
          ext.valueAttachment || // Handle the image object
          '';
        extensionData[title] = value;
      });
    }

    // Special handling for petImage
    if (extensionData.petImage && typeof extensionData.petImage === 'object') {
      extensionData.petImageUrl = extensionData.petImage.url;
      extensionData.petImageOriginalName = extensionData.petImage.originalname;
      extensionData.petImageMimeType = extensionData.petImage.mimetype;
      extensionData.petImageId = extensionData.petImage._id;
    }

    return {
      id,
      name: name?.[0]?.text || '',
      gender,
      birthDate,
      species: animal?.species?.coding?.[0]?.display || '',
      breed: animal?.breed?.coding?.[0]?.display || '',
      genderStatus: animal?.genderStatus?.coding?.[0]?.display || '',
      ...extensionData,
    };
  });
}