class FHIRMapperService{
    static convertFHIRToPet(fhirPatient :any) {
        const pet: any = {};
      
        // Basic Fields
        pet.petName = fhirPatient.name?.[0]?.text || '';
        pet.petdateofBirth = fhirPatient.birthDate || '';
        pet.petGender = fhirPatient.gender 
          ? fhirPatient.gender.charAt(0).toUpperCase() + fhirPatient.gender.slice(1)
          : '';
      
        // Animal Info
        pet.petType = fhirPatient.animal?.species?.coding?.[0]?.display || '';
        pet.petBreed = fhirPatient.animal?.breed?.text || '';
        pet.isNeutered = fhirPatient.animal?.genderStatus?.coding?.[0]?.code === 'neutered' ? 'Yes' : 'No';
      
        // FHIR Extensions
        if (Array.isArray(fhirPatient.extension)) {
          for (const ext of fhirPatient.extension) {
            switch (ext.url) {
              case 'http://yourdomain.com/fhir/StructureDefinition/pet-weight':
                pet.petCurrentWeight = ext.valueString;
                break;
              case 'http://yourdomain.com/fhir/StructureDefinition/pet-color':
                pet.petColor = ext.valueString;
                break;
              case 'http://yourdomain.com/fhir/StructureDefinition/pet-bloodgroup':
                pet.petBloodGroup = ext.valueString;
                break;
              case 'http://yourdomain.com/fhir/StructureDefinition/age-when-neutered':
                pet.ageWhenNeutered = ext.valueInteger;
                break;
              case 'http://yourdomain.com/fhir/StructureDefinition/microchip-number':
                pet.microChipNumber = ext.valueString;
                break;
              case 'http://yourdomain.com/fhir/StructureDefinition/passport-number':
                pet.passportNumber = ext.valueString;
                break;
              case 'http://yourdomain.com/fhir/StructureDefinition/pet-origin':
                pet.petFrom = ext.valueString;
                break;
              case 'http://yourdomain.com/fhir/StructureDefinition/insurance':
                for (const insExt of ext.extension || []) {
                  if (insExt.url === 'company') pet.insuranceCompany = insExt.valueString;
                  if (insExt.url === 'policyNumber') pet.policyNumber = insExt.valueString;
                }
                pet.isInsured = (pet.insuranceCompany && pet.policyNumber) ? 'yes' : 'no';
                break;
              // Optional support for pet image if added in future
              case 'http://yourdomain.com/fhir/StructureDefinition/pet-images':
                pet.petImage = ext.valueString?.split(',').map((str : String) => str.trim()) || [];
                break;
            }
          }
        }
      
        return pet;
      }
      

}
module.exports = FHIRMapperService;