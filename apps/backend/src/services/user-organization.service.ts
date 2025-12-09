import { Types } from "mongoose";
import UserOrganizationModel, {
  type UserOrganizationDocument,
  type UserOrganizationMongo,
} from "../models/user-organization";
import OrganizationModel, {
} from "../models/organization";
import {
  fromUserOrganizationRequestDTO,
  toUserOrganizationResponseDTO,
  type UserOrganizationRequestDTO,
  type UserOrganizationResponseDTO,
  type UserOrganization,
} from "@yosemite-crew/types";
import { ROLE_PERMISSIONS, RoleCode } from "src/models/role-permission";

export type UserOrganizationFHIRPayload = UserOrganizationRequestDTO;

export class UserOrganizationServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "UserOrganizationServiceError";
  }
}

const VALID_ROLE_CODES: Set<RoleCode> = new Set([
  "OWNER",
  "ADMIN",
  "SUPERVISOR",
  "VETERINARIAN",
  "TECHNICIAN",
  "ASSISTANT",
  "RECEPTIONIST",
]);

function validateRoleCode(role: string): RoleCode {
  const cleaned = role.trim().toUpperCase() as RoleCode;
  if (!VALID_ROLE_CODES.has(cleaned)) {
    throw new UserOrganizationServiceError(
      `Invalid roleCode "${role}". Allowed: ${[...VALID_ROLE_CODES].join(", ")}`,
      400
    );
  }
  return cleaned;
}

function computeEffectivePermissions(
  role: RoleCode,
  extra?: string[]
): string[] {
  const base = ROLE_PERMISSIONS[role] ?? [];
  const extras = extra ?? [];
  return [...new Set([...base, ...extras])];
}

const pruneUndefined = <T>(value: T): T => {
  if (Array.isArray(value)) {
    const arrayValue = value as unknown[];
    const cleaned: unknown[] = arrayValue
      .map((item) => pruneUndefined(item))
      .filter((item) => item !== undefined);
    return cleaned as unknown as T;
  }

  if (value && typeof value === "object") {
    if (value instanceof Date) {
      return value;
    }

    const record = value as Record<string, unknown>;
    const cleanedRecord: Record<string, unknown> = {};

    for (const [key, entryValue] of Object.entries(record)) {
      const next = pruneUndefined(entryValue);

      if (next !== undefined) {
        cleanedRecord[key] = next;
      }
    }

    return cleanedRecord as unknown as T;
  }

  return value;
};

const requireSafeString = (value: unknown, fieldName: string): string => {
  if (value == null) {
    throw new UserOrganizationServiceError(`${fieldName} is required.`, 400);
  }

  if (typeof value !== "string") {
    throw new UserOrganizationServiceError(
      `${fieldName} must be a string.`,
      400,
    );
  }

  const trimmed = value.trim();

  if (!trimmed) {
    throw new UserOrganizationServiceError(
      `${fieldName} cannot be empty.`,
      400,
    );
  }

  if (trimmed.includes("$")) {
    throw new UserOrganizationServiceError(
      `Invalid character in ${fieldName}.`,
      400,
    );
  }

  return trimmed;
};

const optionalSafeString = (
  value: unknown,
  fieldName: string,
): string | undefined => {
  if (value == null) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new UserOrganizationServiceError(
      `${fieldName} must be a string.`,
      400,
    );
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return undefined;
  }

  if (trimmed.includes("$")) {
    throw new UserOrganizationServiceError(
      `Invalid character in ${fieldName}.`,
      400,
    );
  }

  return trimmed;
};

const sanitizePermissionList = (
  value: unknown,
  fieldName: string,
): string[] => {
  if (value == null) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new UserOrganizationServiceError(
      `${fieldName} must be an array of strings.`,
      400,
    );
  }

  const seen = new Set<string>();

  for (const entry of value) {
    const safe = optionalSafeString(entry, fieldName);
    if (safe) {
      seen.add(safe);
    }
  }

  return [...seen];
};

const ensureSafeIdentifier = (value: unknown): string | undefined => {
  const identifier = optionalSafeString(value, "Identifier");

  if (!identifier) {
    return undefined;
  }

  if (
    !Types.ObjectId.isValid(identifier) &&
    !/^[A-Za-z0-9\-.]{1,64}$/.test(identifier)
  ) {
    throw new UserOrganizationServiceError("Invalid identifier format.", 400);
  }

  return identifier;
};

const extractOrganizationIdentifier = (reference: string): string => {
  const trimmed = reference.trim();

  if (!trimmed) {
    throw new UserOrganizationServiceError(
      "Organization reference cannot be empty.",
      400,
    );
  }

  const segments = trimmed.split("/").filter(Boolean);

  if (!segments.length) {
    throw new UserOrganizationServiceError(
      "Invalid organization reference format.",
      400,
    );
  }

  const lastSegment = segments.at(-1);

  if (!lastSegment || lastSegment.toLowerCase() === "organization") {
    throw new UserOrganizationServiceError(
      "Invalid organization reference format.",
      400,
    );
  }

  return lastSegment;
};

const buildOrganizationLookupQuery = (reference: string) => {
  const identifier = extractOrganizationIdentifier(reference);
  const queries: Array<Record<string, string>> = [];

  if (Types.ObjectId.isValid(identifier)) {
    queries.push({ _id: identifier });
  }

  if (/^[A-Za-z0-9\-.]{1,64}$/.test(identifier)) {
    queries.push({ fhirId: identifier });
  }

  if (!queries.length) {
    throw new UserOrganizationServiceError(
      "Invalid organization reference format.",
      400,
    );
  }

  return queries.length === 1 ? queries[0] : { $or: queries };
};

const sanitizeUserOrganizationAttributes = (
  dto: UserOrganization,
): UserOrganizationMongo => {
  const practitionerReference = requireSafeString(
    dto.practitionerReference,
    "Practitioner reference",
  );
  const organizationReference = requireSafeString(
    dto.organizationReference,
    "Organization reference",
  );
  const roleCode = requireSafeString(dto.roleCode, "Role code");
  const roleDisplay = optionalSafeString(dto.roleDisplay, "Role display");
  const extraPermissions = sanitizePermissionList(
    dto.extraPermissions,
    "Extra permissions",
  );

  const effectivePermissions = computeEffectivePermissions(
    roleCode as RoleCode,
    extraPermissions,
  );
  
  return {
    fhirId: ensureSafeIdentifier(dto.id),
    practitionerReference,
    organizationReference,
    roleCode,
    roleDisplay,
    active: typeof dto.active === "boolean" ? dto.active : true,
    extraPermissions,
    effectivePermissions,
  };
};

const buildUserOrganizationDomain = (
  document: UserOrganizationDocument,
): UserOrganization => {
  const { _id, ...rest } = document.toObject({
    virtuals: false,
  }) as UserOrganizationMongo & {
    _id: Types.ObjectId;
  };

  return {
    _id,
    fhirId: rest.fhirId,
    practitionerReference: rest.practitionerReference,
    organizationReference: rest.organizationReference,
    roleCode: rest.roleCode,
    roleDisplay: rest.roleDisplay,
    active: rest.active,
    extraPermissions: rest.extraPermissions ?? [],
    effectivePermissions: computeEffectivePermissions(
      rest.roleCode as RoleCode,
      rest.extraPermissions,
    ),
  };
};

const createPersistableFromFHIR = (payload: UserOrganizationFHIRPayload) => {
  if (payload?.resourceType !== "PractitionerRole") {
    throw new UserOrganizationServiceError(
      "Invalid payload. Expected FHIR PractitionerRole resource.",
      400,
    );
  }

  const attributes = fromUserOrganizationRequestDTO(payload);
  const persistable = pruneUndefined(
    sanitizeUserOrganizationAttributes(attributes),
  );

  return { persistable };
};

const normalizeLookupIdentifier = (
  value: unknown,
  fieldName: string,
): string => {
  const identifier = optionalSafeString(value, fieldName);

  if (!identifier) {
    throw new UserOrganizationServiceError(`${fieldName} is required.`, 400);
  }

  return identifier;
};

const resolveIdQuery = (
  id: unknown,
): { _id?: string; fhirId?: string } | null => {
  const identifier = normalizeLookupIdentifier(id, "Identifier");

  if (Types.ObjectId.isValid(identifier)) {
    return { _id: identifier };
  }

  if (/^[A-Za-z0-9\-.]{1,64}$/.test(identifier)) {
    return { fhirId: identifier };
  }

  return null;
};

const resolveStrictIdQuery = (
  id: unknown,
  context: string,
): { _id?: string; fhirId?: string } => {
  const query = resolveIdQuery(id);

  if (!query) {
    throw new UserOrganizationServiceError(`Invalid ${context} format.`, 400);
  }

  return query;
};

type ReferenceLookup = Partial<
  Record<"practitionerReference" | "organizationReference", string>
>;

const buildReferenceLookups = (id: unknown): ReferenceLookup[] => {
  const trimmed = normalizeLookupIdentifier(id, "Identifier");

  if (!trimmed) {
    return [];
  }

  const lookups: ReferenceLookup[] = [];
  const seen = new Set<string>();
  const pushLookup = (
    field: "practitionerReference" | "organizationReference",
    reference: string,
  ) => {
    const key = `${field}:${reference}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    lookups.push({ [field]: reference });
  };

  if (trimmed.includes("/")) {
    if (trimmed.startsWith("Practitioner/")) {
      pushLookup("practitionerReference", trimmed);
    } else if (trimmed.startsWith("Organization/")) {
      pushLookup("organizationReference", trimmed);
    } else {
      pushLookup("practitionerReference", trimmed);
      pushLookup("organizationReference", trimmed);
    }
  } else {
    pushLookup("practitionerReference", trimmed);
    pushLookup("organizationReference", trimmed);
    pushLookup("practitionerReference", `Practitioner/${trimmed}`);
    pushLookup("organizationReference", `Organization/${trimmed}`);
  }

  return lookups;
};

export const UserOrganizationService = {
  async upsert(payload: UserOrganizationFHIRPayload) {
    const { persistable } = createPersistableFromFHIR(payload);
    validateRoleCode(persistable.roleCode)

    const id = ensureSafeIdentifier(payload.id ?? persistable.fhirId);
    let document: UserOrganizationDocument | null = null;
    let created = false;

    if (id) {
      document = await UserOrganizationModel.findOneAndUpdate(
        resolveStrictIdQuery(id, "identifier"),
        { $set: persistable },
        { new: true, sanitizeFilter: true },
      );
    }

    if (!document) {
      const existing = await UserOrganizationModel.findOne({
        practitionerReference: persistable.practitionerReference,
        organizationReference: persistable.organizationReference,
        roleCode: persistable.roleCode,
      }).setOptions({ sanitizeFilter: true });

      if (existing) {
        document = await UserOrganizationModel.findOneAndUpdate(
          { _id: existing._id },
          { $set: persistable },
          { new: true, sanitizeFilter: true },
        );
      } else {
        document = await UserOrganizationModel.create(persistable);
        created = true;
      }
    }

    if (!document) {
      throw new UserOrganizationServiceError(
        "Unable to persist user-organization mapping.",
        500,
      );
    }

    const mapping = buildUserOrganizationDomain(document);
    return {
      response: toUserOrganizationResponseDTO(mapping),
      created,
    };
  },

  async create(payload: UserOrganizationFHIRPayload) {
    const { persistable } = createPersistableFromFHIR(payload);
    validateRoleCode(persistable.roleCode)

    const document = await UserOrganizationModel.create(persistable);
    const mapping = buildUserOrganizationDomain(document);

    return toUserOrganizationResponseDTO(mapping);
  },

  async getById(
    id: string,
  ): Promise<
    UserOrganizationResponseDTO | UserOrganizationResponseDTO[] | null
  > {
    let document: UserOrganizationDocument | null = null;
    const idQuery = resolveIdQuery(id);

    if (idQuery) {
      document = await UserOrganizationModel.findOne(idQuery, null, {
        sanitizeFilter: true,
      });
    }

    if (!document) {
      const referenceQueries = buildReferenceLookups(id);

      if (referenceQueries.length) {
        const documents = await UserOrganizationModel.find({
          $or: referenceQueries,
        }).setOptions({
          sanitizeFilter: true,
        });

        if (!documents.length) {
          return null;
        }

        if (documents.length === 1) {
          const mapping = buildUserOrganizationDomain(documents[0]);
          return toUserOrganizationResponseDTO(mapping);
        }

        const mappings = documents.map((doc) =>
          buildUserOrganizationDomain(doc),
        );
        return mappings.map((mapping) =>
          toUserOrganizationResponseDTO(mapping),
        );
      }
    }

    if (!document) {
      return null;
    }

    const mapping = buildUserOrganizationDomain(document);
    return toUserOrganizationResponseDTO(mapping);
  },

  async listAll() {
    const documents = await UserOrganizationModel.find();
    const mappings = documents.map((document) =>
      buildUserOrganizationDomain(document),
    );

    return mappings.map((mapping) => toUserOrganizationResponseDTO(mapping));
  },

  async deleteById(id: string) {
    const result = await UserOrganizationModel.findOneAndDelete(
      resolveStrictIdQuery(id, "identifier"),
      {
        sanitizeFilter: true,
      },
    );
    return Boolean(result);
  },

  async update(id: string, payload: UserOrganizationFHIRPayload) {
    const { persistable } = createPersistableFromFHIR(payload);
    validateRoleCode(persistable.roleCode);

    const document = await UserOrganizationModel.findOneAndUpdate(
      resolveStrictIdQuery(id, "identifier"),
      { $set: persistable },
      { new: true, sanitizeFilter: true },
    );

    if (!document) {
      return null;
    }

    const mapping = buildUserOrganizationDomain(document);
    return toUserOrganizationResponseDTO(mapping);
  },

  async createUserOrganizationMapping(userOrganisation: UserOrganization) {
    const persistable = pruneUndefined(
      sanitizeUserOrganizationAttributes(userOrganisation),
    );
    const document = await UserOrganizationModel.create(persistable);
    if (!document) {
      throw new UserOrganizationServiceError(
        "Unable to create user-organization mapping.",
        500,
      );
    }
  },

  async deleteAllByOrganizationId(organisationId: string) {
    const orgId = requireSafeString(organisationId, "Organization Identifier");

    await UserOrganizationModel.deleteMany({
      organizationReference: orgId,
    }).exec();
  },

  async listByUserId(id: string) {
    const userId = requireSafeString(id, "User Id");
    const mappings = await UserOrganizationModel.find({
      practitionerReference: userId,
    });

    if (!mappings.length) {
      return [];
    }

    const results = [];

    for (const mapping of mappings) {
      const orgRef = mapping.organizationReference;

      // Extract the ID portion from FHIR reference
      const organizationId = extractOrganizationIdentifier(orgRef);

      // Build query using your existing helper
      const orgQuery = buildOrganizationLookupQuery(organizationId);

      // Lookup organization
      const organizationDoc = await OrganizationModel.findOne(orgQuery);

      const organization = organizationDoc?.toObject?.() ?? null; // convert mongoose doc to object

      const mappingDomain = buildUserOrganizationDomain(mapping);

      results.push({
        mapping: toUserOrganizationResponseDTO(mappingDomain),
        organization: organization,
      });
    }
    return results;
  },
};
