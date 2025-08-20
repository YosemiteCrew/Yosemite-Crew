// export const parseOrganizations = (data) => {
//   if (!Array.isArray(data)) return [];

//   return data.map((entry) => {
//     const org = entry.resource;
//     const extensions = org.extension || [];

//     // Flatten extensions
//     const extensionMap = {};
//     extensions.forEach((ext) => {
//       const key = ext.url.split('/').pop();

//       if (key === 'selectedService') {
//         if (!extensionMap.selectedServices) extensionMap.selectedServices = [];
//         extensionMap.selectedServices.push(ext.valueString);
//       } else if (ext.valueDecimal !== undefined) {
//         extensionMap[key] = ext.valueDecimal;
//       } else if (ext.valueUrl !== undefined) {
//         extensionMap[key] = ext.valueUrl;
//       } else if (ext.valueString !== undefined) {
//         extensionMap[key] = ext.valueString;
//       }
//     });

//     // Flatten healthcare services
//     const healthcareServices = (org.healthcareServices || []).map((service) => {
//       const doctorCountExt = (service.extension || []).find((ext) =>
//         ext.url.endsWith('doctorCount')
//       );
//       return {
//         id: service.id,
//         name: service.name,
//         doctorCount: doctorCountExt?.valueInteger ?? 0,
//       };
//     });

//     return {
//       id: org.id,
//       name: org.name,
//       type:
//         org.type?.[0]?.coding?.[0]?.display ||
//         org.type?.[0]?.coding?.[0]?.code ||
//         null,
//       address: org.address?.[0]?.text || null,
//       healthcareServices,
//       ...extensionMap, // Spread flattened extensions
//     };
//   });
// };

export const parseOrganizations = data => {
  if (!Array.isArray(data)) return [];

  return data.map(entry => {
    const org = entry.resource;
    const extensions = org.extension || [];

    // Flatten extensions into a map
    const extensionMap = {};
    extensions.forEach(ext => {
      const key = ext.url.split('/').pop();

      if (key === 'selectedService') {
        if (!extensionMap.selectedServices) extensionMap.selectedServices = [];
        const val = ext.valueString;
        extensionMap.selectedServices.push(
          typeof val === 'string' ? {display: val} : val,
        );
      } else if (ext.valueDecimal !== undefined) {
        extensionMap[key] = ext.valueDecimal;
      } else if (ext.valueUrl !== undefined) {
        extensionMap[key] = ext.valueUrl;
      } else if (ext.valueString !== undefined) {
        extensionMap[key] = ext.valueString;
      }
    });

    // Flatten healthcare services
    const healthcareServices = (org.healthcareServices || []).map(service => {
      const doctorCountExt = (service.extension || []).find(ext =>
        ext.url.endsWith('doctorCount'),
      );
      return {
        id: service.id,
        name: service.name,
        doctorCount: doctorCountExt?.valueInteger ?? 0,
      };
    });

    return {
      id: org.id,
      name: org.name,
      logo: org?.image,
      type:
        org.type?.[0]?.coding?.[0]?.display ||
        org.type?.[0]?.coding?.[0]?.code ||
        null,
      address: org.address?.[0]?.text || null,
      healthcareServices,
      ...extensionMap, // Spread flattened extensions like rating, logo, website, selectedServices
    };
  });
};
