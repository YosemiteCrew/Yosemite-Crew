const toCamelCase = str => {
  return str.replace(/-([a-z])/g, (_, char) => char.toUpperCase());
};

export const transformPets = rawData => {
  return rawData.map(item => {
    const resource = item.resource;

    const transformed = {
      id: resource?.id || '',
      name: resource?.name?.[0]?.text || '',
      gender: resource?.gender || '',
      birthDate: resource?.birthDate || '',
      species: resource?.animal?.species?.coding?.[0]?.display || '',
      breed: resource?.animal?.breed?.coding?.[0]?.display || '',
      genderStatus: resource?.animal?.genderStatus?.coding?.[0]?.display || '',
      percentage: resource?.profileCompletion || 0,
    };

    resource.extension?.forEach(ext => {
      const rawKey = ext.url?.split('/').pop(); // e.g., pet-age
      const key = rawKey ? toCamelCase(rawKey) : '';

      let value = '';
      if (ext.valueString && typeof ext.valueString === 'object') {
        // Handle image object
        value = ext.valueString.url || '';
      } else {
        value = ext.valueString ?? ext.valueInteger ?? ext.valueBoolean ?? '';
      }

      if (key) {
        transformed[key] = value;
      }
    });

    return transformed;
  });
};
