type CompanionOwnerInput =
  | string
  | {
      name?: string | null;
      firstName?: string | null;
      lastName?: string | null;
    }
  | null
  | undefined;

const normalize = (value?: string | null): string => String(value ?? '').trim();

export const getOwnerLastName = (owner?: CompanionOwnerInput): string => {
  if (!owner) return '';
  if (typeof owner === 'string') {
    const parts = owner
      .split(/\s+/)
      .map((part) => part.trim())
      .filter(Boolean);
    return parts.length >= 2 ? (parts.at(-1) ?? '') : '';
  }

  const explicitLastName = normalize(owner.lastName);
  if (explicitLastName) return explicitLastName;

  const fullName = normalize(owner.name);
  if (fullName) {
    const parts = fullName
      .split(/\s+/)
      .map((part) => part.trim())
      .filter(Boolean);
    if (parts.length >= 2) return parts.at(-1) ?? '';
  }
  return '';
};

export const getOwnerFirstName = (owner?: CompanionOwnerInput): string => {
  if (!owner) return '';
  if (typeof owner === 'string') {
    const parts = owner
      .split(/\s+/)
      .map((part) => part.trim())
      .filter(Boolean);
    return parts.at(0) ?? '';
  }

  const explicitFirstName = normalize(owner.firstName);
  if (explicitFirstName) {
    const parts = explicitFirstName
      .split(/\s+/)
      .map((part) => part.trim())
      .filter(Boolean);
    return parts.at(0) ?? '';
  }

  const fullName = normalize(owner.name);
  if (!fullName) return '';
  const parts = fullName
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.at(0) ?? '';
};

export const formatCompanionNameWithOwnerLastName = (
  companionName?: string | null,
  owner?: CompanionOwnerInput,
  fallback = '-'
): string => {
  const safeCompanionName = normalize(companionName);
  if (!safeCompanionName) return fallback;

  const ownerLastName = getOwnerLastName(owner);
  if (!ownerLastName) return safeCompanionName;

  return `${safeCompanionName} · ${ownerLastName}`;
};
