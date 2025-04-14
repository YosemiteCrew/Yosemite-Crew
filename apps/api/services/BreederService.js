
const breederModel = require('../models/breederDetails'); 

class BreederService {
  constructor() {
    this.breederModel = breederModel;
  }

  async createFromFhirOrganization(fhirData, userId) {
    try {
      const breederData = {
        userId: userId,
        breederName: fhirData.name,
        breederAddress: fhirData.address?.[0]?.line?.[0] || '',
        city: fhirData.address?.[0]?.city || '',
        country: fhirData.address?.[0]?.country || '',
        zipCode: fhirData.address?.[0]?.postalCode || '',
        telephone: this.extractTelecomValue(fhirData.telecom, 'phone'),
        emailAddess: this.extractTelecomValue(fhirData.telecom, 'email'),
        website: this.extractTelecomValue(fhirData.telecom, 'url'),
      };

      const newBreeder = await this.breederModel.create(breederData);

      return newBreeder;
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

  toFhirOrganizationBreeder(breeder) {
    return {
      resourceType: "Organization",
      id: breeder._id.toString(),
      name: breeder.breederName,
      telecom: [
        breeder.telephone ? { system: "phone", value: breeder.telephone } : null,
        breeder.emailAddess ? { system: "email", value: breeder.emailAddess } : null,
        breeder.website ? { system: "url", value: breeder.website } : null
      ].filter(Boolean),
      address: [
        {
          line: [breeder.breederAddress],
          city: breeder.city,
          postalCode: breeder.zipCode,
          country: breeder.country
        }
      ]
    };
  }
  
}

module.exports = BreederService;
