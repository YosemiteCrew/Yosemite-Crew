import { FhirPetResource, NormalPetData } from "@yosemite-crew/types";

export function convertPetDataToFhir(input: NormalPetData | NormalPetData[]): FhirPetResource[] {
  const pets = Array.isArray(input) ? input : [input];

  return pets.map((pet) => ({
    resourceType: "Patient",
    id: pet.petId,
    name: [
      { text: pet.petName },
      ...(pet.petParentName ? [{ text: pet.petParentName }] : []),
    ],
    photo: [{ url: pet.petImage }],
    extension: [
      {
        url: "https://example.org/fhir/StructureDefinition/pet-parent-id",
        valueString: pet.petParentId,
      },
      ...(pet.passportNumber ? [{
        url: "https://example.org/fhir/StructureDefinition/pet-passport-number",
        valueString: pet.passportNumber
      }] : []),
      ...(pet.microChipNumber ? [{
        url: "https://example.org/fhir/StructureDefinition/pet-microchip-number",
        valueString: pet.microChipNumber
      }] : []),
    ],
  }));
}

export function convertFhirToNormalPetData(
  input: FhirPetResource | FhirPetResource[]
): NormalPetData[] {
  const resources = Array.isArray(input) ? input : [input];

  return resources.map((res) => {
    // Extract pet parent name from the second name entry if it exists
    const petParentName = res.name.length > 1 ? res.name[1]?.text : "";
    
    return {
      petId: res.id,
      petName: res.name[0]?.text || "",
      petImage: res.photo[0]?.url || "",
      petParentId: res.extension.find(
        ext => ext.url === "https://example.org/fhir/StructureDefinition/pet-parent-id"
      )?.valueString || "",
      petParentName: petParentName,
      passportNumber: res.extension.find(
        ext => ext.url === "https://example.org/fhir/StructureDefinition/pet-passport-number"
      )?.valueString || "",
      microChipNumber: res.extension.find(
        ext => ext.url === "https://example.org/fhir/StructureDefinition/pet-microchip-number"
      )?.valueString || ""
    };
  });
}