import type { Address as FHIRAddress, Practitioner } from "@yosemite-crew/fhirtypes";
import type { UserProfile } from "./userProfile";
import { toFHIRAddress } from "./address.model";

export type User = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isActive?: boolean;
};

type PractitionerGender = Practitioner["gender"];

const GENDER_MAP: Record<string, PractitionerGender> = {
  MALE: "male",
  FEMALE: "female",
  OTHER: "other",
};

const toFHIRGender = (gender?: string): PractitionerGender => {
  if (!gender) {
    return undefined;
  }

  const normalized = gender.trim().toUpperCase();
  return GENDER_MAP[normalized] ?? "unknown";
};

const toFHIRBirthDate = (date?: unknown): string | undefined => {
  if (!date) {
    return undefined;
  }

  if (date instanceof Date && !Number.isNaN(date.getTime())) {
    return date.toISOString().split("T")[0] ?? undefined;
  }

  const parsed = new Date(date as string);

  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }

  return parsed.toISOString().split("T")[0] ?? undefined;
};

const sanitizeTelecom = <T>(items: T[]): T[] | undefined =>
  items.length ? items : undefined;

const hasAddressValue = (address?: FHIRAddress): boolean =>
  Boolean(
    address &&
      ((address.line && address.line.length) ||
        address.city ||
        address.district ||
        address.state ||
        address.postalCode ||
        address.country)
  );

const buildQualificationCoding = (specialization?: string) => {
  if (!specialization) {
    return undefined;
  }

  const code = specialization.trim().toLowerCase().replace(/\s+/g, "-");

  return [
    {
      system:
        "http://example.org/fhir/CodeSystem/practitioner-specialization",
      code,
      display: specialization,
    },
  ];
};

export function toFHIRPractitioner(
  user: User,
  profile?: UserProfile
): Practitioner {
  const nameText = [user.firstName, user.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();

  const name = nameText
    ? [
        {
          use: "official" as const,
          text: nameText,
          given: user.firstName ? [user.firstName] : undefined,
          family: user.lastName || undefined,
        },
      ]
    : undefined;

  const telecom: Practitioner["telecom"] = [];

  if (user.email) {
    telecom.push({
      system: "email",
      value: user.email,
    });
  }

  const personalDetails = profile?.personalDetails;

  if (personalDetails?.phoneNumber) {
    telecom.push({
      system: "phone",
      value: personalDetails.phoneNumber,
    });
  }

  if (profile?.professionalDetails?.linkedin) {
    telecom.push({
      system: "url",
      value: profile.professionalDetails.linkedin,
    });
  }

  const homeAddress = personalDetails?.address
    ? toFHIRAddress(personalDetails.address)
    : undefined;

  const address = hasAddressValue(homeAddress)
    ? [
        {
          ...homeAddress,
          type: "both" as const,
          use: "home" as const,
        },
      ]
    : undefined;

  const photo = personalDetails?.profilePictureUrl
    ? [
        {
          url: personalDetails.profilePictureUrl,
        },
      ]
    : undefined;

  const identifiers: Practitioner["identifier"] = [
    {
      system: "http://example.org/fhir/NamingSystem/user-id",
      value: user.id,
    },
  ];

  const professionalDetails = profile?.professionalDetails;

  if (professionalDetails?.medicalLicenseNumber) {
    identifiers.push({
      system: "http://example.org/fhir/NamingSystem/medical-license-number",
      value: professionalDetails.medicalLicenseNumber,
      type: {
        text: "Medical License Number",
      },
      use: "official",
    });
  }

  const qualificationCodeText =
    professionalDetails?.qualification || professionalDetails?.specialization;

  const qualification = qualificationCodeText
    ? [
        {
          code: {
            text: qualificationCodeText,
            coding: buildQualificationCoding(
              professionalDetails?.specialization
            ),
          },
          issuer: professionalDetails?.qualification
            ? {
                display: professionalDetails.qualification,
              }
            : undefined,
        },
      ]
    : undefined;

  const resource: Practitioner = {
    resourceType: "Practitioner",
    id: user.id,
    active: user.isActive,
    name,
    telecom: sanitizeTelecom(telecom) ?? undefined,
    address,
    gender: toFHIRGender(personalDetails?.gender),
    birthDate: toFHIRBirthDate(personalDetails?.dateOfBirth),
    photo,
    identifier: identifiers,
    qualification,
  };

  return resource;
}
