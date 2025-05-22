
const VetClinic = require('../models/VeterinaryDetails');

class VetClinicService {
    async createClinic(fhirData, CognitoUser) {
      const data = fhirData.data; // extract the actual FHIR resource object
      const clinic = await VetClinic.create({
        userId: CognitoUser, // or from JWT/session if available
        clinicName: data.name,
        vetName: data.contact?.[0]?.name?.text || '',
        clinicAddress: data.address?.[0]?.line?.[0] || '',
        city: data.address?.[0]?.city || '',
        country: data.address?.[0]?.country || '',
        zipCode: data.address?.[0]?.postalCode || '',
        telephone: data.telecom?.find(t => t.system === 'phone')?.value || '',
        emailAddess: data.telecom?.find(t => t.system === 'email')?.value || '',
        website: data.telecom?.find(t => t.system === 'url')?.value || ''
      });
  
      return clinic;
    }

     toFhirOrganization(clinic) {
        return {
          resourceType: "Organization",
          id: clinic._id.toString(),
          name: clinic.clinicName,
          telecom: [
            clinic.telephone ? { system: "phone", value: clinic.telephone } : null,
            clinic.emailAddess ? { system: "email", value: clinic.emailAddess } : null,
            clinic.website ? { system: "url", value: clinic.website } : null
          ].filter(Boolean),
          address: [
            {
              line: [clinic.clinicAddress],
              city: clinic.city,
              postalCode: clinic.zipCode,
              country: clinic.country
            }
          ],
          contact: clinic.vetName ? [{
            name: { text: clinic.vetName }
          }] : []
        };
      }
      

  }
  

module.exports = new VetClinicService();