const toCamelCase = str => {
  return str.replace(/-([a-z])/g, (_, char) => char.toUpperCase());
};

const formatDateToReadable = dateString => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
};

export const transformDocuments = rawData => {
  const dataArray = Array.isArray(rawData) ? rawData : [];

  return dataArray.map(item => {
    const resource = item.resource || {};

    const transformed = {
      id: resource?.id || '',
      type: resource?.type?.text || '',
      description: resource?.description || '',
      date: resource?.date || '',
      expiry: resource?.context?.period?.end || '',
      createdDate: formatDateToReadable(resource?.effectiveDateTime),
      patientId: resource?.subject?.identifier?.value || '',
      petId: resource?.subject?.identifier?.value || '', // ✅ Directly from identifier
      petImageUrl: resource?.subject?.image || '', // ✅ Directly from image
      attachments:
        resource?.content?.map(c => ({
          url: c?.attachment?.url || '',
          title: c?.attachment?.title || '',
          contentType: c?.attachment?.contentType || '',
        })) || [],
    };

    // Add dynamic fields from extensions
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
