export const modelsRequiringCompanionId = new Set([
  "CompanionOrganisation",
  "Document",
  "ParentCompanion",
]);

const slugifyRoomCode = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");

export const getMissingCompanionForeignKeyReason = (
  prismaName: string,
  data: Record<string, unknown>,
  existingCompanionIds: Set<string>,
): string | null => {
  if (!modelsRequiringCompanionId.has(prismaName)) {
    return null;
  }

  const companionId = data.companionId;
  if (typeof companionId !== "string" || companionId.trim().length === 0) {
    return "missing companionId";
  }

  if (!existingCompanionIds.has(companionId)) {
    return `unknown companionId ${companionId}`;
  }

  return null;
};

export const deriveOrganisationRoomCode = (args: {
  data: Record<string, unknown>;
}): string | null => {
  const code = args.data.code;
  if (typeof code === "string" && code.trim().length > 0) {
    return code.trim();
  }

  const fhirId = args.data.fhirId;
  if (typeof fhirId === "string" && fhirId.trim().length > 0) {
    return fhirId.trim();
  }

  const name = args.data.name;
  const id = args.data.id;
  if (typeof name === "string" && name.trim().length > 0) {
    const slug = slugifyRoomCode(name);
    if (slug.length > 0 && typeof id === "string" && id.trim().length > 0) {
      return `${slug}-${id.trim().slice(0, 6)}`;
    }
    if (slug.length > 0) {
      return slug;
    }
  }

  if (typeof id === "string" && id.trim().length > 0) {
    return `room-${id.trim().slice(0, 6)}`;
  }

  return null;
};
