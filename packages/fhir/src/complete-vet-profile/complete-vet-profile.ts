import { ConvertToFhirVetProfileParams, VetNameType } from "@yosemite-crew/types";

export function convertToFhirVetProfile({
  name,
  specialization,
  countryCode,
  OperatingHour,
  duration
}: ConvertToFhirVetProfileParams) {
  const fhirProfile: any = {
    resourceType: "Practitioner",
    identifier: [
      { system: "registrationNumber", value: name.registrationNumber },
      { system: "medicalLicense", value: name.medicalLicenseNumber },
    ],
    name: [
      {
        given: [name.firstName],
        family: name.lastName,
      },
    ],
    telecom: [
      { system: "email", value: name.email },
      { system: "phone", value: `${countryCode}${name.mobileNumber}` },
      { system: "url", value: name.linkedin },
    ],
    gender: name.gender,
    birthDate: name.dateOfBirth,
    address: [
      {
        postalCode: name.postalCode,
        line: [name.addressLine1],
        city: name.city,
        state: name.stateProvince,
      },
    ],
    extension: [
      {
        url: "http://example.org/fhir/StructureDefinition/biography",
        valueString: name.biography,
      },
      {
        url: "http://example.org/fhir/StructureDefinition/specialization",
        valueString: specialization,
      },
      {
        url: "http://example.org/fhir/StructureDefinition/operatingHours",
        valueString: JSON.stringify(OperatingHour),
      },
      {
        url: "http://example.org/fhir/StructureDefinition/yearsOfExperience",
        valueString: name.yearsOfExperience,
      },
       {
        url: "http://example.org/fhir/StructureDefinition/duration",
        valueString: duration,
      },
    //   {
    //     url: "http://example.org/fhir/StructureDefinition/certificates",
    //     valueString: JSON.stringify(
    //       uploadedFiles.map((file) => ({
    //         name: file.name,
    //         type: file.type,
    //       }))
    //     ),
    //   },
    ],
  };

//   if (image) {
//     fhirProfile.photo = [
//       {
//         contentType: image.type,
//         title: image.name,
//         url: `data:${image.type};base64,PLACEHOLDER_BASE64`, // Optional, backend can replace this
//       },
//     ];
//   }

  return fhirProfile;
}

export function convertFromFhirVetProfile(fhir: any): ConvertToFhirVetProfileParams {
  const telecom = fhir.telecom || [];
  const address = fhir.address?.[0] || {};
  const nameInfo = fhir.name?.[0] || {};
  const extensions = (fhir.extension || []).reduce((acc: any, ext: any) => {
    const key = ext.url.split("/").pop();
    acc[key] = ext.valueString || ext.valueAttachment || null;
    return acc;
  }, {});

  const phone = telecom.find((t: any) => t.system === "phone")?.value || "";
  const email = telecom.find((t: any) => t.system === "email")?.value || "";
  const linkedin = telecom.find((t: any) => t.system === "url")?.value || "";

  const [countryCode, mobileNumber] = phone.match(/^(\+\d{1,4})(.*)$/)?.slice(1) || ["+91", ""];

  const name: VetNameType = {
    registrationNumber: fhir.identifier?.find((id: any) => id.system === "registrationNumber")?.value || "",
    medicalLicenseNumber: fhir.identifier?.find((id: any) => id.system === "medicalLicense")?.value || "",
    firstName: nameInfo.given?.[0] || "",
    lastName: nameInfo.family || "",
    email,
    mobileNumber,
    gender: fhir.gender || "",
    dateOfBirth: fhir.birthDate || "",
    linkedin,
    yearsOfExperience: extensions.yearsOfExperience || "",// Not in FHIR, fill manually if needed
    postalCode: address.postalCode || "",
    addressLine1: address.line?.[0] || "",
    city: address.city || "",
    stateProvince: address.state || "",
    biography: extensions.biography || "",
  };

  return {
    name,
    specialization: extensions.specialization || "",
    countryCode,
    OperatingHour: extensions.operatingHours ? JSON.parse(extensions.operatingHours) : [],
    // image: fhir.photo?.[0] || null,
    // uploadedFiles: [], // No mapping from FHIR, so default to empty array
    duration: extensions.duration || "",
  };
}
