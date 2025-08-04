

import { Types, Document } from 'mongoose'

import type { pets} from "@yosemite-crew/types";

const capitalizeFirstLetter = (string: string ) => {
   return string.charAt(0).toUpperCase() + string.slice(1).toLowerCase();
}

export const convertPetToFHIR = (pet: pets, baseUrl: string) => {

  return {
    resourceType: "Patient",
    id: pet._id,
    active: true,
    name: [{ use: "official", text: pet.petName }],
    gender: pet.petGender?.toLowerCase() ?? "unknown",
    birthDate: pet.petdateofBirth ? new Date(pet.petdateofBirth).toISOString().split("T")[0] : undefined,
    animal: {
      species: {
        coding: [{
          system: "http://hl7.org/fhir/animal-species",
          code: pet.petType?.toLowerCase() ?? "",
          display: capitalizeFirstLetter(pet.petType || "")
        }]
      },
      breed: {
        coding: [{
          system: "http://hl7.org/fhir/ValueSet/animal-breeds",
          code: pet.petBreed?.toLowerCase() ?? "",
          display: pet.petBreed || ""
        }]
      },
      genderStatus: {
        coding: [{
          system: "http://hl7.org/fhir/ValueSet/gender-status",
          code: pet.isNeutered?.toString().toLowerCase() === "yes" ? "neutered" : "intact",
          display: pet.isNeutered === "Yes" ? "Neutered" : "Intact"
        }]
      }
    },
    extension: [
      { url: `${baseUrl}/fhir/extensions/pet-age`, valueInteger: pet.petAge },
      { url: `${baseUrl}/fhir/extensions/pet-current-weight`, valueString: pet.petCurrentWeight },
      { url: `${baseUrl}/fhir/extensions/pet-color`, valueString: pet.petColor },
      { url: `${baseUrl}/fhir/extensions/pet-blood-group`, valueString: pet.petBloodGroup },
      { url: `${baseUrl}/fhir/extensions/is-neutered`, valueBoolean: pet.isNeutered?.toString().toLowerCase() === "yes" },
      { url: `${baseUrl}/fhir/extensions/age-when-neutered`, valueString: pet.ageWhenNeutered },
      { url: `${baseUrl}/fhir/extensions/microchip-number`, valueString: pet.microChipNumber },
      { url: `${baseUrl}/fhir/extensions/is-insured`, valueBoolean: pet.isInsured?.toString().toLowerCase() === "yes" },
      { url: `${baseUrl}/fhir/extensions/insurance-company`, valueString: pet.insuranceCompany },
      { url: `${baseUrl}/fhir/extensions/policy-number`, valueString: pet.policyNumber },
      { url: `${baseUrl}/fhir/extensions/passport-number`, valueString: pet.passportNumber },
      { url: `${baseUrl}/fhir/extensions/pet-from`, valueString: pet.petFrom },
      {
        url: `${baseUrl}/fhir/StructureDefinition/pet-images`,
        valueString: Array.isArray(pet.petImage) && pet.petImage.length > 0 ? pet.petImage[0] : ''
      }
    ],
    meta: {
      lastUpdated: pet.updatedAt
    }
  };
}


export const  convertFHIRToPet = (fhirPatient: any) => {
  const pet: any = {};

  // Basic Fields
  pet.petName = fhirPatient.name?.[0]?.text || '';
  pet.petdateofBirth = fhirPatient.birthDate || '';
  pet.petGender = fhirPatient.gender
    ? fhirPatient.gender.charAt(0).toUpperCase() + fhirPatient.gender.slice(1)
    : '';

  // Animal Info
  pet.petType = fhirPatient.animal?.species?.coding?.[0]?.display || '';
  pet.petBreed = fhirPatient.animal?.breed?.text || '';
  pet.isNeutered = fhirPatient.animal?.genderStatus?.coding?.[0]?.code === 'neutered' ? 'Yes' : 'No';

  // FHIR Extensions
  if (Array.isArray(fhirPatient.extension)) {
    for (const ext of fhirPatient.extension) {
      const url = ext.url;

      if (url.endsWith('/pet-current-weight')) pet.petCurrentWeight = ext.valueString;
      else if (url.endsWith('/pet-color')) pet.petColor = ext.valueString;
      else if (url.endsWith('/pet-blood-group')) pet.petBloodGroup = ext.valueString;
      else if (url.endsWith('/age-when-neutered')) pet.ageWhenNeutered = ext.valueString;
      else if (url.endsWith('/microchip-number')) pet.microChipNumber = ext.valueString;
      else if (url.endsWith('/passport-number')) pet.passportNumber = ext.valueString;
      else if (url.endsWith('/pet-from')) pet.petFrom = ext.valueString;
      else if (url.endsWith('/pet-images')) {
        pet.petImage = ext.valueString ? [ext.valueString] : [];
      }
      else if (url.endsWith('/insurance')) {
        for (const insExt of ext.extension || []) {
          if (insExt.url === 'company') pet.insuranceCompany = insExt.valueString;
          if (insExt.url === 'policyNumber') pet.policyNumber = insExt.valueString;
        }
        pet.isInsured = (pet.insuranceCompany && pet.policyNumber) ? 'Yes' : 'No';
      }
    }
  }

  return pet;
}