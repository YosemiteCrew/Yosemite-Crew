import AWS from 'aws-sdk';
import { v4 as uuidv4 } from 'uuid';

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  region: process.env.AWS_REGION!,
});

// Replacing interfaces with types
export type Address = {
  addressLine1?: string;
  street?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  latitude?: string;
  longitude?: string;
};

export type PrescriptionFile = {
  name: string;
  type: string;
};

export type HospitalProfile = {
  id: unknown;
  userId: string;
  businessName: string;
  phoneNumber: string;
  address: Address;
  registrationNumber?: string;
  yearOfEstablishment?: string;
  website?: string;
  logo?: string;
  activeModes?: 'yes' | 'no';
  selectedServices?: string[];
  prescription_upload?: PrescriptionFile[];
};

// FHIR builder class
export class HospitalProfileFHIRBuilder {
  private profile: HospitalProfile;

  constructor(profile: HospitalProfile) {
    this.profile = profile;
  }

  private getS3Url(fileKey: string | undefined): string | null {
    if (!fileKey) return null;

    const params = {
      Bucket: process.env.AWS_S3_BUCKET_NAME!,
      Key: fileKey,
      Expires: 604800, // 7 days
    };

    return s3.getSignedUrl('getObject', params);
  }

  private buildOrganizationResource(): any {
    const { profile } = this;
    const logoUrl = profile.logo;

    const extensions: any[] = [];

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
      telecom: [
        {
          system: "phone",
          value: profile.phoneNumber,
        },
      ],
      address: [
        {
          use: "work",
          type: "both",
          line: [profile.address.addressLine1, profile.address.street].filter(
            (line): line is string => Boolean(line && line.trim())
          ),
          city: profile.address.city || undefined,
          state: profile.address.state || undefined,
          postalCode: profile.address.zipCode || undefined,
          country: profile.address.country || "US",
        },
      ],
      active: profile.activeModes === 'yes',
      ...(extensions.length > 0 ? { extension: extensions } : {}),
    };
  }

  private buildHealthcareServiceResources(): any[] {
    const { profile } = this;

    return (profile.selectedServices || []).map((service) => {
      const id = uuidv4().toLowerCase();
      return {
        resourceType: "HealthcareService",
        id,
        providedBy: {
          reference: `urn:uuid:${profile.userId.toLowerCase()}`,
        },
        active: true,
        name: service,
        specialty: [{ text: service }],
      };
    });
  }

  private buildDocumentReferences(): any[] {
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

  public buildFHIRBundle(): any {
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
