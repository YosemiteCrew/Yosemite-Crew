// utils/FHIRMapper.js

class FHIRMapper {
    static toImmunizationResource(vaccinationDoc) {
      const containedDocs = vaccinationDoc.vaccineImage?.map((img, index) => ({
        resourceType: "DocumentReference",
        id: `doc-${index + 1}`,
        status: "current",
        type: {
          text: "Vaccine Image"
        },
        content: [
          {
            attachment: {
              contentType: img.mimetype,
              title: img.originalname,
              url: img.url
            }
          }
        ]
      })) || [];
  
      const imageRefs = vaccinationDoc.vaccineImage?.map((_, index) => ({
        reference: `#doc-${index + 1}`
      })) || [];
  
      return {
        resourceType: "Immunization",
        id: vaccinationDoc._id.toString(),
        status: "completed",
        patient: {
          reference: `Patient/${vaccinationDoc.petId}`
        },
        vaccineCode: {
          coding: [
            {
              system: "http://hl7.org/fhir/sid/cvx",
              code: vaccinationDoc.vaccineName?.toUpperCase() || "UNKNOWN",
              display: vaccinationDoc.vaccineName
            }
          ],
          text: vaccinationDoc.vaccineName
        },
        lotNumber: vaccinationDoc.batchNumber,
        manufacturer: {
          display: vaccinationDoc.manufacturerName
        },
        occurrenceDateTime: vaccinationDoc.vaccinationDate,
        location: {
          display: vaccinationDoc.hospitalName
        },
        note: [
          {
            text: `Next due: ${new Date(vaccinationDoc.nextdueDate).toISOString()}`
          },
          {
            text: `Expiry date: ${new Date(vaccinationDoc.expiryDate).toISOString()}`
          }
        ],
        extension: [
          {
            url: "http://example.org/fhir/StructureDefinition/immunization-reminder",
            valueBoolean: vaccinationDoc.reminder,
          }
        ],
        contained: containedDocs,
        supportingInformation: imageRefs
      };
    }
  
    static toFHIRBundle(vaccinations) {
      return {
        resourceType: "Bundle",
        type: "collection",
        entry: vaccinations.map(vacc => ({
          resource: this.toImmunizationResource(vacc)
        }))
      };
    }
  }
  
  module.exports = FHIRMapper;
  