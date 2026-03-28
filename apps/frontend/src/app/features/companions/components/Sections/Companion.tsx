import React, { useEffect, useMemo, useState } from 'react';
import Accordion from '@/app/ui/primitives/Accordion/Accordion';
import FormInput from '@/app/ui/inputs/FormInput/FormInput';
import SelectLabel from '@/app/ui/inputs/SelectLabel';
import Datepicker from '@/app/ui/inputs/Datepicker';
import LabelDropdown from '@/app/ui/inputs/Dropdown/LabelDropdown';
import { Primary, Secondary } from '@/app/ui/primitives/Buttons';
import { CompanionParent, StoredCompanion } from '@/app/features/companions/pages/Companions/types';
import { updateCompanion } from '@/app/features/companions/services/companionService';
import {
  CountriesOptions,
  GenderOptions,
  InsuredOptions,
  getNeuteredOptions,
  OriginOptions,
} from '@/app/features/companions/components/AddCompanion/type';
import { CompanionType } from '@yosemite-crew/types';
import type { RecordStatus } from '@yosemite-crew/types';
import {
  fetchBreedCodeEntries,
  fetchSpeciesCodeEntries,
} from '@/app/features/companions/services/codeEntriesService';
import { formatDisplayDate } from '@/app/lib/date';
import { toTitleCase } from '@/app/lib/validators';

type OptionProp = {
  label: string;
  value: string;
};

type SpeciesOption = OptionProp & {
  type: CompanionType;
  speciesCode: string;
  speciesQuery: string;
};

type BreedOption = OptionProp & {
  breedCode: string;
  speciesCode: string;
};

type CompanionFormErrors = {
  type?: string;
  breed?: string;
  dateOfBirth?: string;
  insuranceCompany?: string;
  insuranceNumber?: string;
};

type CodeResolution = {
  speciesCode: string;
  breedCode: string;
  speciesChanged: boolean;
  breedChanged: boolean;
};

const DEFAULT_SPECIES_OPTIONS: SpeciesOption[] = [
  { label: 'Dog', value: 'dog', type: 'dog', speciesCode: '', speciesQuery: 'canine' },
  { label: 'Cat', value: 'cat', type: 'cat', speciesCode: '', speciesQuery: 'feline' },
  { label: 'Horse', value: 'horse', type: 'horse', speciesCode: '', speciesQuery: 'equine' },
];

const SPECIES_QUERY_BY_TYPE: Record<CompanionType, string> = {
  dog: 'canine',
  cat: 'feline',
  horse: 'equine',
  other: 'other',
};

const BLOOD_GROUP_OPTIONS_BY_SPECIES: Record<CompanionType, OptionProp[]> = {
  cat: ['A', 'B', 'AB', 'Unknown'].map((group) => ({
    value: group,
    label: group,
  })),
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
  ].map((group) => ({
    value: group,
    label: group,
  })),
  horse: ['Aa', 'Ca', 'Da', 'Ka', 'Pa', 'Qa', 'Ua', 'Universal Donor', 'Unknown'].map((group) => ({
    value: group,
    label: group,
  })),
  other: [{ value: 'Unknown', label: 'Unknown' }],
};

const COMPANION_STATUS_OPTIONS: OptionProp[] = [
  { value: 'active', label: 'Active' },
  { value: 'archived', label: 'Archived' },
];

const toNonNegativeNumber = (value: string | number | undefined) => {
  const parsed = typeof value === 'number' ? value : Number.parseFloat((value ?? '').toString());
  if (Number.isNaN(parsed)) {
    return undefined;
  }
  return Math.max(0, parsed);
};

const formatDateLabel = (value?: Date | string) => {
  if (!value) return '-';
  return formatDisplayDate(value, '-');
};

const formatStatusLabel = (status: RecordStatus | undefined) => {
  const normalizedStatus = String(status ?? 'inactive')
    .trim()
    .toLowerCase();
  if (!normalizedStatus) return 'Inactive';
  return toTitleCase(normalizedStatus);
};

const validateCompanionForm = (
  formData: StoredCompanion,
  currentDate: Date | null,
  isInsured: boolean
): CompanionFormErrors => {
  const errors: CompanionFormErrors = {};
  if (!formData.type) errors.type = 'Species is required';
  if (!formData.breed) errors.breed = 'Breed is required';
  if (!currentDate) errors.dateOfBirth = 'Date of birth is required';
  if (!isInsured) {
    return errors;
  }
  if (!String(formData.insurance?.companyName ?? '').trim()) {
    errors.insuranceCompany = 'Company name is required';
  }
  if (!String(formData.insurance?.policyNumber ?? '').trim()) {
    errors.insuranceNumber = 'Policy number is required';
  }
  return errors;
};

const hasErrors = (errors: CompanionFormErrors) => Object.keys(errors).length > 0;

const getInitialCodeResolution = (
  formData: StoredCompanion,
  companion: CompanionParent,
  speciesOptions: SpeciesOption[],
  breedOptions: BreedOption[]
): CodeResolution => {
  const selectedSpecies = speciesOptions.find((item) => item.type === formData.type);
  const selectedBreed = breedOptions.find((item) => item.value === formData.breed);
  const speciesChanged = formData.type !== companion.companion.type;
  const breedChanged = formData.breed !== companion.companion.breed;
  return {
    speciesCode:
      selectedBreed?.speciesCode || selectedSpecies?.speciesCode || formData.speciesCode || '',
    breedCode: selectedBreed?.breedCode || formData.breedCode || '',
    speciesChanged,
    breedChanged,
  };
};

const resolveSpeciesCodeIfNeeded = async (
  currentCode: string,
  speciesQuery: string
): Promise<string> => {
  if (currentCode) return currentCode;
  const speciesEntries = await fetchSpeciesCodeEntries();
  const speciesByDisplay = new Map(
    speciesEntries.map((entry) => [entry.display.toLowerCase(), entry.code])
  );
  return speciesByDisplay.get(speciesQuery) ?? currentCode;
};

const resolveBreedCodesIfNeeded = async (
  speciesCode: string,
  breedCode: string,
  speciesQuery: string,
  breed: string
): Promise<{ speciesCode: string; breedCode: string }> => {
  if (breedCode && speciesCode) {
    return { speciesCode, breedCode };
  }
  const breedEntries = await fetchBreedCodeEntries(speciesQuery);
  const matchedBreed = breedEntries.find((entry) => entry.display === breed);
  return {
    breedCode: matchedBreed?.code ?? breedCode,
    speciesCode: matchedBreed?.meta?.speciesCode ?? speciesCode,
  };
};

const resolveCompanionCodes = async (
  formData: StoredCompanion,
  companion: CompanionParent,
  speciesOptions: SpeciesOption[],
  breedOptions: BreedOption[]
): Promise<CodeResolution> => {
  const base = getInitialCodeResolution(formData, companion, speciesOptions, breedOptions);
  const speciesQuery = SPECIES_QUERY_BY_TYPE[formData.type];
  if (!(base.speciesChanged || base.breedChanged) || !speciesQuery) {
    return base;
  }
  try {
    const speciesCode = await resolveSpeciesCodeIfNeeded(base.speciesCode, speciesQuery);
    const resolved = await resolveBreedCodesIfNeeded(
      speciesCode,
      base.breedCode,
      speciesQuery,
      formData.breed
    );
    return { ...base, ...resolved };
  } catch (error) {
    console.log(error);
    return base;
  }
};

const getCodeResolutionErrors = (resolution: CodeResolution): CompanionFormErrors => {
  const errors: CompanionFormErrors = {};
  if (resolution.speciesChanged && !resolution.speciesCode) {
    errors.type = 'Unable to resolve species code for selected species.';
  }
  if (resolution.breedChanged && !resolution.breedCode) {
    errors.breed = 'Unable to resolve breed code for selected breed.';
  }
  return errors;
};

const buildCompanionPayload = (
  companion: CompanionParent,
  formData: StoredCompanion,
  currentDate: Date | null,
  isInsured: boolean,
  resolution: CodeResolution
): StoredCompanion => ({
  ...companion.companion,
  ...formData,
  dateOfBirth: currentDate ?? companion.companion.dateOfBirth,
  currentWeight: toNonNegativeNumber(formData.currentWeight as string | number | undefined),
  type: formData.type,
  speciesCode:
    resolution.speciesCode ||
    (resolution.speciesChanged
      ? ''
      : companion.companion.speciesCode || formData.speciesCode || ''),
  breedCode:
    resolution.breedCode ||
    (resolution.breedChanged ? '' : companion.companion.breedCode || formData.breedCode || ''),
  ageWhenNeutered: formData.isneutered ? String(formData.ageWhenNeutered ?? '').trim() : '',
  isInsured,
  insurance: isInsured
    ? {
        isInsured: true,
        companyName: String(formData.insurance?.companyName ?? '').trim(),
        policyNumber: String(formData.insurance?.policyNumber ?? '').trim(),
      }
    : undefined,
});

const getNeuteredStatusLabel = (
  gender: string | undefined,
  isNeutered: boolean | undefined
): string => {
  if (gender === 'female') {
    return isNeutered ? 'Spayed' : 'Not spayed';
  }
  return isNeutered ? 'Neutered' : 'Not neutered';
};

const CompanionRow = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="py-2.5! flex items-center gap-2 justify-between border-t border-card-border">
    <div className="text-body-4-emphasis text-text-tertiary">{label}</div>
    <div className="text-body-4 text-text-primary text-right">{value || '-'}</div>
  </div>
);

const CompanionReadOnlySection = ({
  companion,
  isInsured,
  speciesLabel,
}: {
  companion: CompanionParent;
  isInsured: boolean;
  speciesLabel: string;
}) => (
  <div className="pt-2">
    <CompanionRow label="Species" value={speciesLabel} />
    <CompanionRow label="Breed" value={companion.companion.breed} />
    <CompanionRow label="Date of birth" value={formatDateLabel(companion.companion.dateOfBirth)} />
    <CompanionRow label="Gender" value={companion.companion.gender || '-'} />
    <CompanionRow
      label="Neutered status"
      value={getNeuteredStatusLabel(companion.companion.gender, companion.companion.isneutered)}
    />
    {companion.companion.isneutered ? (
      <CompanionRow
        label={`Age when ${companion.companion.gender === 'female' ? 'spayed' : 'neutered'}`}
        value={String(companion.companion.ageWhenNeutered || '-')}
      />
    ) : null}
    <CompanionRow label="Current weight (lbs)" value={companion.companion.currentWeight || '-'} />
    <CompanionRow label="Color" value={companion.companion.colour || '-'} />
    <CompanionRow label="Blood group" value={companion.companion.bloodGroup || '-'} />
    <CompanionRow label="Country of origin" value={companion.companion.countryOfOrigin || '-'} />
    <CompanionRow label="Companion came from" value={companion.companion.source || '-'} />
    <CompanionRow label="Microchip number" value={companion.companion.microchipNumber || '-'} />
    <CompanionRow label="Passport number" value={companion.companion.passportNumber || '-'} />
    <CompanionRow label="Insurance status" value={isInsured ? 'Insured' : 'Not insured'} />
    {isInsured ? (
      <>
        <CompanionRow
          label="Insurance company"
          value={companion.companion.insurance?.companyName || '-'}
        />
        <CompanionRow
          label="Insurance policy number"
          value={companion.companion.insurance?.policyNumber || '-'}
        />
      </>
    ) : null}
  </div>
);

type CompanionEditSectionProps = {
  formData: StoredCompanion;
  setFormData: React.Dispatch<React.SetStateAction<StoredCompanion>>;
  currentDate: Date | null;
  setCurrentDate: React.Dispatch<React.SetStateAction<Date | null>>;
  formErrors: CompanionFormErrors;
  speciesOptions: SpeciesOption[];
  breedOptions: BreedOption[];
  isInsured: boolean;
  handleCancel: () => void;
  handleSave: () => void;
};

const CompanionEditSection = ({
  formData,
  setFormData,
  currentDate,
  setCurrentDate,
  formErrors,
  speciesOptions,
  breedOptions,
  isInsured,
  handleCancel,
  handleSave,
}: CompanionEditSectionProps) => (
  <div className="flex flex-col gap-3 pt-2">
    <div className="grid grid-cols-2 gap-3">
      <LabelDropdown
        placeholder="Species"
        onSelect={(option) => {
          const selected = speciesOptions.find((item) => item.value === option.value);
          setFormData((prev) => ({
            ...prev,
            type: (selected?.type ?? option.value) as CompanionType,
            speciesCode: selected?.speciesCode ?? '',
            breed: '',
            breedCode: '',
            bloodGroup: '',
          }));
        }}
        defaultOption={formData.type}
        options={speciesOptions}
        error={formErrors.type}
      />
      <LabelDropdown
        placeholder="Breed"
        onSelect={(option) => {
          const selected = breedOptions.find((item) => item.value === option.value);
          setFormData((prev) => ({
            ...prev,
            breed: option.value,
            breedCode: selected?.breedCode ?? '',
            speciesCode:
              selected?.speciesCode ??
              speciesOptions.find((item) => item.type === prev.type)?.speciesCode ??
              prev.speciesCode,
          }));
        }}
        defaultOption={formData.breed}
        options={breedOptions}
        error={formErrors.breed}
      />
    </div>

    <Datepicker
      currentDate={currentDate}
      setCurrentDate={setCurrentDate}
      type="input"
      className="min-h-12!"
      containerClassName="w-full"
      placeholder="Date of birth"
      error={formErrors.dateOfBirth}
    />

    <SelectLabel
      title="Gender"
      options={GenderOptions}
      activeOption={formData.gender}
      setOption={(value) => setFormData((prev) => ({ ...prev, gender: value }))}
    />

    <SelectLabel
      title="Neutered status"
      options={getNeuteredOptions(formData.gender)}
      activeOption={formData.isneutered ? 'true' : 'false'}
      setOption={(value: string) =>
        setFormData((prev) => ({
          ...prev,
          isneutered: value === 'true',
          ageWhenNeutered: value === 'true' ? prev.ageWhenNeutered : '',
        }))
      }
    />

    {formData.isneutered ? (
      <FormInput
        intype="number"
        inname="ageWhenNeutered"
        value={formData.ageWhenNeutered || ''}
        inlabel={`Age when ${formData.gender === 'female' ? 'spayed' : 'neutered'} (optional)`}
        onChange={(e) =>
          setFormData((prev) => ({
            ...prev,
            ageWhenNeutered: e.target.value.replaceAll('-', ''),
          }))
        }
        className="min-h-12!"
      />
    ) : null}

    <div className="grid grid-cols-2 gap-3">
      <FormInput
        intype="text"
        inname="color"
        value={formData.colour || ''}
        inlabel="Color (optional)"
        onChange={(e) => setFormData((prev) => ({ ...prev, colour: e.target.value }))}
        className="min-h-12!"
      />
      <LabelDropdown
        placeholder="Blood group (optional)"
        onSelect={(option) => setFormData((prev) => ({ ...prev, bloodGroup: option.value }))}
        defaultOption={formData.bloodGroup || ''}
        options={BLOOD_GROUP_OPTIONS_BY_SPECIES[formData.type] ?? []}
      />
    </div>

    <FormInput
      intype="number"
      inname="weight"
      value={formData.currentWeight + ''}
      inlabel="Current weight (optional) (lbs)"
      onChange={(e) =>
        setFormData((prev) => ({
          ...prev,
          currentWeight: toNonNegativeNumber(e.target.value),
        }))
      }
      className="min-h-12!"
    />

    <LabelDropdown
      placeholder="Country of origin (optional)"
      onSelect={(option) => setFormData((prev) => ({ ...prev, countryOfOrigin: option.value }))}
      defaultOption={formData.countryOfOrigin}
      options={CountriesOptions}
    />

    <SelectLabel
      title="My companion comes from:"
      options={OriginOptions}
      activeOption={formData.source || 'unknown'}
      setOption={(value) => setFormData((prev) => ({ ...prev, source: value }))}
      type="coloumn"
    />

    <FormInput
      intype="text"
      inname="microchip"
      value={formData.microchipNumber || ''}
      inlabel="Microchip number (optional)"
      onChange={(e) => setFormData((prev) => ({ ...prev, microchipNumber: e.target.value }))}
      className="min-h-12!"
    />

    <FormInput
      intype="text"
      inname="passport"
      value={formData.passportNumber || ''}
      inlabel="Passport number (optional)"
      onChange={(e) =>
        setFormData((prev) => ({
          ...prev,
          passportNumber: e.target.value.replaceAll(/[^0-9a-zA-Z-]/g, ''),
        }))
      }
      className="min-h-12!"
    />

    <SelectLabel
      title="Insurance"
      options={InsuredOptions}
      activeOption={isInsured ? 'true' : 'false'}
      setOption={(value: string) =>
        setFormData((prev) => ({
          ...prev,
          isInsured: value === 'true',
          insurance:
            value === 'true'
              ? {
                  ...prev.insurance,
                  isInsured: true,
                }
              : undefined,
        }))
      }
    />

    {isInsured ? (
      <>
        <FormInput
          intype="text"
          inname="insuranceCompany"
          value={formData.insurance?.companyName || ''}
          inlabel="Company name"
          onChange={(e) =>
            setFormData((prev) => ({
              ...prev,
              insurance: {
                ...prev.insurance,
                isInsured: true,
                companyName: e.target.value,
              },
            }))
          }
          error={formErrors.insuranceCompany}
          className="min-h-12!"
        />
        <FormInput
          intype="text"
          inname="insurancePolicy"
          value={formData.insurance?.policyNumber || ''}
          inlabel="Policy Number"
          onChange={(e) =>
            setFormData((prev) => ({
              ...prev,
              insurance: {
                ...prev.insurance,
                isInsured: true,
                policyNumber: e.target.value,
              },
            }))
          }
          error={formErrors.insuranceNumber}
          className="min-h-12!"
        />
      </>
    ) : null}

    <div className="flex justify-end items-center gap-3 w-full flex-row pt-2">
      <Secondary href="#" text="Cancel" onClick={handleCancel} />
      <Primary href="#" text="Save" onClick={handleSave} />
    </div>
  </div>
);

type CompanionTypeProps = {
  companion: CompanionParent;
  canEditCompanionStatus?: boolean;
};

const Companion = ({ companion, canEditCompanionStatus = false }: CompanionTypeProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isStatusEditing, setIsStatusEditing] = useState(false);
  const [statusValue, setStatusValue] = useState<RecordStatus>(
    (companion.companion.status as RecordStatus | undefined) ?? 'active'
  );
  const [formData, setFormData] = useState<StoredCompanion>(companion.companion);
  const [currentDate, setCurrentDate] = useState<Date | null>(
    companion.companion.dateOfBirth ? new Date(companion.companion.dateOfBirth) : null
  );
  const [formErrors, setFormErrors] = useState<CompanionFormErrors>({});
  const [speciesOptions, setSpeciesOptions] = useState<SpeciesOption[]>(DEFAULT_SPECIES_OPTIONS);
  const [breedOptions, setBreedOptions] = useState<BreedOption[]>([]);

  const isInsured = useMemo(
    () =>
      Boolean(formData.isInsured) ||
      Boolean(formData.insurance?.companyName) ||
      Boolean(formData.insurance?.policyNumber),
    [formData.isInsured, formData.insurance?.companyName, formData.insurance?.policyNumber]
  );

  useEffect(() => {
    setIsEditing(false);
    setIsStatusEditing(false);
    setStatusValue((companion.companion.status as RecordStatus | undefined) ?? 'active');
    setFormData(companion.companion);
    setCurrentDate(
      companion.companion.dateOfBirth ? new Date(companion.companion.dateOfBirth) : null
    );
    setFormErrors({});
  }, [companion]);

  useEffect(() => {
    if (!isEditing) return;
    let mounted = true;
    fetchSpeciesCodeEntries()
      .then((entries) => {
        if (!mounted) return;
        const entryByQuery = new Map(entries.map((item) => [item.display.toLowerCase(), item]));
        const mapped = DEFAULT_SPECIES_OPTIONS.map((option) => ({
          ...option,
          speciesCode: entryByQuery.get(option.speciesQuery)?.code ?? '',
        }));
        setSpeciesOptions(mapped);
      })
      .catch(() => {
        if (mounted) setSpeciesOptions(DEFAULT_SPECIES_OPTIONS);
      });
    return () => {
      mounted = false;
    };
  }, [isEditing]);

  useEffect(() => {
    if (!isEditing) return;
    const speciesQuery = SPECIES_QUERY_BY_TYPE[formData.type];
    if (!speciesQuery) {
      setBreedOptions([]);
      return;
    }
    let mounted = true;
    fetchBreedCodeEntries(speciesQuery)
      .then((entries) => {
        if (!mounted) return;
        const nextOptions: BreedOption[] = entries.map((entry) => ({
          value: entry.display,
          label: entry.display,
          breedCode: entry.code,
          speciesCode: entry.meta?.speciesCode ?? '',
        }));
        setBreedOptions(nextOptions);
      })
      .catch(() => {
        if (mounted) setBreedOptions([]);
      });
    return () => {
      mounted = false;
    };
  }, [isEditing, formData.type]);

  const speciesLabel = useMemo(() => {
    const selected = speciesOptions.find((item) => item.type === companion.companion.type);
    return selected?.label ?? companion.companion.type ?? '-';
  }, [companion.companion.type, speciesOptions]);

  const handleCancel = () => {
    setIsEditing(false);
    setFormData(companion.companion);
    setCurrentDate(
      companion.companion.dateOfBirth ? new Date(companion.companion.dateOfBirth) : null
    );
    setFormErrors({});
  };

  const handleSave = async () => {
    const validationErrors = validateCompanionForm(formData, currentDate, isInsured);
    setFormErrors(validationErrors);
    if (hasErrors(validationErrors)) return;

    const codeResolution = await resolveCompanionCodes(
      formData,
      companion,
      speciesOptions,
      breedOptions
    );
    const codeErrors = getCodeResolutionErrors(codeResolution);
    if (hasErrors(codeErrors)) {
      setFormErrors((prev) => ({ ...prev, ...codeErrors }));
      return;
    }

    const payload = buildCompanionPayload(
      companion,
      formData,
      currentDate,
      isInsured,
      codeResolution
    );

    try {
      await updateCompanion(payload);
      setIsEditing(false);
      setFormErrors({});
    } catch (error) {
      console.log(error);
    }
  };

  const handleStatusCancel = () => {
    setIsStatusEditing(false);
    setStatusValue((companion.companion.status as RecordStatus | undefined) ?? 'active');
  };

  const handleStatusSave = async () => {
    try {
      await updateCompanion({
        ...companion.companion,
        status: statusValue,
      });
      setFormData((prev) => ({ ...prev, status: statusValue }));
      setIsStatusEditing(false);
    } catch (error) {
      console.log(error);
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full">
      <Accordion
        title="Companion information"
        defaultOpen={true}
        showEditIcon={true}
        isEditing={isEditing}
        onEditClick={() => setIsEditing(true)}
      >
        {isEditing ? (
          <CompanionEditSection
            formData={formData}
            setFormData={setFormData}
            currentDate={currentDate}
            setCurrentDate={setCurrentDate}
            formErrors={formErrors}
            speciesOptions={speciesOptions}
            breedOptions={breedOptions}
            isInsured={isInsured}
            handleCancel={handleCancel}
            handleSave={handleSave}
          />
        ) : (
          <CompanionReadOnlySection
            companion={companion}
            isInsured={isInsured}
            speciesLabel={speciesLabel}
          />
        )}
      </Accordion>
      <Accordion
        title="Status"
        defaultOpen={true}
        showEditIcon={canEditCompanionStatus}
        isEditing={isStatusEditing}
        onEditClick={() => setIsStatusEditing(true)}
      >
        {isStatusEditing ? (
          <div className="flex flex-col gap-3 pt-2">
            <LabelDropdown
              placeholder="Companion status"
              onSelect={(option) => setStatusValue(option.value as RecordStatus)}
              defaultOption={statusValue}
              options={COMPANION_STATUS_OPTIONS}
            />
            <div className="flex justify-end items-center gap-3 w-full flex-row">
              <Secondary href="#" text="Cancel" onClick={handleStatusCancel} />
              <Primary href="#" text="Save" onClick={handleStatusSave} />
            </div>
          </div>
        ) : (
          <div className="pt-2">
            <CompanionRow label="Current status" value={formatStatusLabel(statusValue)} />
          </div>
        )}
      </Accordion>
    </div>
  );
};

export default Companion;
