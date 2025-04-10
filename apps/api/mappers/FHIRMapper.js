const helpers = require('../utils/helpers');

class FHIRMapper {
  static async convertPetToFHIR(pet,baseUrl) {
    return {
      resourceType: "Patient",
      id: pet._id.toString(),
      active: true,
      name: [{ use: "official", text: pet.petName }],
      gender: pet.petGender.toLowerCase(),
      birthDate: new Date(pet.petdateofBirth).toISOString().split("T")[0],
      animal: {
        species: {
          coding: [{
            system: "http://hl7.org/fhir/animal-species",
            code: pet.petType.toLowerCase(),
            display: await helpers.capitalizeFirstLetter(pet.petType)
          }]
        },
        breed: {
          coding: [{
            system: "http://hl7.org/fhir/ValueSet/animal-breeds",
            code: pet.petBreed.toLowerCase(),
            display: pet.petBreed
          }]
        },
        genderStatus: {
          coding: [{
            system: "http://hl7.org/fhir/ValueSet/gender-status",
            code: pet.isNeutered.toLowerCase() === "yes" ? "neutered" : "intact",
            display: pet.isNeutered === "Yes" ? "Neutered" : "Intact"
          }]
        }
      },
      extension: [
     
        { url: `${baseUrl}/fhir/extensions/pet-age`, valueInteger: pet.petAge },
        { url: `${baseUrl}/fhir/extensions/pet-current-weight`, valueString: pet.petCurrentWeight },
        { url: `${baseUrl}/fhir/extensions/pet-color`, valueString: pet.petColor },
        { url: `${baseUrl}/fhir/extensions/pet-blood-group`, valueString: pet.petBloodGroup },
        { url: `${baseUrl}/fhir/extensions/is-neutered`, valueBoolean: pet.isNeutered },
        { url: `${baseUrl}/fhir/extensions/age-when-neutered`, valueString: pet.ageWhenNeutered },
        { url: `${baseUrl}/fhir/extensions/microchip-number`, valueString: pet.microChipNumber },
        { url: `${baseUrl}/fhir/extensions/is-insured`, valueBoolean: pet.isInsured },
        { url: `${baseUrl}/fhir/extensions/insurance-company`, valueString: pet.insuranceCompany },
        { url: `${baseUrl}/fhir/extensions/policy-number`, valueString: pet.policyNumber },
        { url: `${baseUrl}/fhir/extensions/passport-number`, valueString: pet.passportNumber },
        { url: `${baseUrl}/fhir/extensions/pet-from`, valueString: pet.petFrom },
        {
          url: `${baseUrl}/fhir/StructureDefinition/pet-images`,
          valueString: Array.isArray(pet.petImage) ? pet.petImage.join(', ') : pet.petImage
        }
      ],
      meta: {
        lastUpdated: pet.updatedAt
      }
    };
  }
  
}

module.exports = FHIRMapper;