class FhirToNormal{
    constructor(data){
        this.data = data;
    }
    static fromFHIRValueSet(fhirValueSet) {
        const hospitalId = fhirValueSet.id.replace("purpose-of-visit-", "");
        const concepts = fhirValueSet.compose?.include?.[0]?.concept || [];
    
        return concepts.map(concept => ({
          _id: concept.code,
          name: concept.display,
          HospitalId: hospitalId,
        }));
      }
}
export {FhirToNormal}