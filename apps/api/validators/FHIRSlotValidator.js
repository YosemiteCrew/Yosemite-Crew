
const FHIRSlotValidator =  {
     validateBundle: (bundle) => {
      const errors = [];
  
      if (!bundle || bundle.resourceType !== "Bundle" || bundle.type !== "collection") {
        errors.push("Invalid bundle structure");
        return errors;
      }
  
      if (!Array.isArray(bundle.entry)) {
        errors.push("Bundle entry must be an array");
        return errors;
      }
  
      bundle.entry.forEach((entry, index) => {
        const slot = entry?.resource;
        const path = `entry[${index}].resource`;
  
        if (!slot) {
          errors.push(`${path} is missing`);
          return;
        }
  
        errors.push(...this.validateSlot(slot, path));
      });
  
      return errors;
    },
  
    validateSlot: (slot, path = 'resource') => {
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
    }
  }
  
  module.exports = FHIRSlotValidator;
  