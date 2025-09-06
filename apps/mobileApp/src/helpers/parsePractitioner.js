export const parsePractitioners = data =>
  data?.map(item => {
    const resource = item?.resource;
    const extensions = {};

    resource.extension?.forEach(ext => {
      if (ext?.title === 'averageRating')
        extensions.averageRating = ext.valueDecimal;
      if (ext?.title === 'consultationFee')
        extensions.consultationFee = ext.valueDecimal;
      if (ext?.title === 'experienceYears')
        extensions.experienceYears = ext.valueInteger;
      if (ext?.title === 'doctorImage')
        extensions.doctorImage = ext.valueString;
    });

    return {
      id: resource.id,
      name: resource.name?.[0]?.text || '',
      specialization: resource.department?.[0]?.code?.text || '',
      qualification: resource.qualification?.[0]?.code?.text || '',
      ...extensions,
    };
  });
