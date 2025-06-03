

interface TimeSlot {
  hour: string;
  minute: string;
  period: string;
}

interface Availability {
  day: string;
  times: { from: TimeSlot; to: TimeSlot }[];
}

interface PersonalInfo {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  gender: string;
  dateOfBirth: string;
  image?: string;
}

interface ResidentialAddress {
  addressLine1: string;
  city: string;
  stateProvince: string;
  zipCode: string;
  country: string;
}

interface ProfessionalBackground {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  gender: string;
  dateOfBirth: string;
  qualification: string;
  medicalLicenseNumber: string;
  languagesSpoken: string;
  biography: string;
  yearsOfExperience: string;
  specialization?: string;
  specializationId?: string;
}

interface LoginCredentials {
  username: string;
  password: string;
}

interface AuthSettings {
  [key: string]: boolean;
}

interface TimeDuration {
  value: number;
  unit: string;
}

export interface Document {
  name: string;
  type: string;
  date: Date;
}

export interface ParsedData {
  personalInfo: PersonalInfo;
  residentialAddress: ResidentialAddress;
  professionalBackground: ProfessionalBackground;
  availability: Availability[];
  consultFee: number;
  loginCredentials: LoginCredentials;
  authSettings: AuthSettings;
  timeDuration: TimeDuration | null;
  bussinessId: string;
  activeModes?: string[];
}

export const parseFhirBundle = (formData: any): ParsedData => {
  const parsedData: ParsedData = {
    personalInfo: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      gender: "",
      dateOfBirth: "",
    },
    residentialAddress: {
      addressLine1: "",
      city: "",
      stateProvince: "",
      zipCode: "",
      country: "",
    },
    professionalBackground: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      gender: "",
      dateOfBirth: "",
      qualification: "",
      medicalLicenseNumber: "",
      languagesSpoken: "",
      biography: "", // Initialize biography as an empty string
      yearsOfExperience: "",
    },
    availability: [],
    consultFee: 0,
    loginCredentials: {
      username: "",
      password: "",
    },
    authSettings: {},
    timeDuration: null,
    bussinessId: formData.identifier?.value || "",
  };

  if (!formData.entry || !Array.isArray(formData.entry)) {
    throw new Error("Invalid FHIR Bundle format. No 'entry' array found.");
  }

  formData.entry.forEach((entry: any) => {
    const resource = entry.resource;

    switch (resource.resourceType) {
      case "Practitioner":
        parsedData.personalInfo = {
          firstName: resource.name[0]?.given?.[0] || "",
          lastName: resource.name[0]?.family || "",
          email:
            resource.telecom?.find((t: any) => t.system === "email")?.value ||
            "",
          phone:
            resource.telecom?.find((t: any) => t.system === "phone")?.value ||
            "",
          gender: resource.gender || "",
          dateOfBirth: resource.birthDate || "",
        };
        parsedData.professionalBackground = {
          firstName: resource.name[0]?.given?.[0] || "",
          lastName: resource.name[0]?.family || "",
          email:
            resource.telecom?.find((t: any) => t.system === "email")?.value ||
            "",
          phone:
            resource.telecom?.find((t: any) => t.system === "phone")?.value ||
            "",
          gender: resource.gender || "",
          dateOfBirth: resource.birthDate || "",
          qualification: resource.qualification?.[0]?.code?.text || "",
          medicalLicenseNumber:
            resource.qualification?.[0]?.identifier?.[0]?.value || "",
          languagesSpoken: resource.communication?.[0]?.language?.text || "",
          biography:
            resource.extension?.find(
              (ext: any) =>
                ext.url ===
                "http://example.org/fhir/StructureDefinition/practitioner-biography"
            )?.valueString || "Biography not available", // Default message if not found
          yearsOfExperience:
            resource.extension?.find(
              (ext: any) =>
                ext.url ===
                "http://example.org/fhir/StructureDefinition/yearsOfExperience"
            )?.valueInteger || "",
        };
        break;
      case "PractitionerRole":
        parsedData.availability = resource.availableTime.map((slot: any) => {
          const fhirDayToSchemaDay: { [key: string]: string } = {
            mon: "Monday",
            tue: "Tuesday",
            wed: "Wednesday",
            thu: "Thursday",
            fri: "Friday",
            sat: "Saturday",
            sun: "Sunday",
          };

          const parseTime = (timeString: string): TimeSlot => {
            const [hour, minute] = timeString.split(":");
            const hourInt = parseInt(hour, 10);
            const period = hourInt >= 12 ? "PM" : "AM";
            const formattedHour =
              hourInt > 12 ? (hourInt - 12).toString() : hourInt.toString();
            return {
              hour: formattedHour.padStart(2, "0"),
              minute,
              period,
            };
          };

          return {
            day: fhirDayToSchemaDay[slot.daysOfWeek[0]] || "Monday",
            times: [
              {
                from: parseTime(slot.availableStartTime),
                to: parseTime(slot.availableEndTime),
              },
            ],
          };
        });

        parsedData.consultFee =
          resource.extension?.find(
            (ext: any) =>
              ext.url ===
              "http://example.org/fhir/StructureDefinition/consultFee"
          )?.valueDecimal || 0;

        const timeDurationExtension = resource.extension?.find(
          (ext: any) =>
            ext.url === "http://example.org/fhir/StructureDefinition/timeDuration"
        );
        parsedData.timeDuration = timeDurationExtension
          ? {
              value: timeDurationExtension?.valueDuration?.value || 0,
              unit: timeDurationExtension?.valueDuration?.unit || "minutes",
            }
          : null;

        const activeModesExtension = resource.extension?.find(
          (ext: any) =>
            ext.url === "http://example.org/fhir/StructureDefinition/activeModes"
        );
        parsedData.activeModes = activeModesExtension?.valueCodeableConcept
          ? activeModesExtension.valueCodeableConcept.map(
              (concept: any) => concept.coding[0].display
            )
          : ["In-person"];

        const specializationCoding = resource.code?.[0]?.coding?.[0];
        parsedData.professionalBackground.specialization =
          specializationCoding?.display || "General";
        parsedData.professionalBackground.specializationId =
          specializationCoding?.code || "GEN001";
        break;

      case "Location":
        parsedData.residentialAddress = {
          addressLine1: resource.address?.line?.[0] || "NA",
          city: resource.address?.city || "NA",
          stateProvince: resource.address?.state || "NA",
          zipCode: resource.address?.postalCode || "",
          country: resource.address?.country || "",
        };
        break;

      case "Basic":
        parsedData.loginCredentials = {
          username: resource.author?.display || "",
          password:
            resource.extension?.find(
              (ext: any) =>
                ext.url ===
                "http://example.org/fhir/StructureDefinition/password"
            )?.valueString || "",
        };
        break;

      case "Consent":
        parsedData.authSettings = resource.policy.reduce(
          (acc: any, policy: any) => {
            const permissionType = policy.authority.split("/").pop();
            acc[permissionType] = policy.uri === "granted";
            return acc;
          },
          {}
        );
        break;

      default:
        console.log(`Unknown Resource Type: ${resource.resourceType}`);
    }
  });

  return parsedData;
};

export interface File {
  name: string | [string];
  data: Buffer;
  mimetype: string;
}

export interface Files {
  profilePicture?: File;
  cvFile?: File;
  document?: File | File[];
}
export interface Demo {
  name: string;
  age: number;
}


