
const groomerModel = require('../models/PetGroomer');

class GroomerService {
  constructor() {
    this.groomerModel = groomerModel;
  }

  async createFromFhirOrganization(fhirData, userId) {
    try {
      const groomerData = {
        userId: userId,
        groomerName: fhirData.name,
        groomerAddress: fhirData.address?.[0]?.line?.[0] || '',
        city: fhirData.address?.[0]?.city || '',
        country: fhirData.address?.[0]?.country || '',
        zipCode: fhirData.address?.[0]?.postalCode || '',
        telephone: this.extractTelecomValue(fhirData.telecom, 'phone'),
        emailAddess: this.extractTelecomValue(fhirData.telecom, 'email'),
        website: this.extractTelecomValue(fhirData.telecom, 'url'),
      };

      const newgroomer = await this.groomerModel.create(groomerData);

      return newgroomer;
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

  toFhirOrganizationGroomer(groomer) {
    return {
      resourceType: "Organization",
      id: groomer._id.toString(),
      name: groomer.groomerName,
      telecom: [
        groomer.telephone ? { system: "phone", value: groomer.telephone } : null,
        groomer.emailAddess ? { system: "email", value: groomer.emailAddess } : null,
        groomer.website ? { system: "url", value: groomer.website } : null
      ].filter(Boolean),
      address: [
        {
          line: [groomer.groomerAddress],
          city: groomer.city,
          postalCode: groomer.zipCode,
          country: groomer.country
        }
      ]
    };
  }
  
}

module.exports = GroomerService;
