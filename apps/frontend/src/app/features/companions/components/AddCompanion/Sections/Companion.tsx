import React, { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { Primary, Secondary } from '@/app/ui/primitives/Buttons';
import FormInput from '@/app/ui/inputs/FormInput/FormInput';
import SelectLabel from '@/app/ui/inputs/SelectLabel';
import {
  CountriesOptions,
  EMPTY_STORED_COMPANION,
  EMPTY_STORED_PARENT,
  CompanionFormData,
  fromStoredCompanionAlerts,
  toStoredCompanionAlerts,
  GenderOptions,
  InsuredOptions,
  getNeuteredOptions,
  OriginOptions,
} from '@/app/features/companions/components/AddCompanion/type';
import Accordion from '@/app/ui/primitives/Accordion/Accordion';
import FormDesc from '@/app/ui/inputs/FormDesc/FormDesc';
import { StoredCompanion, StoredParent } from '@/app/features/companions/pages/Companions/types';
import Datepicker from '@/app/ui/inputs/Datepicker';
import {
  createCompanion,
  createParent,
  getCompanionForParent,
  linkCompanion,
} from '@/app/features/companions/services/companionService';
import SearchDropdown from '@/app/ui/inputs/SearchDropdown';
import LabelDropdown from '@/app/ui/inputs/Dropdown/LabelDropdown';
import { CompanionType } from '@yosemite-crew/types';
import { BLOOD_GROUP_OPTIONS_BY_SPECIES } from '@/app/features/companions/components/companionBloodGroups';
import { useNotify } from '@/app/hooks/useNotify';
import { useCompanionTerminologyText } from '@/app/hooks/useCompanionTerminologyText';
import {
  fetchBreedCodeEntries,
  fetchSpeciesCodeEntries,
} from '@/app/features/companions/services/codeEntriesService';

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

const DEFAULT_SPECIES_OPTIONS: SpeciesOption[] = [
  { label: 'Canine', value: 'dog', type: 'dog', speciesCode: '', speciesQuery: 'canine' },
  { label: 'Feline', value: 'cat', type: 'cat', speciesCode: '', speciesQuery: 'feline' },
  { label: 'Equine', value: 'horse', type: 'horse', speciesCode: '', speciesQuery: 'equine' },
];

const toNonNegativeNumber = (value: string | number | undefined) => {
  const parsed = typeof value === 'number' ? value : Number.parseFloat((value ?? '').toString());
  if (Number.isNaN(parsed)) {
    return undefined;
  }
  return Math.max(0, parsed);
};

/** Every fallback and label the form renders, resolved once so the JSX stays branch-free. */
const getCompanionFieldValues = (formData: CompanionFormData) => ({
  ageWhenNeutered: formData.ageWhenNeutered || '',
  neuteredAgeLabel: `Age when ${formData.gender === 'female' ? 'spayed' : 'neutered'} (optional)`,
  neuteredValue: formData.isneutered ? 'true' : 'false',
  colour: formData.colour || '',
  bloodGroup: formData.bloodGroup || '',
  bloodGroupOptions: BLOOD_GROUP_OPTIONS_BY_SPECIES[formData.type] ?? [],
  source: formData.source || 'unknown',
  microchipNumber: formData.microchipNumber || '',
  passportNumber: formData.passportNumber || '',
  insuredValue: formData.isInsured ? 'true' : 'false',
  insuranceCompanyName: formData.insurance?.companyName || '',
  insurancePolicyNumber: formData.insurance?.policyNumber || '',
  allergy: formData.allergy || '',
});

type CompanionProps = {
  setActiveLabel: React.Dispatch<React.SetStateAction<string>>;
  formData: CompanionFormData;
  setFormData: React.Dispatch<React.SetStateAction<CompanionFormData>>;
  parentFormData: StoredParent;
  setParentFormData: React.Dispatch<React.SetStateAction<StoredParent>>;
  setShowModal: React.Dispatch<React.SetStateAction<boolean>>;
  mode?: 'default' | 'fasttrack';
  onCompanionCreated?: (companion: StoredCompanion) => void;
};

const useCompanionContent = ({
  setActiveLabel,
  formData,
  setFormData,
  parentFormData,
  setParentFormData,
  setShowModal,
  mode = 'default',
  onCompanionCreated,
}: CompanionProps) => {
  const isFastTrack = mode === 'fasttrack';
  const terminologyText = useCompanionTerminologyText();
  const [formDataErrors, setFormDataErrors] = useState<{
    name?: string;
    species?: string;
    breed?: string;
    dateOfBirth?: string;
    insuranceNumber?: string;
    insuranceCompany?: string;
  }>({});
  const currentDate = formData.dateOfBirth ? new Date(formData.dateOfBirth) : null;
  const setCurrentDate: React.Dispatch<React.SetStateAction<Date | null>> = (value) => {
    setFormData((prev) => {
      const prevDate = prev.dateOfBirth ? new Date(prev.dateOfBirth) : null;
      const next = typeof value === 'function' ? value(prevDate) : value;
      return { ...prev, dateOfBirth: next ?? new Date() };
    });
  };
  const [query, setQuery] = useState('');
  const { notify } = useNotify();
  const [results, setResults] = useState<StoredCompanion[]>([]);
  const [speciesOptions, setSpeciesOptions] = useState<SpeciesOption[]>(DEFAULT_SPECIES_OPTIONS);
  const [breedOptions, setBreedOptions] = useState<BreedOption[]>([]);

  const options: OptionProp[] = useMemo(
    () =>
      results.map((p) => {
        return {
          value: p.id,
          label: `${p.name}`,
        };
      }),
    [results]
  );

  const [prevParentId, setPrevParentId] = useState(parentFormData.id);
  if (prevParentId !== parentFormData.id) {
    setPrevParentId(parentFormData.id);
    if (!parentFormData.id) {
      setResults([]);
      setQuery('');
    }
  }

  useLayoutEffect(() => {
    const parentId = parentFormData.id;
    if (!parentId) {
      return;
    }
    let mounted = true;
    getCompanionForParent(parentId)
      .then((companions) => {
        if (mounted) setResults(companions);
      })
      .catch(() => {
        if (mounted) setResults([]);
      });
    return () => {
      mounted = false;
    };
  }, [parentFormData.id]);

  useEffect(() => {
    let mounted = true;
    fetchSpeciesCodeEntries()
      .then((entries) => {
        if (!mounted) {
          return;
        }
        const entryByQuery = new Map(entries.map((item) => [item.display.toLowerCase(), item]));
        const mapped = DEFAULT_SPECIES_OPTIONS.map((option) => ({
          ...option,
          speciesCode: entryByQuery.get(option.speciesQuery)?.code ?? '',
        }));
        setSpeciesOptions(mapped);
      })
      .catch(() => {
        if (mounted) {
          setSpeciesOptions(DEFAULT_SPECIES_OPTIONS);
        }
      });
    return () => {
      mounted = false;
    };
  }, []);

  const [prevBreedSync, setPrevBreedSync] = useState({ type: formData.type, speciesOptions });
  if (prevBreedSync.type !== formData.type || prevBreedSync.speciesOptions !== speciesOptions) {
    setPrevBreedSync({ type: formData.type, speciesOptions });
    if (!speciesOptions.some((option) => option.type === formData.type)) {
      setBreedOptions([]);
    }
  }

  useLayoutEffect(() => {
    const selected = speciesOptions.find((option) => option.type === formData.type);
    if (!selected) {
      return;
    }
    let mounted = true;
    fetchBreedCodeEntries(selected.speciesQuery)
      .then((entries) => {
        if (!mounted) {
          return;
        }
        const seen = new Set<string>();
        const nextOptions: BreedOption[] = entries.reduce<BreedOption[]>((acc, entry) => {
          if (!seen.has(entry.display)) {
            seen.add(entry.display);
            acc.push({
              value: entry.display,
              label: entry.display,
              breedCode: entry.code,
              speciesCode: entry.meta?.speciesCode ?? selected.speciesCode,
            });
          }
          return acc;
        }, []);
        setBreedOptions(nextOptions);
      })
      .catch(() => {
        if (mounted) {
          setBreedOptions([]);
        }
      });
    return () => {
      mounted = false;
    };
  }, [formData.type, speciesOptions]);

  const handleSubmit = async () => {
    const errors: {
      name?: string;
      species?: string;
      breed?: string;
      insuranceNumber?: string;
      insuranceCompany?: string;
      dateOfBirth?: string;
    } = {};
    if (!formData.name) errors.name = 'Name is required';
    if (!formData.type) errors.species = 'Species is required';
    if (!formData.breed) errors.breed = 'Breed is required';

    if (!isFastTrack && formData.isInsured) {
      if (!formData.insurance?.companyName) errors.insuranceCompany = 'Company name is required';
      if (!formData.insurance?.policyNumber) errors.insuranceNumber = 'Policy number is required';
    }
    setFormDataErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }
    try {
      const createdCompanion = await handleCreateCompanion();
      notify('success', {
        title: 'Companion created',
        text: 'Companion has been created successfully.',
      });
      if (createdCompanion) {
        onCompanionCreated?.(createdCompanion);
      }
      setShowModal(false);
      setFormDataErrors({});
      setFormData(EMPTY_STORED_COMPANION);
      setParentFormData(EMPTY_STORED_PARENT);
      setActiveLabel('parents');
    } catch (error) {
      console.log(error);
      notify('error', {
        title: 'Unable to create companion',
        text: 'Failed to create companion. Please try again.',
      });
    }
  };

  const handleCreateCompanion = async () => {
    if (parentFormData.id) {
      if (formData.id) {
        const payload: StoredCompanion = {
          ...formData,
          alerts: toStoredCompanionAlerts(formData.alerts),
          parentId: parentFormData.id,
        };
        return await linkCompanion(payload, parentFormData);
      } else {
        const payload: StoredCompanion = {
          ...formData,
          alerts: toStoredCompanionAlerts(formData.alerts),
          parentId: parentFormData.id,
        };
        return await createCompanion(payload, parentFormData);
      }
    } else {
      const parent_id = await createParent(parentFormData);
      const payload: StoredCompanion = {
        ...formData,
        alerts: toStoredCompanionAlerts(formData.alerts),
        parentId: parent_id!,
      };
      const parentPayload: StoredParent = {
        ...parentFormData,
        id: parent_id!,
      };
      return await createCompanion(payload, parentPayload);
    }
  };

  const handleSelect = (parentId: string) => {
    const selected = results.find((p) => p.id === parentId);
    if (!selected) return;
    setFormData({
      ...selected,
      alerts: fromStoredCompanionAlerts(selected.alerts),
    });
    setQuery(`${selected.name}`);
  };

  const fieldValues = getCompanionFieldValues(formData);

  return (
    <div className="flex flex-col justify-between flex-1 gap-6 w-full">
      <div className="flex flex-col gap-6">
        <SearchDropdown
          placeholder={terminologyText('Search companion')}
          options={options}
          onSelect={handleSelect}
          query={query}
          setQuery={setQuery}
          minChars={0}
        />

        <Accordion
          title={terminologyText('Companion information')}
          defaultOpen
          showEditIcon={false}
          isEditing={true}
        >
          <div className="flex flex-col gap-3">
            <FormInput
              intype="text"
              inname="name"
              value={formData.name}
              inlabel="Name"
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              error={formDataErrors.name}
            />
            <div
              data-testid="companion-color-blood-group-row"
              className={`grid gap-3 ${isFastTrack ? 'grid-cols-1' : 'grid-cols-2'}`}
            >
              <LabelDropdown
                placeholder="Species"
                onSelect={(option) => {
                  const selected = speciesOptions.find((item) => item.value === option.value);
                  setFormData({
                    ...formData,
                    type: (selected?.type ?? option.value) as CompanionType,
                    speciesCode: selected?.speciesCode ?? '',
                    breed: '',
                    breedCode: '',
                    bloodGroup: '',
                  });
                }}
                defaultOption={formData.type}
                options={speciesOptions}
                error={formDataErrors.species}
              />
              <LabelDropdown
                placeholder="Breed"
                onSelect={(option) => {
                  const selected = breedOptions.find((item) => item.value === option.value);
                  setFormData({
                    ...formData,
                    breed: option.value,
                    breedCode: selected?.breedCode ?? '',
                    speciesCode:
                      selected?.speciesCode ??
                      speciesOptions.find((item) => item.type === formData.type)?.speciesCode ??
                      formData.speciesCode,
                  });
                }}
                defaultOption={formData.breed}
                options={breedOptions}
                error={formDataErrors.breed}
              />
            </div>
            <Datepicker
              currentDate={currentDate}
              setCurrentDate={setCurrentDate}
              type="input"
              containerClassName="w-full"
              placeholder="Date of birth"
              error={formDataErrors.dateOfBirth}
            />
            <SelectLabel
              title="Gender"
              options={GenderOptions}
              activeOption={formData.gender}
              setOption={(value) => setFormData({ ...formData, gender: value })}
            />
            <SelectLabel
              title="Neutered status"
              options={getNeuteredOptions(formData.gender)}
              activeOption={fieldValues.neuteredValue}
              setOption={(value: string) =>
                setFormData({
                  ...formData,
                  isneutered: value === 'true',
                  ageWhenNeutered: value === 'true' ? formData.ageWhenNeutered : '',
                })
              }
            />
            {formData.isneutered && (
              <FormInput
                intype="number"
                inname="ageWhenNeutered"
                value={fieldValues.ageWhenNeutered}
                inlabel={fieldValues.neuteredAgeLabel}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    ageWhenNeutered: e.target.value.replaceAll('-', ''),
                  })
                }
              />
            )}
            <div className={`grid gap-3 ${isFastTrack ? 'grid-cols-1' : 'grid-cols-2'}`}>
              <FormInput
                intype="text"
                inname="color"
                value={fieldValues.colour}
                inlabel="Color (optional)"
                onChange={(e) => setFormData({ ...formData, colour: e.target.value })}
              />
              {!isFastTrack && (
                <LabelDropdown
                  placeholder="Blood group (optional)"
                  onSelect={(option) => setFormData({ ...formData, bloodGroup: option.value })}
                  defaultOption={fieldValues.bloodGroup}
                  options={fieldValues.bloodGroupOptions}
                />
              )}
            </div>
            {!isFastTrack && (
              <>
                <FormInput
                  intype="number"
                  inname="weight"
                  value={formData.currentWeight + ''}
                  inlabel="Current weight (optional) (kg)"
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      currentWeight: toNonNegativeNumber(e.target.value),
                    })
                  }
                />
                <LabelDropdown
                  placeholder="Country of origin (optional)"
                  onSelect={(option) => setFormData({ ...formData, countryOfOrigin: option.value })}
                  defaultOption={formData.countryOfOrigin}
                  options={CountriesOptions}
                />
                <SelectLabel
                  title={terminologyText('My companion comes from:')}
                  options={OriginOptions}
                  activeOption={fieldValues.source}
                  setOption={(value) => setFormData({ ...formData, source: value })}
                  type="coloumn"
                />
                <FormInput
                  intype="text"
                  inname="microchip"
                  value={fieldValues.microchipNumber}
                  inlabel="Microchip number (optional)"
                  onChange={(e) => setFormData({ ...formData, microchipNumber: e.target.value })}
                />
                <FormInput
                  intype="text"
                  inname="passport"
                  value={fieldValues.passportNumber}
                  inlabel="Passport number (optional)"
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      passportNumber: e.target.value.replaceAll(/[^0-9a-zA-Z-]/g, ''),
                    })
                  }
                />
                <SelectLabel
                  title="Insurance"
                  options={InsuredOptions}
                  activeOption={fieldValues.insuredValue}
                  setOption={(value: string) =>
                    setFormData({
                      ...formData,
                      isInsured: value === 'true',
                      insurance:
                        value === 'true'
                          ? {
                              isInsured: true,
                            }
                          : undefined,
                    })
                  }
                />
                {formData.isInsured && (
                  <>
                    <FormInput
                      intype="text"
                      inname="weight"
                      value={fieldValues.insuranceCompanyName}
                      inlabel="Company name"
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          insurance: {
                            ...formData.insurance,
                            isInsured: formData.isInsured,
                            companyName: e.target.value,
                          },
                        })
                      }
                      error={formDataErrors.insuranceNumber}
                    />
                    <FormInput
                      intype="text"
                      inname="weight"
                      value={fieldValues.insurancePolicyNumber}
                      inlabel="Policy number"
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          insurance: {
                            ...formData.insurance,
                            isInsured: formData.isInsured,
                            policyNumber: e.target.value,
                          },
                        })
                      }
                      error={formDataErrors.insuranceNumber}
                    />
                  </>
                )}
              </>
            )}
            <FormDesc
              intype="text"
              inname="allergies"
              value={fieldValues.allergy}
              inlabel="Allergies (optional)"
              onChange={(e) => setFormData({ ...formData, allergy: e.target.value })}
              className="min-h-[120px]!"
            />
          </div>
        </Accordion>
      </div>
      <div className="flex justify-center items-center gap-3 w-full flex-row">
        <Secondary href="#" text="Back" onClick={() => setActiveLabel('parents')} />
        <Primary href="#" text="Save" onClick={handleSubmit} />
      </div>
    </div>
  );
};

const Companion = (props: CompanionProps) => useCompanionContent(props);

export default Companion;
