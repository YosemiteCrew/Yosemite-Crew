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
     
        { url: `${baseUrl}/fhir/extensions/pet-age`, valueInteger: pet.petAge, title: 'petAge' },
        { url: `${baseUrl}/fhir/extensions/pet-current-weight`, valueString: pet.petCurrentWeight, title: 'petCurrentWeight' },
        { url: `${baseUrl}/fhir/extensions/pet-color`, valueString: pet.petColor, title: 'petColor' },
        { url: `${baseUrl}/fhir/extensions/pet-blood-group`, valueString: pet.petBloodGroup, title: 'petBloodGroup' },
        { url: `${baseUrl}/fhir/extensions/is-neutered`, valueBoolean: pet.isNeutered, title: 'isNeutered' },
        { url: `${baseUrl}/fhir/extensions/age-when-neutered`, valueString: pet.ageWhenNeutered, title: 'ageWhenNeutered' },
        { url: `${baseUrl}/fhir/extensions/microchip-number`, valueString: pet.microChipNumber, title: 'microChipNumber' },
        { url: `${baseUrl}/fhir/extensions/is-insured`, valueBoolean: pet.isInsured, title: 'isInsured' },
        { url: `${baseUrl}/fhir/extensions/insurance-company`, valueString: pet.insuranceCompany, title: 'insuranceCompany' },
        { url: `${baseUrl}/fhir/extensions/policy-number`, valueString: pet.policyNumber, title: 'policyNumber' },
        { url: `${baseUrl}/fhir/extensions/passport-number`, valueString: pet.passportNumber, title: 'passportNumber' },
        { url: `${baseUrl}/fhir/extensions/pet-from`, valueString: pet.petFrom, title: 'petFrom' },
        {
          url: `${baseUrl}/fhir/StructureDefinition/pet-images`,
          valueString: Array.isArray(pet.petImage) ? pet.petImage.join(', ') : pet.petImage,
          title: 'petImage'
        }
      ],
      meta: {
        lastUpdated: pet.updatedAt
      }
    };
  }
  
}

module.exports = FHIRMapper;