import type { Extension, Organization as FHIROrganization } from "@yosemite-crew/fhirtypes";

export type Speciality = {
  _id?: string;
  organisationId: string; // FK → Organization._id
  departmentMasterId?: string; // Optional FK → DepartmentMaster (if from global list)
  name: string; // e.g., "Cardiology", "Dermatology"
  headUserId?: string; // FK → User._id (who leads this dept)
  headName?: string; // Optional denormalized name for display
  headProfilePicUrl?: string; // Optional denormalized profile pic URL
  teamMemberIds?: string[];
  services?: string[]; // Embedded list of services under this dept
  createdAt?: Date;
  updatedAt?: Date;
};

const SPECIALITY_IDENTIFIER_SYSTEM = "http://example.org/fhir/NamingSystem/speciality-id";
const ORGANISATION_IDENTIFIER_SYSTEM =
  "http://example.org/fhir/NamingSystem/speciality-organisation-id";
const DEPARTMENT_MASTER_IDENTIFIER_SYSTEM =
  "http://example.org/fhir/NamingSystem/speciality-department-master-id";

const HEAD_EXTENSION_URL = "http://example.org/fhir/StructureDefinition/speciality-head";
const SERVICES_EXTENSION_URL = "http://example.org/fhir/StructureDefinition/speciality-services";
const CREATED_AT_EXTENSION_URL = "http://example.org/fhir/StructureDefinition/speciality-created-at";
const UPDATED_AT_EXTENSION_URL = "http://example.org/fhir/StructureDefinition/speciality-updated-at";
const TEAM_EXTENSION_URL = "http://example.org/fhir/StructureDefinition/speciality-team";
const HEAD_USER_ID_CHILD_URL = "userId";
const HEAD_NAME_CHILD_URL = "name";
const HEAD_PROFILE_PICTURE_CHILD_URL = "profilePicture";
const SERVICE_CHILD_URL = "service";
const TEAM_MEMBER_CHILD_URL = "member";

const ensureOrganizationReference = (organisationId: string): string => {
  if (!organisationId) {
    return "";
  }

  return organisationId.startsWith("Organization/") ? organisationId : `Organization/${organisationId}`;
};

const formatToFHIRInstant = (value?: Date | string): string | undefined => {
  if (!value) {
    return undefined;
  }

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return undefined;
  }

  return date.toISOString();
};

const buildIdentifiers = (
  speciality: Speciality
): NonNullable<FHIROrganization["identifier"]> | undefined => {
  const identifiers: NonNullable<FHIROrganization["identifier"]> = [];

  if (speciality._id) {
    identifiers.push({
      system: SPECIALITY_IDENTIFIER_SYSTEM,
      value: speciality._id,
    });
  }

  if (speciality.organisationId) {
    identifiers.push({
      system: ORGANISATION_IDENTIFIER_SYSTEM,
      value: speciality.organisationId,
    });
  }

  if (speciality.departmentMasterId) {
    identifiers.push({
      system: DEPARTMENT_MASTER_IDENTIFIER_SYSTEM,
      value: speciality.departmentMasterId,
    });
  }

  return identifiers.length ? identifiers : undefined;
};

const buildExtensions = (speciality: Speciality): Extension[] | undefined => {
  const extensions: Extension[] = [];

  const headChildExtensions: Extension[] = [];

  if (speciality.headUserId) {
    headChildExtensions.push({
      url: HEAD_USER_ID_CHILD_URL,
      valueString: speciality.headUserId,
    });
  }

  if (speciality.headName) {
    headChildExtensions.push({
      url: HEAD_NAME_CHILD_URL,
      valueString: speciality.headName,
    });
  }

  if (speciality.headProfilePicUrl) {
    headChildExtensions.push({
      url: HEAD_PROFILE_PICTURE_CHILD_URL,
      valueUrl: speciality.headProfilePicUrl,
    });
  }

  if (headChildExtensions.length) {
    extensions.push({
      url: HEAD_EXTENSION_URL,
      extension: headChildExtensions,
    });
  }

  if (speciality.services?.length) {
    extensions.push({
      url: SERVICES_EXTENSION_URL,
      extension: speciality.services
        .filter(Boolean)
        .map<Extension>((service) => ({
          url: SERVICE_CHILD_URL,
          valueString: service,
        })),
    });
  }

  // 🔹 NEW: team members on speciality
  if (speciality.teamMemberIds?.length) {
    extensions.push({
      url: TEAM_EXTENSION_URL,
      extension: speciality.teamMemberIds
        .filter(Boolean)
        .map<Extension>((memberId) => ({
          url: TEAM_MEMBER_CHILD_URL,
          valueString: memberId,
        })),
    });
  }

  const createdAt = formatToFHIRInstant(speciality.createdAt);

  if (createdAt) {
    extensions.push({
      url: CREATED_AT_EXTENSION_URL,
      valueInstant: createdAt,
    });
  }

  const updatedAt = formatToFHIRInstant(speciality.updatedAt);

  if (updatedAt) {
    extensions.push({
      url: UPDATED_AT_EXTENSION_URL,
      valueInstant: updatedAt,
    });
  }

  return extensions.length ? extensions : undefined;
};

export const toFHIRSpeciality = (speciality: Speciality): FHIROrganization => {
  const metaLastUpdated =
    formatToFHIRInstant(speciality.updatedAt) ?? formatToFHIRInstant(speciality.createdAt);

  return {
    resourceType: "Organization",
    id: speciality._id,
    name: speciality.name,
    identifier: buildIdentifiers(speciality),
    partOf:{
      reference: ensureOrganizationReference(speciality.organisationId),    
      type: "Organization",
    },
    extension: buildExtensions(speciality),
    meta: metaLastUpdated
      ? {
          lastUpdated: metaLastUpdated,
        }
      : undefined,
  };
};

const toDate = (value?: string): Date | undefined => {
  if (!value) {
    return undefined;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return undefined;
  }

  return date;
};

const findIdentifierValue = (
  identifiers: FHIROrganization["identifier"],
  system: string
): string | undefined =>
  identifiers?.find((identifier) => identifier.system === system)?.value;

const parseReferenceId = (reference?: string): string | undefined => {
  if (!reference) {
    return undefined;
  }

  const trimmed = reference.trim();

  if (!trimmed) {
    return undefined;
  }

  const segments = trimmed.split("/");
  return segments.length ? segments.at(-1) : undefined;
};

type HeadExtension = Extension & { extension?: Extension[] };

const isHeadExtension = (extension?: Extension): extension is HeadExtension =>
  Boolean(extension?.url === HEAD_EXTENSION_URL);

const parseHeadExtension = (
  extensions: Extension[] | undefined
): Pick<Speciality, "headUserId" | "headName" | "headProfilePicUrl"> => {
  const headExtension = extensions?.find(isHeadExtension);

  if (!headExtension?.extension?.length) {
    return {};
  }

  const userId = headExtension.extension.find((child) => child.url === HEAD_USER_ID_CHILD_URL)
    ?.valueString;
  const name = headExtension.extension.find((child) => child.url === HEAD_NAME_CHILD_URL)?.valueString;
  const profilePicUrl =
    headExtension.extension.find((child) => child.url === HEAD_PROFILE_PICTURE_CHILD_URL)?.valueUrl;

  return {
    headUserId: userId,
    headName: name,
    headProfilePicUrl: profilePicUrl,
  };
};

const parseTeamExtension = (
  extensions: Extension[] | undefined,
): string[] | undefined => {
  const teamExtension = extensions?.find(
    (extension) => extension.url === TEAM_EXTENSION_URL,
  );

  if (!teamExtension?.extension?.length) {
    return undefined;
  }

  const members = teamExtension.extension
    .map((child) =>
      child.url === TEAM_MEMBER_CHILD_URL ? child.valueString : undefined,
    )
    .filter((member): member is string => Boolean(member?.trim()))
    .map((member) => member.trim());

  return members.length ? members : undefined;
};

const parseServicesExtension = (extensions: Extension[] | undefined): string[] | undefined => {
  const servicesExtension = extensions?.find((extension) => extension.url === SERVICES_EXTENSION_URL);

  if (!servicesExtension?.extension?.length) {
    return undefined;
  }

  const services = servicesExtension.extension
    .map((child) => (child.url === SERVICE_CHILD_URL ? child.valueString : undefined))
    .filter((service): service is string => Boolean(service?.trim()))
    .map((service) => service.trim());

  return services.length ? services : undefined;
};

const parseDateExtension = (extensions: Extension[] | undefined, url: string): Date | undefined => {
  const extension = extensions?.find((item) => item.url === url);
  return toDate(extension?.valueInstant ?? extension?.valueDateTime);
};

const resolveOrganisationId = (resource: FHIROrganization): string | undefined => {
  const referenceId = parseReferenceId(resource.partOf?.reference);

  if (referenceId) {
    return referenceId;
  }

  return findIdentifierValue(resource.identifier, ORGANISATION_IDENTIFIER_SYSTEM);
};

export const fromFHIRSpeciality = (resource: FHIROrganization): Speciality => {
  const extensions = resource.extension;

  const headDetails = parseHeadExtension(extensions);
  const teamMemberIds = parseTeamExtension(extensions);
  const services = parseServicesExtension(extensions);
  const createdAt = parseDateExtension(extensions, CREATED_AT_EXTENSION_URL);
  const updatedAtExtension = parseDateExtension(extensions, UPDATED_AT_EXTENSION_URL);
  const updatedAtMeta = toDate(resource.meta?.lastUpdated);

  return {
    _id: resource.id ?? findIdentifierValue(resource.identifier, SPECIALITY_IDENTIFIER_SYSTEM),
    organisationId: resolveOrganisationId(resource) ?? "",
    departmentMasterId: findIdentifierValue(resource.identifier, DEPARTMENT_MASTER_IDENTIFIER_SYSTEM),
    name: resource.name ?? "",
    teamMemberIds,
    services,
    createdAt,
    updatedAt: updatedAtExtension ?? updatedAtMeta ?? undefined,
    ...headDetails,
  };
};
