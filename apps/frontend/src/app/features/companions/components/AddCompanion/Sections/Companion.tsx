import React, { useEffect, useMemo, useState } from 'react';
import { Primary, Secondary } from '@/app/ui/primitives/Buttons';
import FormInput from '@/app/ui/inputs/FormInput/FormInput';
import SelectLabel from '@/app/ui/inputs/SelectLabel';
import {
  CountriesOptions,
  EMPTY_STORED_COMPANION,
  EMPTY_STORED_PARENT,
  GenderOptions,
  InsuredOptions,
  NeuteredOptions,
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
import { useNotify } from '@/app/hooks/useNotify';
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
  { label: 'Dog', value: 'dog', type: 'dog', speciesCode: '', speciesQuery: 'canine' },
  { label: 'Cat', value: 'cat', type: 'cat', speciesCode: '', speciesQuery: 'feline' },
  { label: 'Horse', value: 'horse', type: 'horse', speciesCode: '', speciesQuery: 'equine' },
];

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

const toNonNegativeNumber = (value: string | number | undefined) => {
  const parsed = typeof value === 'number' ? value : Number.parseFloat((value ?? '').toString());
  if (Number.isNaN(parsed)) {
    return undefined;
  }
  return Math.max(0, parsed);
};

type CompanionProps = {
  setActiveLabel: React.Dispatch<React.SetStateAction<string>>;
  formData: StoredCompanion;
  setFormData: React.Dispatch<React.SetStateAction<StoredCompanion>>;
  parentFormData: StoredParent;
  setParentFormData: React.Dispatch<React.SetStateAction<StoredParent>>;
  setShowModal: React.Dispatch<React.SetStateAction<boolean>>;
};

const Companion = ({
  setActiveLabel,
  formData,
  setFormData,
  parentFormData,
  setParentFormData,
  setShowModal,
}: CompanionProps) => {
  const [formDataErrors, setFormDataErrors] = useState<{
    name?: string;
    species?: string;
    breed?: string;
    dateOfBirth?: string;
    ageWhenNeutered?: string;
    insuranceNumber?: string;
    insuranceCompany?: string;
  }>({});
  const [currentDate, setCurrentDate] = useState<Date | null>(
    formData.dateOfBirth ? new Date(formData.dateOfBirth) : null
  );
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

  useEffect(() => {
    const parentId = parentFormData.id;
    if (!parentId) {
      setResults([]);
      setQuery('');
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
    setFormData((prev) => ({
      ...prev,
      dateOfBirth: currentDate ?? new Date(),
    }));
  }, [currentDate, setFormData]);

  useEffect(() => {
    let mounted = true;
    fetchSpeciesCodeEntries()
      .then((entries) => {
        if (!mounted) {
          return;
        }
        const mapped = DEFAULT_SPECIES_OPTIONS.map((option) => {
          const entry = entries.find((item) => item.display.toLowerCase() === option.speciesQuery);
          return {
            ...option,
            speciesCode: entry?.code ?? '',
          };
        });
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

  useEffect(() => {
    const selected = speciesOptions.find((option) => option.type === formData.type);
    if (!selected) {
      setBreedOptions([]);
      return;
    }
    let mounted = true;
    fetchBreedCodeEntries(selected.speciesQuery)
      .then((entries) => {
        if (!mounted) {
          return;
        }
        const nextOptions: BreedOption[] = entries.map((entry) => ({
          value: entry.display,
          label: entry.display,
          breedCode: entry.code,
          speciesCode: entry.meta?.speciesCode ?? selected.speciesCode,
        }));
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
      ageWhenNeutered?: string;
    } = {};
    if (!formData.name) errors.name = 'Name is required';
    if (!formData.type) errors.species = 'Species is required';
    if (!formData.breed) errors.breed = 'Breed is required';
    if (!formData.dateOfBirth) errors.dateOfBirth = 'Date of birth is required';
    if (formData.isneutered && !formData.ageWhenNeutered) {
      errors.ageWhenNeutered = 'Age when neutered is required';
    }
    if (formData.isInsured) {
      if (!formData.insurance?.companyName) errors.insuranceCompany = 'Company name is required';
      if (!formData.insurance?.policyNumber) errors.insuranceNumber = 'Policy number is required';
    }
    setFormDataErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }
    try {
      await handleCreateCompanion();
      notify('success', {
        title: 'Companion created',
        text: 'Companion has been created successfully.',
      });
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
          parentId: parentFormData.id,
        };
        await linkCompanion(payload, parentFormData);
      } else {
        const payload: StoredCompanion = {
          ...formData,
          parentId: parentFormData.id,
        };
        await createCompanion(payload, parentFormData);
      }
    } else {
      const parent_id = await createParent(parentFormData);
      const payload: StoredCompanion = {
        ...formData,
        parentId: parent_id!,
      };
      const parentPayload: StoredParent = {
        ...parentFormData,
        id: parent_id!,
      };
      await createCompanion(payload, parentPayload);
    }
  };

  const handleSelect = (parentId: string) => {
    const selected = results.find((p) => p.id === parentId);
    if (!selected) return;
    setFormData(selected);
    setQuery(`${selected.name}`);
  };

  return (
    <div className="flex flex-col justify-between flex-1 gap-6 w-full">
      <div className="flex flex-col gap-6">
        <SearchDropdown
          placeholder="Search companion"
          options={options}
          onSelect={handleSelect}
          query={query}
          setQuery={setQuery}
          minChars={0}
        />

        <Accordion title="Companion information" defaultOpen showEditIcon={false} isEditing={true}>
          <div className="flex flex-col gap-3">
            <FormInput
              intype="text"
              inname="name"
              value={formData.name}
              inlabel="Name"
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              error={formDataErrors.name}
              className="min-h-12!"
            />
            <div className="grid grid-cols-2 gap-3">
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
              className="min-h-12!"
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
              options={NeuteredOptions}
              activeOption={formData.isneutered ? 'true' : 'false'}
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
                value={formData.ageWhenNeutered || ''}
                inlabel="Age when neutered"
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    ageWhenNeutered: e.target.value.replaceAll('-', ''),
                  })
                }
                error={formDataErrors.ageWhenNeutered}
                className="min-h-12!"
              />
            )}
            <div className="grid grid-cols-2 gap-3">
              <FormInput
                intype="text"
                inname="color"
                value={formData.colour || ''}
                inlabel="Color (optional)"
                onChange={(e) => setFormData({ ...formData, colour: e.target.value })}
                className="min-h-12!"
              />
              <LabelDropdown
                placeholder="Blood group (optional)"
                onSelect={(option) => setFormData({ ...formData, bloodGroup: option.value })}
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
                setFormData({
                  ...formData,
                  currentWeight: toNonNegativeNumber(e.target.value),
                })
              }
              className="min-h-12!"
            />
            <LabelDropdown
              placeholder="Country of origin (optional)"
              onSelect={(option) => setFormData({ ...formData, countryOfOrigin: option.value })}
              defaultOption={formData.countryOfOrigin}
              options={CountriesOptions}
            />
            <SelectLabel
              title="My companion comes from:"
              options={OriginOptions}
              activeOption={formData.source || 'unknown'}
              setOption={(value) => setFormData({ ...formData, source: value })}
              type="coloumn"
            />
            <FormInput
              intype="text"
              inname="microchip"
              value={formData.microchipNumber || ''}
              inlabel="Microchip number (optional)"
              onChange={(e) => setFormData({ ...formData, microchipNumber: e.target.value })}
              className="min-h-12!"
            />
            <FormInput
              intype="text"
              inname="passport"
              value={formData.passportNumber || ''}
              inlabel="Passport number (optional)"
              onChange={(e) =>
                setFormData({
                  ...formData,
                  passportNumber: e.target.value.replaceAll(/[^0-9a-zA-Z-]/g, ''),
                })
              }
              className="min-h-12!"
            />
            <SelectLabel
              title="Insurance"
              options={InsuredOptions}
              activeOption={formData.isInsured ? 'true' : 'false'}
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
                  value={formData.insurance?.companyName || ''}
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
                  className="min-h-12!"
                />
                <FormInput
                  intype="text"
                  inname="weight"
                  value={formData.insurance?.policyNumber || ''}
                  inlabel="Policy Number"
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
                  className="min-h-12!"
                />
              </>
            )}
            <FormDesc
              intype="text"
              inname="allergies"
              value={formData.allergy || ''}
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

export default Companion;
