export function extractPetData(bundle) {
  return bundle.entry.map(({ resource }) => {
    const { id, name, gender, birthDate, animal, extension } = resource;

    // Convert extensions into a key-value map
    const extensionData = {};
    extension.forEach((ext) => {
      const title = ext.title;
      const value =
        ext.valueString || ext.valueInteger || ext.valueBoolean || '';
      extensionData[title] = value;
    });

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
      ...extensionData, // includes all dynamic fields from extensions
    };
  });
}
