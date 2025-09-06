// utils/fhir.utils.js

export const buildOrganizationFHIR = ({
  id,
  name,
  email,
  website,
  phone,
  address,
  city,
  country,
  postalCode,
  subjectReference, // new field for subject
}) => {
  return {
    resourceType: 'Organization',
    id: id || `org-${Date.now()}`, // generate unique ID if not passed
    name: name || '',
    ...(subjectReference
      ? {
          subject: {
            reference: `patient/${subjectReference}`,
          },
        }
      : {}),
    telecom: [
      ...(phone
        ? [
            {
              system: 'phone',
              value: phone,
            },
          ]
        : []),
      ...(email
        ? [
            {
              system: 'email',
              value: email,
            },
          ]
        : []),
      ...(website
        ? [
            {
              system: 'url',
              value: website,
            },
          ]
        : []),
    ],
    address: [
      {
        ...(address ? {line: [address]} : {}),
        ...(city ? {city} : {}),
        ...(postalCode ? {postalCode} : {}),
        ...(country ? {country} : {}),
      },
    ],
  };
};
