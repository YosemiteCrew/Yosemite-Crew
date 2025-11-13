export const emptyToUndefined = (v?: string | null) => {
  if (typeof v === "string") {
    const trimmed = v.trim();
    return trimmed === "" ? undefined : trimmed;
  }
  return v ?? undefined;
};

export const orgTypeToCoding = (selectedType: string) => {
  const system = "http://example.org/fhir/CodeSystem/org-type";
  switch (selectedType) {
    case "Hospital":
      return { system, code: "vet-business", display: "Veterinary Business" };
    case "Groomer":
      return { system, code: "groomer", display: "Groomer Shop" };
    case "Breeder":
      return {
        system,
        code: "breeding-facility",
        display: "Breeding Facility",
      };
    case "Boarder":
      return { system, code: "pet-sitter", display: "Pet Sitter" };
    default:
      return undefined;
  }
};

export const convertOrgToFHIR = (formData: any) => {
  return formData;
};

export const convertAddressOrgToFHIR = (formData: any) => {
  return formData;
};
