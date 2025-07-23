import { FHIRSlotBundle, FHIRSlot,ValidationIssue,SlotRequest } from '@yosemite-crew/types'; // ✅ right
export const FHIRSlotValidator = {
  validateBundle: (bundle: unknown): string[] => {
    const errors: string[] = [];

    // Type check base bundle structure
    if (
      !bundle ||
      typeof bundle !== "object" ||
      (bundle as any).resourceType !== "Bundle" ||
      (bundle as any).type !== "collection"
    ) {
      errors.push("Invalid bundle structure");
      return errors;
    }

    const entries = (bundle as FHIRSlotBundle).entry;

    if (!Array.isArray(entries)) {
      errors.push("Bundle entry must be an array");
      return errors;
    }

    entries.forEach((entry, index) => {
      const slot = entry?.resource;
      const path = `entry[${index}].resource`;

      if (!slot) {
        errors.push(`${path} is missing`);
        return;
      }

      errors.push(...FHIRSlotValidator.validateSlot(slot, path));
    });

    return errors;
  },

  validateSlot: (slot: Partial<FHIRSlot>, path = "resource"): string[] => {
    const errors: string[] = [];

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

    if (
      typeof slot.isBooked !== "string" ||
      !["true", "false"].includes(slot.isBooked.toLowerCase())
    ) {
      errors.push(`${path}.isBooked must be 'true' or 'false' as string`);
    }

    const timeRegex = /^(0?[1-9]|1[0-2]):[0-5][0-9] (AM|PM)$/;
    if (!slot.slotTime || typeof slot.slotTime !== "string" || !timeRegex.test(slot.slotTime)) {
      errors.push(`${path}.slotTime must be in format like '11:45 AM'`);
    }

    return errors;
  },
};

export const MonthlySlotValidator = {
  validateRequest(input: unknown): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const { doctorId, slotMonth, slotYear } = input as SlotRequest;
    const month = Number(slotMonth);
    const year = Number(slotYear);
    if (!doctorId) {
      issues.push({
        severity: "error",
        code: "invalid",
        details: { text: "Doctor ID is required" },
      });
    }
    if (!month || isNaN(month) || month < 1 || month > 12) {
      issues.push({
        severity: "error",
        code: "invalid",
        details: { text: "Valid month (1-12) is required" },
      });
    }
    if (!year || isNaN(year) || year.toString().length !== 4) {
      issues.push({
        severity: "error",
        code: "invalid",
        details: { text: "Valid 4-digit year is required" },
      });
    }
    return issues;
  },
};

