const { v4: uuidv4 } = require("uuid");
const AWS = require("aws-sdk");
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

class HospitalProfileFHIRBuilder {
  constructor(profile) {
    this.profile = profile;
    // this.s3BucketName = s3BucketName;
  }

  getS3Url(fileKey) {
    const params = {
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Key: fileKey,
      Expires: 604800 //Expire In 7 Days
    };
    return fileKey ? s3.getSignedUrl('getObject', params) : null;
  }
  

  buildOrganizationResource() {
    const { profile } = this;
    const logoUrl = this.getS3Url(profile.logo);

    const extensions = [];

    if (profile.registrationNumber) {
      extensions.push({
        url: "https://myorganization.com/fhir/StructureDefinition/registration-number",
        valueString: profile.registrationNumber,
      });
    }

    if (profile.yearOfEstablishment) {
      extensions.push({
        url: "https://myorganization.com/fhir/StructureDefinition/year-of-establishment",
        valueString: profile.yearOfEstablishment,
      });
    }

    if (profile.website) {
      extensions.push({
        url: "https://myorganization.com/fhir/StructureDefinition/website",
        valueUrl: profile.website,
      });
    }

    if (logoUrl) {
      extensions.push({
        url: "https://myorganization.com/fhir/StructureDefinition/logo",
        valueUrl: logoUrl,
      });
    }

    if (profile.address.latitude && profile.address.longitude) {
      extensions.push({
        url: "https://hl7.org/fhir/StructureDefinition/geolocation",
        extension: [
          { url: "latitude", valueDecimal: parseFloat(profile.address.latitude) },
          { url: "longitude", valueDecimal: parseFloat(profile.address.longitude) },
        ],
      });
    }

    return {
      resourceType: "Organization",
      id: profile.userId.toLowerCase(),
      text: {
        status: "generated",
        div: `<div xmlns="http://www.w3.org/1999/xhtml"><p>${profile.businessName} - ${profile.address.city}</p></div>`,
      },
      name: profile.businessName,
      telecom: [{ system: "phone", value: profile.phoneNumber }],
      address: [
        {
          use: "work",
          line: [
            profile.address.addressLine1,
            profile.address.street
          ].filter(Boolean), // avoid null/undefined
          city: profile.address.city,
          state: profile.address.state,
          postalCode: profile.address.zipCode,
          country: profile.address.country || "US", // if you have country data
        },
      ],      
      active: profile.activeModes === 'yes',
      ...(extensions.length > 0 ? { extension: extensions } : {}),
    };
  }

  buildHealthcareServiceResources() {
    const { profile } = this;

    return (profile.selectedServices || []).map((service, index) => {
      const id = uuidv4().toLowerCase();
      return {
        resourceType: "HealthcareService",
        id,
        providedBy: {
          reference: `urn:uuid:${profile.userId.toLowerCase()}`,
        },
        active: true,
        name: service,
        specialty: [
          {
            text: service,
          },
        ],
      };
    });
  }

  buildDocumentReferences() {
    return (this.profile.prescription_upload || []).map((file, index) => {
      const id = uuidv4().toLowerCase();
      return {
        resourceType: "DocumentReference",
        id,
        text: {
          status: "generated",
          div: `<div xmlns="http://www.w3.org/1999/xhtml"><p>Document ${index + 1}: ${file.name}</p></div>`,
        },
        status: "current",
        type: {
          coding: [
            {
              system: "http://loinc.org",
              code: "34133-9",
              display: "Summary of episode note",
            },
          ],
        },
        content: [
          {
            attachment: {
              contentType: file.type,
              url: this.getS3Url(file.name),
            },
          },
        ],
      };
    });
  }

  buildFHIRBundle() {
    const orgResource = this.buildOrganizationResource();
    const healthcareServices = this.buildHealthcareServiceResources();
    const documents = this.buildDocumentReferences();

    return {
      resourceType: "Bundle",
      type: "collection",
      entry: [
        {
          fullUrl: `urn:uuid:${orgResource.id}`,
          resource: orgResource,
        },
        ...healthcareServices.map((svc) => ({
          fullUrl: `urn:uuid:${svc.id}`,
          resource: svc,
        })),
        ...documents.map((doc) => ({
          fullUrl: `urn:uuid:${doc.id}`,
          resource: doc,
        })),
      ],
    };
  }
}

module.exports = HospitalProfileFHIRBuilder;
