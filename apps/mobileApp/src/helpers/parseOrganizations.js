// utils/fhirParser.js
export const parseOrganizations = data => {
  if (!Array.isArray(data)) return [];

  return data.map(org => {
    const phone = org.telecom?.find(t => t.system === 'phone')?.value || '';
    const email = org.telecom?.find(t => t.system === 'email')?.value || '';
    const url = org.telecom?.find(t => t.system === 'url')?.value || '';

    const addressObj = org.address?.[0] || {};
    const address = [
      ...(addressObj.line || []),
      addressObj.city,
      addressObj.postalCode,
      addressObj.country,
    ]
      .filter(Boolean)
      .join(', ');

    return {
      id: org.id,
      name: org.name,
      phone,
      email,
      url,
      address,
      city: addressObj.city || '', // 👈 Added city separately
    };
  });
};
