
const petBoardingModel = require('../models/petBoardindDetails');

class PetBoardingService {
  constructor() {
    this.petBoardingModel = petBoardingModel;
  }

  async createFromFhirOrganization(fhirData, userId) {
    try {
      const groomerData = {
        userId: userId,
        boardingName: fhirData.name,
        boardingAddress: fhirData.address?.[0]?.line?.[0] || '',
        city: fhirData.address?.[0]?.city || '',
        country: fhirData.address?.[0]?.country || '',
        zipCode: fhirData.address?.[0]?.postalCode || '',
        telephone: this.extractTelecomValue(fhirData.telecom, 'phone'),
        emailAddess: this.extractTelecomValue(fhirData.telecom, 'email'),
        website: this.extractTelecomValue(fhirData.telecom, 'url'),
      };

      const newPetBoarding = await this.petBoardingModel.create(groomerData);

      return newPetBoarding;
    } catch (err) {
      return {
        success: false,
        error: err.message
      };
    }
  }

  extractTelecomValue(telecomArray, systemType) {
    return telecomArray?.find(t => t.system === systemType)?.value || '';
  }

  toFhirOrganizationGroomer(petboarding) {
    return {
      resourceType: "Organization",
      id: petboarding._id.toString(),
      name: petboarding.boardingName,
      telecom: [
        petboarding.telephone ? { system: "phone", value: petboarding.telephone } : null,
        petboarding.emailAddess ? { system: "email", value: petboarding.emailAddess } : null,
        petboarding.website ? { system: "url", value: petboarding.website } : null
      ].filter(Boolean),
      address: [
        {
          line: [petboarding.boardingAddress],
          city: petboarding.city,
          postalCode: petboarding.zipCode,
          country: petboarding.country
        }
      ]
    };
  }
  
}

module.exports = PetBoardingService;
