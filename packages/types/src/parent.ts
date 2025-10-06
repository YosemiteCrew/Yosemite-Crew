import type { RelatedPerson } from "../../fhirtypes/src/RelatedPerson";
import { Address, toFHIRAddress } from "./address.model";

export const PARENT_AGE_EXTENSION_URL = "http://example.org/fhir/StructureDefinition/parent-age";

export interface Parent {
    _id: string;
    firstName: string;
    lastName?: string;
    age: number;
    address: Address;
    phoneNumber?: string;
    birthDate?: string;
    profileImageUrl?: string;
}

export function toFHIRRelatedPerson(parent: Parent): RelatedPerson {
    const id = String(parent._id);

    const nameText = [parent.firstName, parent.lastName].filter(Boolean).join(" ").trim();
    const name = nameText
        ? [
              {
                  use: "official" as const,
                  text: nameText,
                  given: parent.firstName ? [parent.firstName] : undefined,
                  family: parent.lastName || undefined,
              },
          ]
        : undefined;

    const telecom = parent.phoneNumber
        ? [
              {
                  system: "phone" as const,
                  value: parent.phoneNumber,
              },
          ]
        : undefined;

    const fhirAddress = parent.address ? toFHIRAddress(parent.address) : undefined;
    const address = fhirAddress && Object.values(fhirAddress).some(Boolean) ? [fhirAddress] : undefined;

    const photo = parent.profileImageUrl
        ? [
              {
                  url: parent.profileImageUrl,
              },
          ]
        : undefined;

    const extension = typeof parent.age === "number"
        ? [
              {
                  url: PARENT_AGE_EXTENSION_URL,
                  valueInteger: parent.age,
              },
          ]
        : undefined;

    const birthDate = parent.birthDate || undefined;

    return {
        resourceType: "RelatedPerson",
        id,
        name,
        telecom,
        address,
        photo,
        birthDate,
        extension,
    };
}
