import {
  EMPTY_STORED_COMPANION,
  EMPTY_STORED_PARENT,
  CompanionFormData,
  AlertPriority,
  CountryDialCodeOption,
  toStoredCompanionAlerts,
} from '@/app/features/companions/components/AddCompanion/type';
import { getEmailValidationError, validatePhone, toTitleCase } from '@/app/lib/validators';
import { CompanionType, RecordStatus } from '@yosemite-crew/types';
import { formatDisplayDate, formatCompanionAge } from '@/app/lib/date';
import {
  fetchBreedCodeEntries,
  BreedCodeEntry,
} from '@/app/features/companions/services/codeEntriesService';
import {
  searchParent,
  createCompanion,
  createParent,
  linkCompanion,
  updateParent,
} from '@/app/features/companions/services/companionService';
import { StoredCompanion, StoredParent } from '@/app/features/companions/pages/Companions/types';

export type SpeciesOption = {
  value: string;
  label: string;
  type: CompanionType;
  speciesCode: string;
  speciesQuery: string;
};
export type BreedOption = { value: string; label: string; breedCode: string; speciesCode: string };

export const DEFAULT_SPECIES_OPTIONS: SpeciesOption[] = [
  { label: 'Canine', value: 'dog', type: 'dog', speciesCode: '', speciesQuery: 'canine' },
  { label: 'Feline', value: 'cat', type: 'cat', speciesCode: '', speciesQuery: 'feline' },
  { label: 'Equine', value: 'horse', type: 'horse', speciesCode: '', speciesQuery: 'equine' },
];

export const SPECIES_LABEL: Record<string, string> = {
  dog: 'Canine',
  cat: 'Feline',
  horse: 'Equine',
  other: 'Other',
};

export const BLOOD_GROUP_OPTIONS_BY_SPECIES: Record<
  CompanionType,
  { value: string; label: string }[]
> = {
  cat: ['A', 'B', 'AB', 'Unknown'].map((g) => ({ value: g, label: g })),
  dog: [
    'DEA 1.1 Positive',
    'DEA 1.1 Negative',
    'DEA 1.2 Positive',
    'DEA 1.2 Negative',
    'DEA 3 Positive',
    'DEA 3 Negative',
    'DEA 4 Positive',
    'DEA 4 Negative',
    'DEA 5 Positive',
    'DEA 5 Negative',
    'DEA 7 Positive',
    'DEA 7 Negative',
    'Universal Donor',
    'Unknown',
  ].map((g) => ({ value: g, label: g })),
  horse: ['Aa', 'Ca', 'Da', 'Ka', 'Pa', 'Qa', 'Ua', 'Universal Donor', 'Unknown'].map((g) => ({
    value: g,
    label: g,
  })),
  other: [{ value: 'Unknown', label: 'Unknown' }],
};

export const STATUS_OPTIONS: { value: RecordStatus; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'archived', label: 'Archived' },
];

// Gender + neuter combined into one dropdown
export type GenderNeuter = { gender: string; neutered: boolean };

export const GENDER_NEUTER_OPTIONS: { value: string; label: string; data: GenderNeuter }[] = [
  { value: 'male-intact', label: 'Male', data: { gender: 'male', neutered: false } },
  { value: 'male-neutered', label: 'Male Neutered', data: { gender: 'male', neutered: true } },
  { value: 'female-intact', label: 'Female', data: { gender: 'female', neutered: false } },
  { value: 'female-spayed', label: 'Female Spayed', data: { gender: 'female', neutered: true } },
  { value: 'unknown-intact', label: 'Unknown', data: { gender: 'unknown', neutered: false } },
];

export const getGenderNeuterValue = (gender: string, neutered: boolean): string => {
  const match = GENDER_NEUTER_OPTIONS.find(
    (o) => o.data.gender === gender && o.data.neutered === neutered
  );
  return match?.value ?? 'unknown-intact';
};

export const toNonNegativeNumber = (value: string | number | undefined) => {
  const parsed = typeof value === 'number' ? value : Number.parseFloat((value ?? '').toString());
  if (Number.isNaN(parsed)) return undefined;
  return Math.max(0, parsed);
};

export const MAX_LOCAL_PHONE_LENGTH = 15;

export const ALERT_PRIORITY_OPTIONS: { value: AlertPriority; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
];

export const buildFullName = (firstName: string, lastName?: string | null): string =>
  lastName ? `${firstName} ${lastName}` : firstName;

export const deduplicateBreedEntries = (
  entries: BreedCodeEntry[],
  fallbackSpeciesCode: string
): BreedOption[] => {
  const seen = new Set<string>();
  return entries.reduce<BreedOption[]>((acc, e) => {
    if (!seen.has(e.display)) {
      seen.add(e.display);
      acc.push({
        value: e.display,
        label: e.display,
        breedCode: e.code,
        speciesCode: e.meta?.speciesCode ?? fallbackSpeciesCode,
      });
    }
    return acc;
  }, []);
};

export const loadBreedOptions = async (
  speciesOptions: SpeciesOption[],
  companionType: string,
  setBreedOptions: (opts: BreedOption[]) => void,
  signal: { cancelled: boolean }
) => {
  const sel = speciesOptions.find((o) => o.type === companionType);
  if (!sel) {
    setBreedOptions([]);
    return;
  }
  try {
    const entries = await fetchBreedCodeEntries(sel.speciesQuery);
    if (!signal.cancelled) setBreedOptions(deduplicateBreedEntries(entries, sel.speciesCode));
  } catch {
    if (!signal.cancelled) setBreedOptions([]);
  }
};

export const fmtDate = (v?: Date | string) => {
  if (!v) return '-';
  return formatDisplayDate(v, '-');
};

export const fmtAge = (dob?: Date | string) => formatCompanionAge(dob) || '-';

export const fmt = (v?: string | number | null) => String(v ?? '').trim() || '-';

export const getInputBorderClass = (error?: string): string =>
  error ? 'border-input-border-error!' : 'border-input-border-default!';

export type SearchOption = { value: string; label: string };

export const DROPDOWN_MAX_HEIGHT = 200;
export const DROPDOWN_MIN_HEIGHT = 72;

export type ModalMode = 'create' | 'view' | 'edit';

export type ExtCompanionForValidation = CompanionFormData;

export const validateParentFields = (
  parentFormData: StoredParent,
  selectedCountryCode: CountryDialCodeOption | null,
  localPhoneNumber: string
): Partial<Record<string, string>> => {
  const errs: Partial<Record<string, string>> = {};
  if (!parentFormData.firstName) errs.firstName = 'First name is required';
  if (!parentFormData.lastName) errs.lastName = 'Last name is required';
  const emailError = getEmailValidationError(parentFormData.email);
  if (emailError) errs.email = emailError;
  if (!selectedCountryCode?.dialCode) errs.countryCode = 'Country code is required';
  if (!localPhoneNumber) errs.phoneNumber = 'Number is required';
  if (!parentFormData.address.addressLine?.trim()) errs.addressLine = 'Address is required';
  if (!parentFormData.address.city?.trim()) errs.city = 'City is required';
  if (!parentFormData.address.state?.trim()) errs.state = 'State/Province is required';
  if (!parentFormData.address.postalCode?.trim()) errs.postalCode = 'Postal code is required';
  if (selectedCountryCode?.dialCode && localPhoneNumber) {
    if (!validatePhone(`${selectedCountryCode.dialCode}${localPhoneNumber}`))
      errs.phoneNumber = 'Enter a valid phone number';
  }
  return errs;
};

export const validateCompanionFields = (
  companionFormData: ExtCompanionForValidation,
  isFastTrack: boolean
): Partial<Record<string, string>> => {
  const errs: Partial<Record<string, string>> = {};
  if (!companionFormData.name) errs.name = 'Name is required';
  if (!companionFormData.type) errs.species = 'Species is required';
  if (!companionFormData.breed) errs.breed = 'Breed is required';
  if (!isFastTrack && companionFormData.isInsured) {
    if (!companionFormData.insurance?.companyName)
      errs.insuranceCompany = 'Company name is required';
    if (!companionFormData.insurance?.policyNumber)
      errs.insuranceNumber = 'Policy number is required';
  }
  return errs;
};

export type EditSnapshot = {
  companionName: string;
  companionType: string;
  companionBreed: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
};

export const EMPTY_SNAPSHOT: EditSnapshot = {
  companionName: EMPTY_STORED_COMPANION.name,
  companionType: EMPTY_STORED_COMPANION.type,
  companionBreed: EMPTY_STORED_COMPANION.breed,
  firstName: EMPTY_STORED_PARENT.firstName,
  lastName: EMPTY_STORED_PARENT.lastName ?? '',
  email: EMPTY_STORED_PARENT.email,
  phone: '',
};

export type ModalSyncState = {
  initialMode: ModalMode;
  showModal: boolean;
};

export const computeHasUnsavedChanges = (
  snap: EditSnapshot,
  companionFormData: ExtCompanionForValidation,
  parentFormData: StoredParent,
  localPhoneNumber: string
): boolean =>
  companionFormData.name !== snap.companionName ||
  (companionFormData.type ?? '') !== snap.companionType ||
  (companionFormData.breed ?? '') !== snap.companionBreed ||
  (parentFormData.firstName ?? '') !== snap.firstName ||
  (parentFormData.lastName ?? '') !== snap.lastName ||
  (parentFormData.email ?? '') !== snap.email ||
  localPhoneNumber !== snap.phone;

export const fetchParentResults = async (q: string): Promise<StoredParent[]> => {
  try {
    return await searchParent(q);
  } catch {
    return [];
  }
};

export const createCompanionFlow = async (
  normalizedParent: StoredParent,
  companionFormData: ExtCompanionForValidation
): Promise<StoredCompanion | undefined> => {
  if (normalizedParent.id) {
    const payload: StoredCompanion = {
      ...companionFormData,
      alerts: toStoredCompanionAlerts(companionFormData.alerts),
      parentId: normalizedParent.id,
    };
    // Persist parent-level edits (e.g. client alerts) for the existing parent;
    // createCompanion/linkCompanion only upsert the parent into the local store,
    // so without this the alerts would disappear after a refresh.
    if (companionFormData.id) {
      await updateParent(normalizedParent);
      return (await linkCompanion(payload, normalizedParent)) ?? undefined;
    }
    await updateParent(normalizedParent);
    return (await createCompanion(payload, normalizedParent)) ?? undefined;
  }
  const parentId = await createParent(normalizedParent);
  const pp: StoredParent = { ...normalizedParent, id: parentId! };
  return (
    (await createCompanion(
      {
        ...companionFormData,
        alerts: toStoredCompanionAlerts(companionFormData.alerts),
        parentId: parentId!,
      },
      pp
    )) ?? undefined
  );
};

export const getModalTitle = (
  mode: ModalMode,
  companionTitle: string,
  terminologyText: (text: string) => string
): string => {
  if (mode === 'view') return companionTitle || terminologyText('Patient Details');
  if (mode === 'edit') return terminologyText('Edit Patient / Client');
  return terminologyText('Add companion');
};

export const getSexLabel = (
  gender: string | undefined,
  isneutered: boolean | undefined
): string => {
  if (!gender) return '-';
  return (
    GENDER_NEUTER_OPTIONS.find(
      (o) => o.data.gender === gender && o.data.neutered === (isneutered ?? false)
    )?.label ?? toTitleCase(gender)
  );
};

export const isCompanionModalBusy = (isSubmitting: boolean, savingStatus: boolean): boolean =>
  isSubmitting || savingStatus;

export const getCompanionModalLoadingLabel = (savingStatus: boolean): string =>
  savingStatus ? 'Updating status…' : 'Saving companion…';
