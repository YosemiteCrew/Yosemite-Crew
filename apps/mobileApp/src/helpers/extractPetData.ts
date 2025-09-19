import { type FHIRBundle, type ExtractedPet } from '@/types/api';

export function extractPetData(bundle: FHIRBundle): ExtractedPet[] {
  if (!bundle || !Array.isArray(bundle.entry)) {
    return [];
  }

  return bundle.entry.map(({ resource }) => {
    const { id, name, gender, birthDate, animal, extension } = resource;

    const extensionData: Record<string, any> = {};
    if (Array.isArray(extension)) {
      extension.forEach((ext) => {
        const title = ext.title;
        const value =
          ext.valueString ||
          ext.valueInteger ||
          ext.valueBoolean ||
          ext.valueAttachment ||
          '';
        extensionData[title] = value;
      });
    }

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