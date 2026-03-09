export type CompanionTerminologyOption = 'PET' | 'ANIMAL' | 'COMPANION' | 'PATIENT';
export type TerminologyOrgType = 'HOSPITAL' | 'BOARDER' | 'BREEDER' | 'GROOMER';

type CompanionTermForms = {
  singular: string;
  plural: string;
};

const STORAGE_KEY = 'yc_companion_terminology_by_org';
const TEMP_STORAGE_KEY = 'yc_companion_terminology_pending';
const DEFAULT_OPTION: CompanionTerminologyOption = 'COMPANION';
const ORG_TYPE_DEFAULTS: Record<TerminologyOrgType, CompanionTerminologyOption> = {
  HOSPITAL: 'PATIENT',
  BOARDER: 'COMPANION',
  BREEDER: 'ANIMAL',
  GROOMER: 'PET',
};

const TERM_FORMS: Record<CompanionTerminologyOption, CompanionTermForms> = {
  PET: { singular: 'pet', plural: 'pets' },
  ANIMAL: { singular: 'animal', plural: 'animals' },
  COMPANION: { singular: 'companion', plural: 'companions' },
  PATIENT: { singular: 'patient', plural: 'patients' },
};

const SINGULAR_PATTERN = /\b(pet|animal|companion|patient)\b/gi;
const PLURAL_PATTERN = /\b(pets|animals|companions|patients)\b/gi;

const hasWindow = () => typeof window !== 'undefined';

const normalizeOrgId = (orgId?: string | null) => String(orgId ?? '').trim();
const normalizeOrgType = (orgType?: string | null) =>
  String(orgType ?? '')
    .trim()
    .toUpperCase();

export const getDefaultCompanionTerminologyForOrgType = (
  orgType?: string | null
): CompanionTerminologyOption => {
  const normalizedType = normalizeOrgType(orgType) as TerminologyOrgType;
  return ORG_TYPE_DEFAULTS[normalizedType] ?? DEFAULT_OPTION;
};

const matchCase = (source: string, target: string) => {
  if (!source) return target;
  if (source === source.toUpperCase()) return target.toUpperCase();
  const startsUpper =
    source[0] === source[0].toUpperCase() && source.slice(1) === source.slice(1).toLowerCase();
  if (startsUpper) {
    return target.charAt(0).toUpperCase() + target.slice(1);
  }
  return target.toLowerCase();
};

const parseStoredMap = (): Record<string, CompanionTerminologyOption> => {
  if (!hasWindow()) return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, string>;
    const entries = Object.entries(parsed).filter(([, value]) =>
      ['PET', 'ANIMAL', 'COMPANION', 'PATIENT'].includes(value)
    );
    return Object.fromEntries(entries) as Record<string, CompanionTerminologyOption>;
  } catch {
    return {};
  }
};

const writeStoredMap = (value: Record<string, CompanionTerminologyOption>) => {
  if (!hasWindow()) return false;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    window.dispatchEvent(new CustomEvent('yc:companion-terminology-changed'));
    return true;
  } catch {
    return false;
  }
};

export const getCompanionTerminologyOptions = () => [
  { value: 'COMPANION', label: 'Companion / Companions' },
  { value: 'PET', label: 'Pet / Pets' },
  { value: 'ANIMAL', label: 'Animal / Animals' },
  { value: 'PATIENT', label: 'Patient / Patients' },
];

export const getCompanionTerminologyForOrg = (
  orgId?: string | null,
  orgType?: string | null
): CompanionTerminologyOption => {
  const orgTypeDefault = getDefaultCompanionTerminologyForOrgType(orgType);
  const normalizedOrgId = normalizeOrgId(orgId);
  if (!normalizedOrgId) {
    if (!hasWindow()) return orgTypeDefault;
    const pending = window.localStorage.getItem(
      TEMP_STORAGE_KEY
    ) as CompanionTerminologyOption | null;
    if (pending && TERM_FORMS[pending]) return pending;
    return orgTypeDefault;
  }
  const mapping = parseStoredMap();
  return mapping[normalizedOrgId] ?? orgTypeDefault;
};

export const setPendingCompanionTerminology = (option: CompanionTerminologyOption) => {
  if (!hasWindow()) return false;
  try {
    window.localStorage.setItem(TEMP_STORAGE_KEY, option);
    return true;
  } catch {
    return false;
  }
};

export const bindPendingCompanionTerminologyToOrg = (orgId?: string | null) => {
  if (!hasWindow()) return false;
  const normalizedOrgId = normalizeOrgId(orgId);
  if (!normalizedOrgId) return false;
  try {
    const pending = window.localStorage.getItem(
      TEMP_STORAGE_KEY
    ) as CompanionTerminologyOption | null;
    if (!pending || !TERM_FORMS[pending]) return false;
    const mapping = parseStoredMap();
    mapping[normalizedOrgId] = pending;
    const saved = writeStoredMap(mapping);
    window.localStorage.removeItem(TEMP_STORAGE_KEY);
    return saved;
  } catch {
    return false;
  }
};

export const setCompanionTerminologyForOrg = (
  orgId: string | undefined,
  option: CompanionTerminologyOption
) => {
  const normalizedOrgId = normalizeOrgId(orgId);
  if (!normalizedOrgId) return false;
  const mapping = parseStoredMap();
  mapping[normalizedOrgId] = option;
  return writeStoredMap(mapping);
};

export const rewriteCompanionTerminologyText = (
  input: string,
  option: CompanionTerminologyOption
) => {
  if (!input) return input;
  const forms = TERM_FORMS[option] ?? TERM_FORMS[DEFAULT_OPTION];
  const pluralReplaced = input.replace(PLURAL_PATTERN, (match) => matchCase(match, forms.plural));
  return pluralReplaced.replace(SINGULAR_PATTERN, (match) => matchCase(match, forms.singular));
};
