class BusinessFhirFormatter {
    static toFhirOrganization(org) {
      return {
        resourceType: "Organization",
        id: org.cognitoId,
        name: org.profileData?.name || org.businessName || "Unknown",
        type: [{
          coding: [{
            system: "http://terminology.hl7.org/CodeSystem/organization-type",
            code: "prov",
            display: org.businessType
          }]
        }],
        address: [{
          text: org.profileData?.address || ""
        }],
        extension: [
          {
            url: "http://example.org/fhir/StructureDefinition/rating",
            valueDecimal: org.rating || 0
          }
        ]
      };
    }
  
    static toFhirHealthcareServices(org) {
      return (org.departments || []).map(dept => ({
        resourceType: "HealthcareService",
        id: `${org.cognitoId}-${dept.departmentId}`,
        providedBy: {
          reference: `Organization/${org.cognitoId}`
        },
        name: dept.departmentName,
        specialty: [
          { text: dept.departmentName }
        ],
        extension: [
          {
            url: "http://example.org/fhir/StructureDefinition/doctorCount",
            valueInteger: dept.doctorCount
          }
        ]
      }));
    }
  
    static createFhirBundle(resources) {
      return {
        resourceType: "Bundle",
        type: "searchset",
        total: resources.length,
        entry: resources.map(resource => ({ resource }))
      };
    }
  }
  
  module.exports = BusinessFhirFormatter;