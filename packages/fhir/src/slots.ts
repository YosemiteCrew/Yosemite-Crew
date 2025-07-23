export const FHIRSlotValidator =  {
     validateBundle: (bundle:any) => {
      const errors:any = [];
  
      if (!bundle || bundle.resourceType !== "Bundle" || bundle.type !== "collection") {
        errors.push("Invalid bundle structure");
        return errors;
      }
  
      if (!Array.isArray(bundle.entry)) {
        errors.push("Bundle entry must be an array");
        return errors;
      }
  
      bundle.entry.forEach((entry:any, index:number) => {
        const slot = entry?.resource;
        const path = `entry[${index}].resource`;
  
        if (!slot) {
          errors.push(`${path} is missing`);
          return;
        }
  
        errors.push(FHIRSlotValidator.validateSlot(slot, path));
      });
  
      return errors;
    },
  
    validateSlot: (slot:any, path = 'resource') => {
      const errors = [];
  
      if (slot.resourceType !== "Slot") {
        errors.push(`${path}.resourceType must be 'Slot'`);
      }
  
      if (!slot.id || typeof slot.id !== "string") {
        errors.push(`${path}.id must be a string`);
      }
  
      if (
        !slot.schedule ||
        !slot.schedule.reference ||
        typeof slot.schedule.reference !== "string" ||
        !slot.schedule.reference.startsWith("Schedule/")
      ) {
        errors.push(`${path}.schedule.reference must be a string starting with 'Schedule/'`);
      }
  
      if (typeof slot.isBooked !== "string" || !["true", "false"].includes(slot.isBooked.toLowerCase())) {
        errors.push(`${path}.isBooked must be 'true' or 'false' as string`);
      }
  
      const timeRegex = /^(0?[1-9]|1[0-2]):[0-5][0-9] (AM|PM)$/;
      if (!slot.slotTime || typeof slot.slotTime !== "string" || !timeRegex.test(slot.slotTime)) {
        errors.push(`${path}.slotTime must be in format like '11:45 AM'`);
      }
  
      return errors;
    },
    validateFHIRBundle: (bundle : any) => {
       const issues = [];
  
      // Check if the bundle is correctly structured
      if (!bundle || bundle.resourceType !== "Bundle" || bundle.type !== "collection") {
        issues.push({
          severity: "error",
          code: "invalid",
          details: { text: "Invalid FHIR Bundle structure" },
        });
      }
  
      // Validate each entry in the bundle
      if (Array.isArray(bundle.entry)) {
        bundle.entry.forEach((entry:any, index:number) => {
          if (!entry.resource) {
            issues.push({
              severity: "error",
              code: "invalid",
              details: { text: `Missing resource in entry ${index + 1}` },
            });
          }
  
          // Validate Schedule
          if (entry.resource.resourceType === "Schedule") {
            if (!entry.resource.id) {
              issues.push({
                severity: "error",
                code: "invalid",
                details: { text: `Missing Schedule id in entry ${index + 1}` },
              });
            }
            if (!entry.resource.identifier || entry.resource.identifier.length === 0) {
              issues.push({
                severity: "error",
                code: "invalid",
                details: { text: `Missing Schedule identifier in entry ${index + 1}` },
              });
            }
            if (!entry.resource.actor || entry.resource.actor.length === 0) {
              issues.push({
                severity: "error",
                code: "invalid",
                details: { text: `Missing actor in Schedule entry ${index + 1}` },
              });
            }
          }
  
          // Validate Observation
          if (entry.resource.resourceType === "Observation") {
            if (!entry.resource.code || !entry.resource.code.coding || entry.resource.code.coding.length === 0) {
              issues.push({
                severity: "error",
                code: "invalid",
                details: { text: `Missing Observation code in entry ${index + 1}` },
              });
            }
            if (!entry.resource.subject) {
              issues.push({
                severity: "error",
                code: "invalid",
                details: { text: `Missing subject in Observation entry ${index + 1}` },
              });
            }
            if (!entry.resource.component || entry.resource.component.length === 0) {
              issues.push({
                severity: "error",
                code: "invalid",
                details: { text: `Missing component in Observation entry ${index + 1}` },
              });
            }
          }
        });
      } else {
        issues.push({
          severity: "error",
          code: "invalid",
          details: { text: "Missing or invalid 'entry' array in the FHIR Bundle" },
        });
      }
  
      return issues;
    }
  }
  
  export class MonthlySlotValidator {
    static validateRequest({ doctorId, slotMonth, slotYear }:{ doctorId: string, slotMonth: number, slotYear: number }) {
      const issues = [];
  
      if (!doctorId) {
        issues.push({
          severity: "error",
          code: "invalid",
          details: { text: "Doctor ID is required" }
        });
      }
  
      if (!slotMonth || isNaN(slotMonth) || slotMonth < 1 || slotMonth > 12) {
        issues.push({
          severity: "error",
          code: "invalid",
          details: { text: "Valid month (1-12) is required" }
        });
      }
  
      if (!slotYear || isNaN(slotYear) || slotYear.toString().length !== 4) {
        issues.push({
          severity: "error",
          code: "invalid",
          details: { text: "Valid 4-digit year is required" }
        });
      }
  
      return issues;
    }
  }
  