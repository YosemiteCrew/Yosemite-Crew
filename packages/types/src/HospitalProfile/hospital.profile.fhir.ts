import { Data, Address } from "./hospital.profile.types";

export class FHIRProfileParser {
  constructor(private fhirData: Data) {}

  getUserId(): string | undefined {
    return this.fhirData.organization.identifier.find(
      (id) => id.system === "http://example.com/hospital-id"
    )?.value;
  }

  getRegistrationNumber(): string | undefined {
    return this.fhirData.organization.identifier.find(
      (id) => id.system === "http://example.com/registration"
    )?.value;
  }

  getBusinessName(): string {
    return this.fhirData.organization.name;
  }

  getPhoneNumber(): string | undefined {
    return this.fhirData.organization.telecom.find(
      (t) => t.system === "phone"
    )?.value;
  }

  getWebsite(): string | undefined {
    return this.fhirData.organization.telecom.find(
      (t) => t.system === "url"
    )?.value;
  }

  getAddress(): Address {
    return this.fhirData.organization.address?.[0] ?? {};
  }

  getCoordinates(): { latitude?: number; longitude?: number } {
    const address = this.getAddress();

const extensions = Array.isArray(address.extension) ? address.extension : [];

    const latitude = extensions.find((ext: any) => ext.url === "latitude")?.valueDecimal;
    const longitude = extensions.find((ext: any) => ext.url === "longitude")?.valueDecimal;

    return { latitude, longitude };
  }

  getYearOfEstablishment(): string | undefined {
    return this.fhirData.organization.extension?.[0]?.valueString;
  }

  getActiveModes(): boolean | undefined {
    return this.fhirData.organization.active;
  }

  getSelectedServices(): { code: string; display: string }[] {
    return this.fhirData.healthcareServices.map((service) => ({
      code: service.type?.[0]?.coding?.[0]?.code ?? "",
      display: service.type?.[0]?.coding?.[0]?.display ?? "",
    }));
  }
}
