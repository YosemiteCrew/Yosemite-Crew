import type {
  FHIRComponentDiabetes,
  ParsedDiabetesObservation,
  FHIRObservationDiabetes,
  DiabetesRecord
} from "@yosemite-crew/types";

// Extract component string or quantity from observation
export const parseDiabetesObservation = (observation: any): ParsedDiabetesObservation => {
  const components: FHIRComponentDiabetes[] = observation.component || [];

  const getComponentValue = (label: string): any => {
    const comp = components.find(
      c =>
        (c.code.text && c.code.text === label) ||
        (c.code.coding && c.code.coding.some(cd => cd.display === label))
    );
    if (!comp) return null;
    if (comp.valueQuantity) return comp.valueQuantity.value;
    if (comp.valueString) return comp.valueString;
    return null;
  };

  return {
    petId: observation.subject?.reference?.split("/")[1] || null,
    recordDate: observation.effectiveDateTime?.split("T")[0] || null,
    recordTime: observation.effectiveDateTime?.split("T")[1]?.replace("+05:30", "") || null,

    waterIntake: getComponentValue("Water Intake"),
    foodIntake: getComponentValue("Food Intake"),
    activityLevel: getComponentValue("Activity Level"),
    urination: getComponentValue("Urination"),
    signOfIllness: getComponentValue("Sign of Illness"),

    bloodGlucose: getComponentValue("Blood Glucose"),
    urineGlucose: getComponentValue("Urine Glucose"),
    urineKetones: getComponentValue("Urine Ketones"),
    weight: getComponentValue("Weight"),
  };
};

// Converts custom record to FHIR Observation
export const toFHIRObservation = (record: DiabetesRecord): FHIRObservationDiabetes => {
  const observation: FHIRObservationDiabetes = {
    resourceType: "Observation",
    id: `diabetes-log-${record._id}`,
    status: "final",
    category: [
      {
        coding: [
          {
            system: "http://terminology.hl7.org/CodeSystem/observation-category",
            code: "vital-signs",
            display: "Vital Signs"
          }
        ]
      }
    ],
    code: {
      coding: [
        {
          system: "http://loinc.org",
          code: "55423-8",
          display: "Diabetes monitoring panel"
        }
      ],
      text: "Diabetes Monitoring Record"
    },
    subject: {
      reference: `Patient/${record.petId}`
    },
    effectiveDateTime: `${record.recordDate}T${record.recordTime}+05:30`,
    component: [
      component("Water Intake", record.waterIntake),
      component("Food Intake", record.foodIntake),
      component("Activity Level", record.activityLevel),
      component("Urination", record.urination),
      component("Sign of Illness", record.signOfIllness),
      componentQuantity("Blood Glucose", record.bloodGlucose, "mg"),
      componentQuantity("Urine Glucose", record.urineGlucose, "mg"),
      componentQuantity("Urine Ketones", record.urineKetones, "mg"),
      componentQuantity("Weight", record.weight, "kg")
    ].filter(Boolean) as FHIRComponentDiabetes[]
  };

  if (record.bodyCondition && Array.isArray(record.bodyCondition)) {
    record.bodyCondition.forEach(file => {
      observation.component.push({
        code: {
          text: "Body Condition Image"
        },
        valueAttachment: {
          contentType: file.mimetype,
          url: file.url,
          title: file.originalname
        }
      });
    });
  }

  return observation;
};

// String value component
export const component = (codeText: string, value?: string | null): FHIRComponentDiabetes | null => {
  if (!value) return null;
  return {
    code: {
      text: codeText
    },
    valueString: value
  };
};

// Numeric value component with units
export const componentQuantity = (codeText: string, value: number | undefined | null, unit: string): FHIRComponentDiabetes | null => {
  if (value == null) return null;
  return {
    code: {
      text: codeText
    },
    valueQuantity: {
      value,
      unit,
      system: "http://unitsofmeasure.org",
      code: unit
    }
  };
};
