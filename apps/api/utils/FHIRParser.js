class FHIRParser {
    static parseDiabetesObservation(observation) {
        const components = observation.component || [];
      
        // Match by either code.text or any coding.display
        const getComponentValue = (label) => {
          const comp = components.find(c =>
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
          doctorId: observation.encounter?.reference?.split("/")[1] || null,
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
      }

      static toFHIRObservation(record) {
        const observation = {
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
          encounter: {
            reference: `Encounter/${record.doctorId}`
          },
          effectiveDateTime: `${record.recordDate}T${record.recordTime}+05:30`,
          component: [
            FHIRParser.component("Water Intake", record.waterIntake),
            FHIRParser.component("Food Intake", record.foodIntake),
            FHIRParser.component("Activity Level", record.activityLevel),
            FHIRParser.component("Urination", record.urination),
            FHIRParser.component("Sign of Illness", record.signOfIllness),
            FHIRParser.componentQuantity("Blood Glucose", record.bloodGlucose, "mg"),
            FHIRParser.componentQuantity("Urine Glucose", record.urineGlucose, "mg"),
            FHIRParser.componentQuantity("Urine Ketones", record.urineKetones, "mg"),
            FHIRParser.componentQuantity("Weight", record.weight, "kg")
          ].filter(Boolean)
        };
    
        // Add bodyCondition images as attachments
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
      }
    
      static component(codeText, value) {
        if (!value) return null;
        return {
          code: {
            text: codeText
          },
          valueString: value
        };
      }
    
      static componentQuantity(codeText, value, unit) {
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
      } 

  }
  
  module.exports = FHIRParser;