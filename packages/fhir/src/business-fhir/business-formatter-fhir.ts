import { Department, Organization } from "@yosemite-crew/types";


class BusinessFhirFormatter {
  static toFhirOrganization(org:Organization) {
    console.log(org, "ORG");
    const selectedServicesExtension = (org.profileData?.selectedServices || []).map((service ) => ({
      url: "http://example.org/fhir/StructureDefinition/selectedService",
      valueString: service
    }));
  
    const extensions = [
      {
        url: "http://example.org/fhir/StructureDefinition/rating",
        valueDecimal: org.rating || 0
      },
      ...(org.profileData?.logo ? [{
        url: "http://example.org/fhir/StructureDefinition/logo",
        valueUrl: org.profileData.logo
      }] : []),
      ...(org.profileData?.website ? [{
        url: "http://example.org/fhir/StructureDefinition/website",
        valueUrl: org.profileData.website
      }] : []),
      ...selectedServicesExtension
    ];
  
    return {
      resourceType: "Organization",
      id: org.cognitoId,
      name: org.profileData?.name || org.profileData?.businessName || org.businessName || "Unknown",
      type: [{
        coding: [{
          system: "http://terminology.hl7.org/CodeSystem/organization-type",
          code: "prov",
          display: org.businessType
        }]
      }],
      address: [{
        text: org.profileData?.address?.addressLine1 || "",
        extension: [
          {
            url: "http://hl7.org/fhir/StructureDefinition/geolocation",
            extension: [
              {
                url: "latitude",
                valueDecimal: org?.profileData?.latitude
              },
              {
                url: "longitude",
                valueDecimal: org?.profileData?.longitude
              }
            ]
          }
        ]
      }],
      image:org.profileData?.image,
      extension: extensions
    };
  }
  
    static toFhirHealthcareServices(org:Organization) {
      
      return (org.departments || []).map((dept :Department) => ({
        resourceType: "HealthcareService",
        id: `${dept.departmentId}`,
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
  }
  
  export {BusinessFhirFormatter};