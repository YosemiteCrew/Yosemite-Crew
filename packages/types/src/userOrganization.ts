import type { PractitionerRole } from "@yosemite-crew/fhirtypes"

type StringableId = { toString(): string }

export interface UserOrganization {
    id?: string
    _id?: StringableId
    fhirId?: string
    practitionerReference: string
    organizationReference: string
    roleCode: string
    roleDisplay?: string
    active?: boolean
    extraPermissions?: string[];
    revokedPermissions?: string[];
    effectivePermissions?: string[];
}

export type ToFHIRUserOrganizationOptions = {
    roleSystem?: string
    roleText?: string
}

const EXT_EXTRA_PERMISSIONS =
  "https://yosemitecrew.com/fhir/StructureDefinition/extra-permissions";

const EXT_EFFECTIVE_PERMISSIONS =
  "https://yosemitecrew.com/fhir/StructureDefinition/effective-permissions";

const EXT_REVOKED_PERMISSIONS =
  "https://yosemitecrew.com/fhir/StructureDefinition/revoked-permissions";

export function toFHIRUserOrganization(
  mapping: UserOrganization & { effectivePermissions?: string[] },
  options: ToFHIRUserOrganizationOptions = {}
): PractitionerRole {
  const identifier =
    mapping.fhirId ?? mapping.id ?? mapping._id?.toString();

  const practitioner = mapping.practitionerReference
    ? { reference: mapping.practitionerReference }
    : undefined;

  const organization = mapping.organizationReference
    ? { reference: mapping.organizationReference }
    : undefined;

  const roleText =
    mapping.roleDisplay ?? options.roleText ?? mapping.roleCode;

  const roleSystem =
    options.roleSystem ??
    "https://yosemitecrew.com/fhir/CodeSystem/user-organization-role";

  const code = mapping.roleCode
    ? [
        {
          coding: [
            {
              system: roleSystem,
              code: mapping.roleCode,
              display: roleText,
            },
          ],
          text: roleText,
        },
      ]
    : undefined;

  const extensions: any[] = [];

  // Add extra permissions extension
  if (mapping.extraPermissions?.length) {
    extensions.push({
      url: EXT_EXTRA_PERMISSIONS,
      extension: mapping.extraPermissions.map((perm) => ({
        url: "permission",
        valueString: perm,
      })),
    });
  }

  // Add effective permissions extension
  if (mapping.effectivePermissions?.length) {
    extensions.push({
      url: EXT_EFFECTIVE_PERMISSIONS,
      extension: mapping.effectivePermissions.map((perm) => ({
        url: "permission",
        valueString: perm,
      })),
    });
  }

  // Add revoked permissions extension
  if (mapping.revokedPermissions?.length) {
    extensions.push({
      url: EXT_REVOKED_PERMISSIONS,
      extension: mapping.revokedPermissions.map((perm) => ({
        url: "permission",
        valueString: perm,
      })),
    });
  }

  const resource: PractitionerRole = {
    resourceType: "PractitionerRole",
    practitioner,
    organization,
    active:
      typeof mapping.active === "boolean" ? mapping.active : undefined,
    code,
    extension: extensions.length ? extensions : undefined,
  };

  if (identifier) {
    resource.id = identifier;
  }

  return resource;
}

export function fromFHIRUserOrganization(dto: PractitionerRole): UserOrganization {
  const practitionerReference = dto.practitioner?.reference ?? "";
  const organizationReference = dto.organization?.reference ?? "";

  const coding = dto.code?.[0]?.coding?.[0];
  const text = dto.code?.[0]?.text ?? "";

  // Parse permissions from extensions
  let extraPermissions: string[] | undefined;
  let effectivePermissions: string[] | undefined;
  let revokedPermissions: string[] | undefined;

  dto.extension?.forEach((ext) => {
    if (ext.url === EXT_EXTRA_PERMISSIONS) {
      extraPermissions =
        ext.extension?.map((e) => e.valueString!) ?? [];
    }

    if (ext.url === EXT_EFFECTIVE_PERMISSIONS) {
      effectivePermissions =
        ext.extension?.map((e) => e.valueString!) ?? [];
    }

    if (ext.url === EXT_REVOKED_PERMISSIONS) {
      revokedPermissions =
        ext.extension?.map((e) => e.valueString!) ?? [];
    }
  });

  return {
    id: dto.id,
    practitionerReference,
    organizationReference,
    roleCode: coding?.code ?? text,
    roleDisplay: coding?.display ?? text,
    active: dto.active,
    extraPermissions,
    revokedPermissions,
    effectivePermissions, // optional but useful for debugging and syncing back
  };
}
