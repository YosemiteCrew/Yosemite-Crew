import React, { useState } from "react";
import { Primary } from "../../Buttons";
import FormInput from "../../Inputs/FormInput/FormInput";
import Dropdown from "../../Inputs/Dropdown/Dropdown";
import SelectLabel from "../../Inputs/SelectLabel";
import {
  BreedMap,
  GenderOptions,
  NeuteuredOptions,
  OriginOptions,
  SpeciesOptions,
} from "../type";
import DateInput from "../../Inputs/Date/DateInput";
import Accordion from "../../Accordion/Accordion";

type CompanionForm = {
  name: string;
  species: string;
  breed: string;
  dob: Date | null;
  gender: string;
  neutuered: string;
  color: string;
  bloodgroup: string;
  weight: string;
  country: string;
  origin: string;
  microchip: string;
  passport: string;
  insurance: string;
  insuranceNumber: string;
};

const Companion = () => {
  const [formData, setFormData] = useState<CompanionForm>({
    name: "",
    species: "",
    breed: "",
    dob: new Date(),
    gender: "Male",
    neutuered: "Neutered",
    color: "",
    bloodgroup: "",
    weight: "",
    country: "",
    origin: "Shop",
    microchip: "",
    passport: "",
    insurance: "",
    insuranceNumber: "",
  });
  const [formDataErrors] = useState<{
    name?: string;
    species?: string;
    breed?: string;
    dob?: string;
    insuranceNumber?: string;
  }>({});

  return (
    <div className="flex flex-col justify-between flex-1 gap-6 w-full">
      <div className="flex flex-col gap-6">
        <div className="font-grotesk font-medium text-black-text text-[23px]">
          Companion information
        </div>
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
              <Dropdown
                placeholder="Species"
                value={formData.species}
                onChange={(e) => setFormData({ ...formData, species: e })}
                error={formDataErrors.species}
                className="min-h-12!"
                dropdownClassName="top-[55px]! !h-fit"
                options={SpeciesOptions}
              />
              <Dropdown
                placeholder="Breed"
                value={formData.breed}
                onChange={(e) => setFormData({ ...formData, breed: e })}
                error={formDataErrors.breed}
                className="min-h-12!"
                dropdownClassName="top-[55px]!"
                options={BreedMap[formData.species] ?? []}
                type="breed"
              />
            </div>
            <DateInput
              value={formData.dob}
              onChange={(e) => setFormData({ ...formData, dob: e })}
            />
            <SelectLabel
              title="Gender"
              options={GenderOptions.map((option) => ({
                name: option,
                key: option,
              }))}
              activeOption={formData.gender}
              setOption={(value: string) =>
                setFormData({ ...formData, gender: value })
              }
            />
            <SelectLabel
              title="Neutered status"
              options={NeuteuredOptions.map((option) => ({
                name: option,
                key: option,
              }))}
              activeOption={formData.neutuered}
              setOption={(value: string) =>
                setFormData({ ...formData, neutuered: value })
              }
            />
            <div className="grid grid-cols-2 gap-3">
              <FormInput
                intype="text"
                inname="color"
                value={formData.color}
                inlabel="Color (optional)"
                onChange={(e) =>
                  setFormData({ ...formData, color: e.target.value })
                }
                className="min-h-12!"
              />
              <FormInput
                intype="text"
                inname="blood"
                value={formData.bloodgroup}
                inlabel="Blood (optional)"
                onChange={(e) =>
                  setFormData({ ...formData, bloodgroup: e.target.value })
                }
                className="min-h-12!"
              />
            </div>
            <FormInput
              intype="text"
              inname="weight"
              value={formData.weight}
              inlabel="Current weight (optional) (kgs)"
              onChange={(e) =>
                setFormData({ ...formData, weight: e.target.value })
              }
              className="min-h-12!"
            />
            <Dropdown
              placeholder="Country of origin (optional)"
              value={formData.country}
              onChange={(e) => setFormData({ ...formData, country: e })}
              className="min-h-12!"
              dropdownClassName="top-[55px]! h-[150px]!"
              type="country"
            />
            <SelectLabel
              title="My pet comes from:"
              options={OriginOptions.map((option) => ({
                name: option,
                key: option,
              }))}
              activeOption={formData.origin}
              setOption={(value: string) =>
                setFormData({ ...formData, origin: value })
              }
              type="coloumn"
            />
            <FormInput
              intype="text"
              inname="microchip"
              value={formData.microchip}
              inlabel="Microchip number (optional)"
              onChange={(e) =>
                setFormData({ ...formData, microchip: e.target.value })
              }
              className="min-h-12!"
            />
            <FormInput
              intype="text"
              inname="passport"
              value={formData.weight}
              inlabel="Passport number (optional)"
              onChange={(e) =>
                setFormData({ ...formData, passport: e.target.value })
              }
              className="min-h-12!"
            />
            <FormInput
              intype="text"
              inname="weight"
              value={formData.insurance}
              inlabel="Insurance company (optional)"
              onChange={(e) =>
                setFormData({ ...formData, insurance: e.target.value })
              }
              className="min-h-12!"
            />
            {formData.insurance && (
              <FormInput
                intype="text"
                inname="weight"
                value={formData.insuranceNumber}
                inlabel="Policy Number"
                onChange={(e) =>
                  setFormData({ ...formData, insuranceNumber: e.target.value })
                }
                error={formDataErrors.insuranceNumber}
                className="min-h-12!"
              />
            )}
          </div>
        </Accordion>
      </div>
      <Primary
        href="#"
        text="Save"
        classname="max-h-12! text-lg! tracking-wide!"
      />
    </div>
  );
};

export default Companion;
