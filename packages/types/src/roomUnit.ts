import type { Extension, Location as FHIRLocation } from '@yosemite-crew/fhir';

export type RoomUnit = {
  id: string;
  organisationId: string;
  roomId: string;
  unitGroupId?: string;
  code: string;
  displayName: string;
  size?: string;
  speciesConstraints?: string[];
  isActive?: boolean;
  isOccupied?: boolean;
};

export type RoomUnitGroup = {
  id: string;
  organisationId: string;
  roomId: string;
  name: string;
  size?: string;
  unitCount: number;
  speciesConstraints?: string[];
  capabilities?: string[];
  isActive?: boolean;
};

const UNIT_IDENTIFIER_SYSTEM = 'http://example.org/fhir/NamingSystem/room-unit-id';
const ROOM_UNIT_CODE_SYSTEM = 'http://example.org/fhir/CodeSystem/room-unit';
const EXT_ROOM_UNIT_CODE = 'https://yosemitecrew.com/fhir/StructureDefinition/room-unit-code';
const EXT_ROOM_UNIT_SIZE = 'https://yosemitecrew.com/fhir/StructureDefinition/room-unit-size';
const EXT_ROOM_UNIT_SPECIES = 'https://yosemitecrew.com/fhir/StructureDefinition/room-unit-species';
const EXT_ROOM_UNIT_ACTIVE = 'https://yosemitecrew.com/fhir/StructureDefinition/room-unit-active';
const EXT_ROOM_UNIT_OCCUPIED =
  'https://yosemitecrew.com/fhir/StructureDefinition/room-unit-occupied';
const EXT_ROOM_UNIT_GROUP = 'https://yosemitecrew.com/fhir/StructureDefinition/room-unit-group';
const EXT_ROOM_UNIT_GROUP_SIZE =
  'https://yosemitecrew.com/fhir/StructureDefinition/room-unit-group-size';
const EXT_ROOM_UNIT_GROUP_COUNT =
  'https://yosemitecrew.com/fhir/StructureDefinition/room-unit-group-count';
const EXT_ROOM_UNIT_GROUP_SPECIES =
  'https://yosemitecrew.com/fhir/StructureDefinition/room-unit-group-species';
const EXT_ROOM_UNIT_GROUP_CAPABILITY =
  'https://yosemitecrew.com/fhir/StructureDefinition/room-unit-group-capability';
const EXT_ROOM_UNIT_GROUP_ACTIVE =
  'https://yosemitecrew.com/fhir/StructureDefinition/room-unit-group-active';

const parseReferenceId = (reference?: string): string | undefined => {
  const trimmed = reference?.trim();
  if (!trimmed) return undefined;
  const segments = trimmed.split('/');
  return segments.at(-1) ?? undefined;
};

const getStringExtension = (extensions: Extension[] | undefined, url: string): string | undefined =>
  extensions?.find((extension) => extension.url === url)?.valueString ?? undefined;

const getBooleanExtension = (
  extensions: Extension[] | undefined,
  url: string
): boolean | undefined =>
  extensions?.find((extension) => extension.url === url)?.valueBoolean ?? undefined;

const getStringArrayExtension = (
  extensions: Extension[] | undefined,
  url: string
): string[] | undefined => {
  const values = extensions
    ?.filter((extension) => extension.url === url)
    .map((extension) => extension.valueString?.trim())
    .filter((value): value is string => Boolean(value));

  return values?.length ? values : undefined;
};

export const toFHIRRoomUnit = (unit: RoomUnit): FHIRLocation => ({
  resourceType: 'Location',
  id: unit.id,
  identifier: [
    {
      system: UNIT_IDENTIFIER_SYSTEM,
      value: unit.id,
    },
  ],
  name: unit.displayName,
  managingOrganization: {
    reference: `Organization/${unit.organisationId}`,
  },
  partOf: {
    reference: `Location/${unit.roomId}`,
  },
  physicalType: {
    coding: [
      {
        system: ROOM_UNIT_CODE_SYSTEM,
        code: 'unit',
        display: 'Unit',
      },
    ],
    text: 'Unit',
  },
  extension: [
    {
      url: EXT_ROOM_UNIT_CODE,
      valueString: unit.code,
    },
    ...(unit.unitGroupId
      ? [
          {
            url: EXT_ROOM_UNIT_GROUP,
            valueString: unit.unitGroupId,
          },
        ]
      : []),
    ...(unit.size
      ? [
          {
            url: EXT_ROOM_UNIT_SIZE,
            valueString: unit.size,
          },
        ]
      : []),
    ...(unit.speciesConstraints?.map<Extension>((species) => ({
      url: EXT_ROOM_UNIT_SPECIES,
      valueString: species,
    })) ?? []),
    {
      url: EXT_ROOM_UNIT_ACTIVE,
      valueBoolean: unit.isActive ?? true,
    },
    ...(typeof unit.isOccupied === 'boolean'
      ? [
          {
            url: EXT_ROOM_UNIT_OCCUPIED,
            valueBoolean: unit.isOccupied,
          },
        ]
      : []),
  ],
});

export const fromFHIRRoomUnit = (resource: FHIRLocation): RoomUnit => ({
  id: resource.id ?? '',
  organisationId: parseReferenceId(resource.managingOrganization?.reference) ?? '',
  roomId: parseReferenceId(resource.partOf?.reference) ?? '',
  unitGroupId: getStringExtension(resource.extension, EXT_ROOM_UNIT_GROUP),
  code: getStringExtension(resource.extension, EXT_ROOM_UNIT_CODE) ?? '',
  displayName: resource.name ?? '',
  size: getStringExtension(resource.extension, EXT_ROOM_UNIT_SIZE),
  speciesConstraints: getStringArrayExtension(resource.extension, EXT_ROOM_UNIT_SPECIES),
  isActive: getBooleanExtension(resource.extension, EXT_ROOM_UNIT_ACTIVE) ?? true,
  isOccupied: getBooleanExtension(resource.extension, EXT_ROOM_UNIT_OCCUPIED),
});

export const toFHIRRoomUnitGroup = (group: RoomUnitGroup): FHIRLocation => ({
  resourceType: 'Location',
  id: group.id,
  identifier: [
    {
      system: 'http://example.org/fhir/NamingSystem/room-unit-group-id',
      value: group.id,
    },
  ],
  name: group.name,
  managingOrganization: {
    reference: `Organization/${group.organisationId}`,
  },
  partOf: {
    reference: `Location/${group.roomId}`,
  },
  physicalType: {
    coding: [
      {
        system: ROOM_UNIT_CODE_SYSTEM,
        code: 'unit-group',
        display: 'Unit Group',
      },
    ],
    text: 'Unit Group',
  },
  extension: [
    ...(group.size
      ? [
          {
            url: EXT_ROOM_UNIT_GROUP_SIZE,
            valueString: group.size,
          },
        ]
      : []),
    {
      url: EXT_ROOM_UNIT_GROUP_COUNT,
      valueInteger: group.unitCount,
    },
    ...(group.speciesConstraints?.map<Extension>((species) => ({
      url: EXT_ROOM_UNIT_GROUP_SPECIES,
      valueString: species,
    })) ?? []),
    ...(group.capabilities?.map<Extension>((capability) => ({
      url: EXT_ROOM_UNIT_GROUP_CAPABILITY,
      valueString: capability,
    })) ?? []),
    {
      url: EXT_ROOM_UNIT_GROUP_ACTIVE,
      valueBoolean: group.isActive ?? true,
    },
  ],
});

export const fromFHIRRoomUnitGroup = (resource: FHIRLocation): RoomUnitGroup => ({
  id: resource.id ?? '',
  organisationId: parseReferenceId(resource.managingOrganization?.reference) ?? '',
  roomId: parseReferenceId(resource.partOf?.reference) ?? '',
  name: resource.name ?? '',
  size: getStringExtension(resource.extension, EXT_ROOM_UNIT_GROUP_SIZE),
  unitCount:
    resource.extension?.find((extension) => extension.url === EXT_ROOM_UNIT_GROUP_COUNT)
      ?.valueInteger ?? 0,
  speciesConstraints: getStringArrayExtension(resource.extension, EXT_ROOM_UNIT_GROUP_SPECIES),
  capabilities: getStringArrayExtension(resource.extension, EXT_ROOM_UNIT_GROUP_CAPABILITY),
  isActive: getBooleanExtension(resource.extension, EXT_ROOM_UNIT_GROUP_ACTIVE) ?? true,
});
