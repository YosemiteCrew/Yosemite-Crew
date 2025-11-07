import type { Extension, Location as FHIRLocation } from "@yosemite-crew/fhirtypes";

export type OrganisationRoom = {
  id: string;
  name: string;
  organisationId: string;
  type: "CONSULTATION" | "WAITING_AREA" | "SURGERY" | "ICU";
  assignedSpecialiteis?: string[];
  assignedStaffs?: string[];
};

const ROOM_IDENTIFIER_SYSTEM = "http://example.org/fhir/NamingSystem/organisation-room-id";
const ORGANISATION_IDENTIFIER_SYSTEM =
  "http://example.org/fhir/NamingSystem/organisation-room-organisation-id";
const ROOM_TYPE_SYSTEM = "http://example.org/fhir/CodeSystem/organisation-room-type";
const PHYSICAL_TYPE_SYSTEM = "http://terminology.hl7.org/CodeSystem/location-physical-type";
const PHYSICAL_TYPE_ROOM_CODE = "ro";
const SPECIALITIES_EXTENSION_URL =
  "http://example.org/fhir/StructureDefinition/organisation-room-specialities";
const STAFFS_EXTENSION_URL =
  "http://example.org/fhir/StructureDefinition/organisation-room-staffs";
const SPECIALITY_CHILD_URL = "specialityId";
const STAFF_CHILD_URL = "staffId";

const ROOM_TYPE_CODING_MAP: Record<
  OrganisationRoom["type"],
  { code: string; display: string }
> = {
  CONSULTATION: { code: "consultation", display: "Consultation Room" },
  WAITING_AREA: { code: "waiting-area", display: "Waiting Area" },
  SURGERY: { code: "surgery", display: "Surgery Room" },
  ICU: { code: "icu", display: "ICU" },
};

const REVERSE_ROOM_TYPE_CODING_MAP = Object.entries(ROOM_TYPE_CODING_MAP).reduce<
  Record<string, OrganisationRoom["type"]>
>((acc, [type, coding]) => {
  acc[coding.code] = type as OrganisationRoom["type"];
  return acc;
}, {});

const ensureOrganisationReference = (organisationId: string): string => {
  if (!organisationId) {
    return "";
  }

  return organisationId.startsWith("Organization/")
    ? organisationId
    : `Organization/${organisationId}`;
};

const parseReferenceId = (reference?: string): string | undefined => {
  if (!reference) {
    return undefined;
  }

  const trimmed = reference.trim();

  if (!trimmed) {
    return undefined;
  }

  const segments = trimmed.split("/");
  return segments.length ? segments.at(-1) ?? undefined : undefined;
};

type FHIRIdentifier = NonNullable<FHIRLocation["identifier"]>[number];

const buildIdentifiers = (
  room: OrganisationRoom
): NonNullable<FHIRLocation["identifier"]> | undefined => {
  const identifiers: NonNullable<FHIRLocation["identifier"]> = [];

  if (room.id) {
    identifiers.push({
      system: ROOM_IDENTIFIER_SYSTEM,
      value: room.id,
    });
  }

  if (room.organisationId) {
    identifiers.push({
      system: ORGANISATION_IDENTIFIER_SYSTEM,
      value: room.organisationId,
    });
  }

  return identifiers.length ? identifiers : undefined;
};

const buildType = (room: OrganisationRoom): FHIRLocation["type"] => {
  const coding = ROOM_TYPE_CODING_MAP[room.type];

  if (!coding) {
    return undefined;
  }

  return [
    {
      coding: [
        {
          system: ROOM_TYPE_SYSTEM,
          code: coding.code,
          display: coding.display,
        },
      ],
      text: coding.display,
    },
  ];
};

const buildExtensions = (room: OrganisationRoom): Extension[] | undefined => {
  const extensions: Extension[] = [];

  if (room.assignedSpecialiteis?.length) {
    extensions.push({
      url: SPECIALITIES_EXTENSION_URL,
      extension: room.assignedSpecialiteis
        .filter(Boolean)
        .map<Extension>((specialityId) => ({
          url: SPECIALITY_CHILD_URL,
          valueString: specialityId,
        })),
    });
  }

  if (room.assignedStaffs?.length) {
    extensions.push({
      url: STAFFS_EXTENSION_URL,
      extension: room.assignedStaffs
        .filter(Boolean)
        .map<Extension>((staffId) => ({
          url: STAFF_CHILD_URL,
          valueString: staffId,
        })),
    });
  }

  return extensions.length ? extensions : undefined;
};

const findIdentifierValue = (
  identifiers: FHIRLocation["identifier"],
  system: string
): string | undefined =>
  identifiers?.find((identifier: FHIRIdentifier) => identifier.system === system)?.value;

const parseArrayExtension = (
  extensions: Extension[] | undefined,
  url: string,
  childUrl: string
): string[] | undefined => {
  const parent = extensions?.find((extension) => extension.url === url);

  if (!parent?.extension?.length) {
    return undefined;
  }

  const values = parent.extension
    .map((child) => (child.url === childUrl ? child.valueString?.trim() : undefined))
    .filter((value): value is string => value !== undefined);

  return values.length ? values : undefined;
};

const resolveOrganisationId = (resource: FHIRLocation): string | undefined => {
  const referenceId = parseReferenceId(resource.managingOrganization?.reference);

  if (referenceId) {
    return referenceId;
  }

  return findIdentifierValue(resource.identifier, ORGANISATION_IDENTIFIER_SYSTEM);
};

const parseRoomType = (resource: FHIRLocation): OrganisationRoom["type"] => {
  const coding = resource.type?.[0]?.coding?.[0];

  if (coding?.code) {
    const mapped = REVERSE_ROOM_TYPE_CODING_MAP[coding.code];
    if (mapped) {
      return mapped;
    }
  }

  return "CONSULTATION";
};

export const toFHIROrganisationRoom = (room: OrganisationRoom): FHIRLocation => ({
  resourceType: "Location",
  id: room.id,
  name: room.name,
  identifier: buildIdentifiers(room),
  managingOrganization: {
    reference: ensureOrganisationReference(room.organisationId),
    type: "Organization",
  },
  type: buildType(room),
  physicalType: {
    coding: [
      {
        system: PHYSICAL_TYPE_SYSTEM,
        code: PHYSICAL_TYPE_ROOM_CODE,
        display: "Room",
      },
    ],
    text: "Room",
  },
  extension: buildExtensions(room),
});

export const fromFHIROrganisationRoom = (resource: FHIRLocation): OrganisationRoom => {
  const extensions = resource.extension;

  return {
    id: resource.id ?? findIdentifierValue(resource.identifier, ROOM_IDENTIFIER_SYSTEM) ?? "",
    name: resource.name ?? "",
    organisationId: resolveOrganisationId(resource) ?? "",
    type: parseRoomType(resource),
    assignedSpecialiteis: parseArrayExtension(
      extensions,
      SPECIALITIES_EXTENSION_URL,
      SPECIALITY_CHILD_URL
    ),
    assignedStaffs: parseArrayExtension(extensions, STAFFS_EXTENSION_URL, STAFF_CHILD_URL),
  };
};

export const toFHIROrganizationRoom = toFHIROrganisationRoom;
export const fromFHIROrganizationRoom = fromFHIROrganisationRoom;
