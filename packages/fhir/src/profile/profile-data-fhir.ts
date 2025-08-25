import { IUser } from "@yosemite-crew/types";



export function toFhirUser(user: IUser) {
  return {
    resourceType: "Patient",
    id: user._id?.toString(),
    name: [
      {
        given: [user.firstName],
        family: user.lastName,
      },
    ],
    telecom: [
      ...(user.email ? [{ system: "email", value: user.email }] : []),
      ...(user.mobilePhone
        ? [
            {
              system: "phone",
              value: `${user.countryCode || ""}${user.mobilePhone}`,
            },
          ]
        : []),
    ],
    birthDate: user.dateOfBirth
      ? user.dateOfBirth.toISOString().split("T")[0]
      : undefined,
    address: [
      {
        line: [user.address || ""],
        city: user.city,
        district: user.area,
        state: user.state,
        postalCode: user.zipcode,
        country: user.country,
      },
    ],
    photo: user.profileImage?.map((img) => ({
      url: img.url,
      title: img.originalname,
      contentType: img.mimetype,
    })),
    extension: [
      ...(user.professionType?.length
        ? [
            {
              url: "https://your-app.com/fhir/StructureDefinition/professionType",
              valueString: user.professionType.join(","),
            },
          ]
        : []),
      ...(user.isProfessional
        ? [
            {
              url: "https://your-app.com/fhir/StructureDefinition/isProfessional",
              valueString: user.isProfessional,
            },
          ]
        : []),
      ...(user.pimsCode
        ? [
            {
              url: "https://your-app.com/fhir/StructureDefinition/pimsCode",
              valueString: user.pimsCode,
            },
          ]
        : []),
      ...(user.isConfirmed !== undefined
        ? [
            {
              url: "https://your-app.com/fhir/StructureDefinition/isConfirmed",
              valueBoolean: user.isConfirmed,
            },
          ]
        : []),
    ],
  };
}

export function fromFhirUser(fhir: any): Partial<IUser> {
  const telecomEmail = fhir.telecom?.find((t: any) => t.system === "email")?.value;
  const telecomPhone = fhir.telecom?.find((t: any) => t.system === "phone")?.value;

  return {
    firstName: fhir.name?.[0]?.given?.[0],
    lastName: fhir.name?.[0]?.family,
    email: telecomEmail,
    mobilePhone: telecomPhone?.replace(/^\+\d{1,3}/, ""),
    countryCode: telecomPhone?.match(/^\+\d{1,3}/)?.[0],
    dateOfBirth: fhir.birthDate ? new Date(fhir.birthDate) : undefined,
    address: fhir.address?.[0]?.line?.[0],
    area: fhir.address?.[0]?.district,
    city: fhir.address?.[0]?.city,
    state: fhir.address?.[0]?.state,
    zipcode: fhir.address?.[0]?.postalCode,
    country: fhir.address?.[0]?.country,
    profileImage: fhir.photo?.map((p: any) => ({
      url: p.url,
      originalname: p.title || "",
      mimetype: p.contentType || "",
    })),
    professionType: fhir.extension
      ?.filter((ext: any) => ext.url.includes("professionType"))
      .map((ext: any) => ext.valueString?.split(","))
      .flat(),
    isProfessional: fhir.extension?.find((ext: any) =>
      ext.url.includes("isProfessional")
    )?.valueString,
    pimsCode: fhir.extension?.find((ext: any) =>
      ext.url.includes("pimsCode")
    )?.valueString,
    isConfirmed: fhir.extension?.find((ext: any) =>
      ext.url.includes("isConfirmed")
    )?.valueBoolean,
  };
}
