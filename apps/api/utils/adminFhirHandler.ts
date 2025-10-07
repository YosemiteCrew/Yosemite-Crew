export class PurposeOfVisitFHIRConverter {
  constructor(private data: any[], private hospitalId: string) {}

  toValueSet() {
    return {
      resourceType: "ValueSet",
      id: `purpose-of-visit-${this.hospitalId}`,
      url: `http://example.org/fhir/ValueSet/purpose-of-visit-${this.hospitalId}`,
      status: "active",
      description: "List of purposes for patient visits specific to the hospital.",
      compose: {
        include: [
          {
            system: `http://example.org/fhir/CodeSystem/purpose-of-visit-${this.hospitalId}`,
            concept: this.data.map(item => ({
              code: item._id,
              display: item.name,
            })),
          },
        ],
      },
    };
  }
}
