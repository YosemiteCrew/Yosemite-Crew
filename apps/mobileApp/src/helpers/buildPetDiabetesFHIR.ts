// src/helpers/buildPetDiabetesFHIR.ts
import {
  type DiabetesObservationDetails,
  type FHIRObservation,
  type FHIRComponentKey,
} from '@/types/api';

// Define the type for a single component's configuration
type FHIRComponentConfig = {
  system: string;
  code: string;
  display: string;
  text: string;
  valueType: 'string' | 'quantity' | 'boolean' | 'integer';
  unit?: string;
};

// The entire FHIR_COMPONENTS object is now included
const FHIR_COMPONENTS: Record<FHIRComponentKey, FHIRComponentConfig> = {
  activityLevel: {
    system: 'http://loinc.org',
    code: '8867-4',
    display: 'Heart rate',
    text: 'Activity Level',
    valueType: 'string',
  },
  glucose: {
    system: 'http://loinc.org',
    code: '2339-0',
    display: 'Blood glucose',
    text: 'Glucose',
    valueType: 'quantity',
    unit: 'mmol/L',
  },
  weight: {
    system: 'http://loinc.org',
    code: '29463-7',
    display: 'Body weight',
    text: 'Weight',
    valueType: 'quantity',
    unit: 'kg',
  },
  insulinIntake: {
    system: 'http://loinc.org',
    code: '59826-8',
    display: 'Insulin dose',
    text: 'Insulin Intake',
    valueType: 'quantity',
    unit: 'IU',
  },
  hba1c: {
    system: 'http://loinc.org',
    code: '4548-4',
    display: 'Hemoglobin A1c/Hemoglobin.total in Blood',
    text: 'HbA1c',
    valueType: 'quantity',
    unit: '%',
  },
  mealInfo: {
    system: 'http://loinc.org',
    code: '76506-4',
    display: 'Meal information',
    text: 'Meal Info',
    valueType: 'string',
  },
  stressLevel: {
    system: 'http://loinc.org',
    code: '75218-5',
    display: 'Perceived stress level',
    text: 'Stress Level',
    valueType: 'string',
  },
  sleepHours: {
    system: 'http://loinc.org',
    code: '93832-4',
    display: 'Hours of sleep',
    text: 'Sleep Hours',
    valueType: 'quantity',
    unit: 'hours',
  },
  bloodPressureSystolic: {
    system: 'http://loinc.org',
    code: '8480-6',
    display: 'Systolic blood pressure',
    text: 'Systolic BP',
    valueType: 'quantity',
    unit: 'mm[Hg]',
  },
  bloodPressureDiastolic: {
    system: 'http://loinc.org',
    code: '8462-4',
    display: 'Diastolic blood pressure',
    text: 'Diastolic BP',
    valueType: 'quantity',
    unit: 'mm[Hg]',
  },
  notes: {
    system: 'http://hl7.org/fhir/StructureDefinition/notes',
    code: 'notes',
    display: 'Additional Notes',
    text: 'Notes',
    valueType: 'string',
  },
};

export const buildDiabetesObservation = ({
  patientId,
  encounterId,
  componentsData,
}: DiabetesObservationDetails): FHIRObservation => ({
  resourceType: 'Observation',
  id: `diabetes-record-${new Date().toISOString().split('T')[0]}`,
  status: 'final',
  category: [
    {
      coding: [
        {
          system: 'http://terminology.hl7.org/CodeSystem/observation-category',
          code: 'social-history',
          display: 'Social History',
        },
      ],
    },
  ],
  code: {
    coding: [
      {
        system: 'http://loinc.org',
        code: '33762-6',
        display: 'Diabetes tracking panel',
      },
    ],
    text: 'Diabetes Record',
  },
  subject: {
    reference: `Patient/${patientId}`,
  },
  encounter: {
    reference: `Encounter/${encounterId}`,
  },
  effectiveDateTime: new Date().toISOString(),
  component: componentsData.map(({ key, value }) => {
    const config = FHIR_COMPONENTS[key];

    if (!config) {
      throw new Error(`Unknown FHIR component key: ${key}`);
    }

    const base: any = {
      code: {
        coding: [
          {
            system: config.system,
            code: config.code,
            display: config.display,
          },
        ],
        text: config.text,
      },
    };

    switch (config.valueType) {
      case 'string':
        base.valueString = value;
        break;
      case 'boolean':
        base.valueBoolean = value as boolean;
        break;
      case 'integer':
        base.valueInteger = value as number;
        break;
      case 'quantity':
        base.valueQuantity = {
          value: value as number,
          unit: config.unit,
          system: 'http://unitsofmeasure.org',
          code: config.unit,
        };
        break;
      default:
        throw new Error(`Unsupported value type: ${config.valueType}`);
    }

    return base;
  }),
});