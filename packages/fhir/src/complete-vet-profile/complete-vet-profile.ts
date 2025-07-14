import { ConvertToFhirVetProfileParams, VetNameType } from "@yosemite-crew/types";


export function convertToFhirVetProfile({
  name,
  area,
  specialization,
  countryCode,
  OperatingHour,
  duration,
  image,
  uploadedFiles,
}: ConvertToFhirVetProfileParams & {
  image?: { name: string; type: string } | string;
  uploadedFiles?: { name: string; type: string }[];
}) {
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
      { system: "phone", value: `${name.mobileNumber}` },
      { system: "countryCode", value: `${countryCode}` },
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
        area: area?area:name.area
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
        url: "http://example.org/fhir/StructureDefinition/OperatingHour",
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
    ],
  };

  if (uploadedFiles && uploadedFiles.length > 0) {
    fhirProfile.extension.push({
      url: "http://example.org/fhir/StructureDefinition/certificates",
      valueString: JSON.stringify(
        uploadedFiles.map((file) => ({
          name: file.name,
          type: file.type,
        }))
      ),
    });
  }

  if (image) {
    fhirProfile.photo =image.name
  }

  return fhirProfile;
}


export function convertFromFhirVetProfile(fhir: any): ConvertToFhirVetProfileParams & {
  image?: { name: string; type: string };
  uploadedFiles?: { name: string; type: string }[];
} {
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
  const countryCode = telecom.find((t: any) => t.system === "countryCode")?.value || "";

  // const [countryCode, mobileNumber] = phone.match(/^(\+\d{1,4})(\d+)$/)?.slice() || ["+91", ""];


  const name: VetNameType = {
    registrationNumber: fhir.identifier?.find((id: any) => id.system === "registrationNumber")?.value || "",
    medicalLicenseNumber: fhir.identifier?.find((id: any) => id.system === "medicalLicense")?.value || "",
    firstName: nameInfo.given?.[0] || "",
    lastName: nameInfo.family || "",
    email,
    mobileNumber: phone,
    gender: fhir.gender || "",
    dateOfBirth: fhir.birthDate || "",
    linkedin,
    yearsOfExperience: extensions.yearsOfExperience || "",
    postalCode: address.postalCode || "",
    addressLine1: address.line?.[0] || "",
    city: address.city || "",
    stateProvince: address.state || "",
    area:address.area || "",
    biography: extensions.biography || "",
  };
console.log("area",name)
  // Optional image extraction
  const image = fhir.photo
    // ? {
    //   name: fhir.photo[0].title,
    //   type: fhir.photo[0].contentType,
    // }
    // : undefined;

  // Optional uploaded files extraction from certificates extension
  const uploadedFiles =
    extensions.certificates && typeof extensions.certificates === "string"
      ? JSON.parse(extensions.certificates)
      : [];

  return {
    name,
    specialization: extensions.specialization || "",
    countryCode,
    OperatingHour: extensions.OperatingHour ? JSON.parse(extensions.OperatingHour) : [],
    duration: extensions.duration || "",
    image,
    uploadedFiles,
  };
}

