// validators/MonthlySlotValidator.js
class MonthlySlotValidator {
    static validateRequest({ doctorId, slotMonth, slotYear }) {
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
  
  module.exports = MonthlySlotValidator;
  