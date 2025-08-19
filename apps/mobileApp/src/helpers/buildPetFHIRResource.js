// utils/fhirPetFormatter.js

export const buildPetFHIRResource = ({
  id,
  name,
  gender,
  birthDate,
  speciesDisplay,
  breed,
  genderStatusDisplay,
  weight,
  color,
  ageWhenNeutered,
  microchipNumber,
  insuranceCompany,
  policyNumber,
  passportNumber,
  origin,
  isInsured,
}) => ({
  resourceType: 'Patient',
  id,
  name: [{text: name}],
  gender,
  birthDate,
  animal: {
    species: {
      coding: [
        {
          system: 'http://hl7.org/fhir/animal-species',
          code:
            speciesDisplay?.value === 'Horse'
              ? 'equine'
              : speciesDisplay?.value === 'Dog'
              ? 'canislf'
              : 'feline',
          display: speciesDisplay?.value,
        },
      ],
    },
    breed: {
      text: breed,
    },
    genderStatus: {
      coding: [
        {
          system: 'http://terminology.hl7.org/CodeSystem/animal-genderstatus',
          code: 'neutered',
          display: genderStatusDisplay,
        },
      ],
    },
  },
  extension: [
    {
      url: 'http://yourdomain.com/fhir/StructureDefinition/pet-current-weight',
      valueString: weight,
    },
    {
      url: 'http://yourdomain.com/fhir/StructureDefinition/pet-color',
      valueString: color,
    },
    {
      url: 'http://yourdomain.com/fhir/StructureDefinition/age-when-neutered',
      valueString: ageWhenNeutered,
    },
    {
      url: 'http://yourdomain.com/fhir/StructureDefinition/microchip-number',
      valueString: microchipNumber,
    },
    {
      url: 'http://yourdomain.com/fhir/StructureDefinition/insurance',
      extension: [
        {
          url: 'company',
          valueString: insuranceCompany,
        },
        {
          url: 'policyNumber',
          valueString: policyNumber,
        },
      ],
    },
    {
      url: 'http://yourdomain.com/fhir/StructureDefinition/passport-number',
      valueString: passportNumber,
    },
    {
      url: 'http://yourdomain.com/fhir/StructureDefinition/pet-origin',
      valueString: origin,
    },
    {
      url: 'http://localhost:8000/fhir/extensions/is-insured',
      valueBoolean: isInsured,
    },
  ],
});
