import React, { useEffect, useMemo, useState } from "react";
import { Primary, Secondary } from "../../Buttons";
import FormInput from "../../Inputs/FormInput/FormInput";
import SelectLabel from "../../Inputs/SelectLabel";
import {
  BreedMap,
  CountriesOptions,
  EMPTY_STORED_COMPANION,
  EMPTY_STORED_PARENT,
  GenderOptions,
  InsuredOptions,
  NeuteredOptions,
  OriginOptions,
  SpeciesOptions,
} from "../type";
import Accordion from "../../Accordion/Accordion";
import FormDesc from "../../Inputs/FormDesc/FormDesc";
import { StoredCompanion, StoredParent } from "@/app/pages/Companions/types";
import Datepicker from "../../Inputs/Datepicker";
import {
  createCompanion,
  createParent,
  getCompanionForParent,
  linkCompanion,
} from "@/app/services/companionService";
import SearchDropdown from "../../Inputs/SearchDropdown";
import LabelDropdown from "../../Inputs/Dropdown/LabelDropdown";
import { CompanionType } from "@yosemite-crew/types";

type OptionProp = {
  label: string;
  value: string;
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
    insuranceNumber?: string;
    insuranceCompany?: string;
  }>({});
  const [currentDate, setCurrentDate] = useState<Date | null>(
    formData.dateOfBirth ? new Date(formData.dateOfBirth) : null
  );
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<StoredCompanion[]>([]);

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
      setQuery("");
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
    setFormData({
      ...formData,
      dateOfBirth: currentDate ?? new Date(),
    });
  }, [currentDate]);

  const handleSubmit = async () => {
    const errors: {
      name?: string;
      species?: string;
      breed?: string;
      insuranceNumber?: string;
      insuranceCompany?: string;
      dateOfBirth?: string;
    } = {};
    if (!formData.name) errors.name = "Name is required";
    if (!formData.type) errors.species = "Species is required";
    if (!formData.breed) errors.breed = "Breed is required";
    if (!formData.dateOfBirth) errors.dateOfBirth = "Date of birth is required";
    if (formData.isInsured) {
      if (!formData.insurance?.companyName)
        errors.insuranceCompany = "Company name is required";
      if (!formData.insurance?.policyNumber)
        errors.insuranceNumber = "Policy number is required";
    }
    setFormDataErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }
    try {
      await handleCreateCompanion();
      setShowModal(false);
      setFormDataErrors({});
      setFormData(EMPTY_STORED_COMPANION);
      setParentFormData(EMPTY_STORED_PARENT);
      setActiveLabel("parents");
    } catch (error) {
      console.log(error);
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

        <Accordion
          title="Companion information"
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
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              error={formDataErrors.name}
              className="min-h-12!"
            />
            <div className="grid grid-cols-2 gap-3">
              <LabelDropdown
                placeholder="Species"
                onSelect={(option) =>
                  setFormData({
                    ...formData,
                    type: option.value as CompanionType,
                  })
                }
                defaultOption={formData.type}
                options={SpeciesOptions}
                error={formDataErrors.species}
              />
              <LabelDropdown
                placeholder="Breed"
                onSelect={(option) =>
                  setFormData({ ...formData, breed: option.value })
                }
                defaultOption={formData.breed}
                options={BreedMap[formData.type] ?? []}
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
              activeOption={formData.isneutered ? "true" : "false"}
              setOption={(value: string) =>
                setFormData({
                  ...formData,
                  isneutered: value === "true",
                })
              }
            />
            <div className="grid grid-cols-2 gap-3">
              <FormInput
                intype="text"
                inname="color"
                value={formData.colour || ""}
                inlabel="Color (optional)"
                onChange={(e) =>
                  setFormData({ ...formData, colour: e.target.value })
                }
                className="min-h-12!"
              />
              <FormInput
                intype="text"
                inname="blood"
                value={formData.bloodGroup || ""}
                inlabel="Blood (optional)"
                onChange={(e) =>
                  setFormData({ ...formData, bloodGroup: e.target.value })
                }
                className="min-h-12!"
              />
            </div>
            <FormInput
              intype="number"
              inname="weight"
              value={formData.currentWeight + ""}
              inlabel="Current weight (optional) (lbs)"
              onChange={(e) =>
                setFormData({
                  ...formData,
                  currentWeight: Number(e.target.value),
                })
              }
              className="min-h-12!"
            />
            <LabelDropdown
              placeholder="Country of origin (optional)"
              onSelect={(option) =>
                setFormData({ ...formData, countryOfOrigin: option.value })
              }
              defaultOption={formData.countryOfOrigin}
              options={CountriesOptions}
            />
            <SelectLabel
              title="My companion comes from:"
              options={OriginOptions}
              activeOption={formData.source || "unknown"}
              setOption={(value) => setFormData({ ...formData, source: value })}
              type="coloumn"
            />
            <FormInput
              intype="text"
              inname="microchip"
              value={formData.microchipNumber || ""}
              inlabel="Microchip number (optional)"
              onChange={(e) =>
                setFormData({ ...formData, microchipNumber: e.target.value })
              }
              className="min-h-12!"
            />
            <FormInput
              intype="number"
              inname="passport"
              value={formData.passportNumber || ""}
              inlabel="Passport number (optional)"
              onChange={(e) =>
                setFormData({
                  ...formData,
                  passportNumber: e.target.value,
                })
              }
              className="min-h-12!"
            />
            <SelectLabel
              title="Insurance"
              options={InsuredOptions}
              activeOption={formData.isInsured ? "true" : "false"}
              setOption={(value: string) =>
                setFormData({
                  ...formData,
                  isInsured: value === "true",
                  insurance:
                    value === "true"
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
                  value={formData.insurance?.companyName || ""}
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
                  value={formData.insurance?.policyNumber || ""}
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
              value={formData.allergy || ""}
              inlabel="Allergies (optional)"
              onChange={(e) =>
                setFormData({ ...formData, allergy: e.target.value })
              }
              className="min-h-[120px]!"
            />
          </div>
        </Accordion>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Secondary
          href="#"
          text="Back"
          onClick={() => setActiveLabel("parents")}
          className="max-h-12! text-lg! tracking-wide!"
        />
        <Primary
          href="#"
          text="Save"
          onClick={handleSubmit}
          classname="max-h-12! text-lg! tracking-wide!"
        />
      </div>
    </div>
  );
};

export default Companion;
