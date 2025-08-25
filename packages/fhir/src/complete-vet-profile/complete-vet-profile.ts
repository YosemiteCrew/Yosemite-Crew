import {
  ConvertToFhirVetProfileParams,
  FhirPractitionerPersonalDetails,
  FhirPractitionerProfessional,
  PersonalDetails,
  ProfessionalDetails,
  RelatedDoctorData,
  RelatedFhirPractitioner,
  VetNameType,
} from "@yosemite-crew/types";

export function convertToFhirVetProfile({
  name,
  area,
  specialization,
  qualification,
  countryCode,
  OperatingHour,
  duration,
  image,
  uploadedFiles,
  key,
  joiningDate,
  yearsOfWorking,
}: ConvertToFhirVetProfileParams & {
  image?: { name: string; type?: string } | string;
  uploadedFiles?: { name: string; type: string }[];
}) {
  const fhirProfile: any = {
    resourceType: "Practitioner",
    identifier: [
      { system: "rcvsNumber", value: name.rcvsNumber },
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
        area: area ? area : name.area,
      },
    ],
    joiningDate,
    yearsOfWorking,
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
        url: "http://example.org/fhir/StructureDefinition/qualification",
        valueString: qualification,
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
      {
        url: "http://example.org/fhir/StructureDefinition/status",
        valueString: name.status || "", // default if not present
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
    if (typeof image == "string") {
      fhirProfile.photo = image;
    } else {
      fhirProfile.photo = image?.name;
    }
  }
  if (key) {
    fhirProfile.key = key;
  }
  return fhirProfile;
}

export function convertFromFhirVetProfile(
  fhir: any
): ConvertToFhirVetProfileParams & {
  image?: { name: string; type?: string } | string;
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
  const countryCode =
    telecom.find((t: any) => t.system === "countryCode")?.value || "";

  // const [countryCode, mobileNumber] = phone.match(/^(\+\d{1,4})(\d+)$/)?.slice() || ["+91", ""];

  const name: VetNameType = {
    rcvsNumber:
      fhir.identifier?.find((id: any) => id.system === "rcvsNumber")?.value ||
      "",
    medicalLicenseNumber:
      fhir.identifier?.find((id: any) => id.system === "medicalLicense")
        ?.value || "",
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
    area: address.area || "",
    biography: extensions.biography || "",
    status: extensions.status || "",
  };
  // Optional image extraction
  const image = fhir.photo;
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
    qualification: extensions.qualification || "",
    countryCode,
    OperatingHour: extensions.OperatingHour
      ? JSON.parse(extensions.OperatingHour)
      : [],
    duration: extensions.duration || "",
    image,
    uploadedFiles,
    key: fhir.key,
    yearsOfWorking: fhir.yearsOfWorking ?? "",
    joiningDate: fhir.joiningDate ?? "",
  };
}

export function convertToFhirPractitionerPersonalDetails(
  details: PersonalDetails
): FhirPractitionerPersonalDetails {
  return {
    resourceType: "Practitioner",
    identifier: [
      {
        system: "http://example.com/rcvs",
        value: details.rcvsNumber ?? "",
      },
    ],
    name: [
      {
        family: details.lastName ?? "",
        given: [details.firstName ?? ""],
      },
    ],
    telecom: [
      ...(details.email
        ? [{ system: "email" as const, value: details.email }]
        : []),
      ...(details.mobileNumber
        ? [{ system: "phone" as const, value: details.mobileNumber }]
        : []),
    ],
    gender: details.gender ?? "",
    birthDate: details.dateOfBirth ?? "",
    address: [
      {
        line: [details.addressLine1 ?? ""],
        city: details.city ?? "",
        district: details.area ?? "",
        postalCode: details.postalCode ?? "",
        state: details.stateProvince ?? "",
      },
    ],
  };
}

// Convert FHIR Practitioner -> normal details
export function convertFromFhirPractitionerPersonalDetails(
  fhir: FhirPractitionerPersonalDetails
): PersonalDetails {
  return {
    firstName: fhir?.name?.[0]?.given?.[0] ?? "",
    lastName: fhir?.name?.[0]?.family ?? "",
    rcvsNumber:
      fhir?.identifier?.find((id) => id.system === "http://example.com/rcvs")
        ?.value ?? "",
    gender: fhir?.gender ?? "",
    email: fhir?.telecom?.find((t) => t.system === "email")?.value ?? "",
    mobileNumber:
      fhir?.telecom?.find((t) => t.system === "phone")?.value ?? "",
    dateOfBirth: fhir?.birthDate ?? "",
    postalCode: fhir?.address?.[0]?.postalCode ?? "",
    addressLine1: fhir?.address?.[0]?.line?.[0] ?? "",
    area: fhir?.address?.[0]?.district ?? "",
    city: fhir?.address?.[0]?.city ?? "",
    stateProvince: fhir?.address?.[0]?.state ?? "",
  };
}



// Convert professional details -> FHIR Practitioner
export function convertToFhirPractitionerProfessionalDetails(
  details: ProfessionalDetails
): FhirPractitionerProfessional {
  return {
    resourceType: "Practitioner",
    identifier: [
      {
        system: "http://example.com/medical-license",
        value: details.medicalLicenseNumber ?? "",
      },
    ],
    qualification: [
      { code: { text: details.qualification ?? "" } },
      { code: { text: details.specialization ?? "" } },
    ],
    extension: [
      ...(details.linkedin
        ? [{ url: "http://example.com/linkedin", valueString: details.linkedin }]
        : []),
      ...(details.biography
        ? [{ url: "http://example.com/biography", valueString: details.biography }]
        : []),
      ...(details.yearsOfExperience
        ? [
            {
              url: "http://example.com/yearsOfExperience",
              valueString: details.yearsOfExperience, 
            },
          ]
        : []),
    ],
  };
}

// Convert FHIR Practitioner -> professional details
export function convertFromFhirPractitionerProfessionalDetails(
  fhir: FhirPractitionerProfessional
): ProfessionalDetails {
  return {
    linkedin:
      fhir.extension?.find((e) => e.url === "http://example.com/linkedin")
        ?.valueString ?? "",
    medicalLicenseNumber:
      fhir.identifier?.find(
        (id) => id.system === "http://example.com/medical-license"
      )?.value ?? "",
    yearsOfExperience:
      fhir.extension?.find(
        (e) => e.url === "http://example.com/yearsOfExperience"
      )?.valueString ?? "", 
    specialization:
      fhir.qualification?.[1]?.code?.text ??
      fhir.qualification?.[0]?.code?.text ??
      "",
    qualification: fhir.qualification?.[0]?.code?.text ?? "",
    biography:
      fhir.extension?.find((e) => e.url === "http://example.com/biography")
        ?.valueString ?? "",
  };
}


/**
 * Convert doctors data[] to FHIR Practitioner[]
 */
export function convertRelatedDoctorsToFhir(doctors: RelatedDoctorData[]): RelatedFhirPractitioner[] {
  return doctors.map((doc) => ({
    resourceType: "Practitioner",
    id: doc.value,
    name: [
      {
        use: "official",
        text: doc.label,
      },
    ],
    photo: doc.image
      ? [
          {
            url: doc.image,
          },
        ]
      : undefined,
    qualification: doc.department
      ? [
          {
            code: {
              text: doc.department, // storing department here
            },
          },
        ]
      : undefined,
  }));
}

/**
 * Convert FHIR Practitioner[] back to doctors data[]
 */
export function convertRelatedFhirToDoctors(fhirData: RelatedFhirPractitioner[]): RelatedDoctorData[] {
  return fhirData.map((fhir) => ({
    label: fhir.name?.[0]?.text ?? "",
    value: fhir.id,
    image: fhir.photo?.[0]?.url ?? "",
    department: fhir.qualification?.[0]?.code?.text ?? "", // restore department
  }));
}
