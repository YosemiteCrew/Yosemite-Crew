const SlotService = require('../services/SlotService');
const MonthlySlotService = require("../services/MonthlySlotService");
const  FHIRSlotValidator  = require('../validators/FHIRSlotValidator');
const  MonthlySlotValidator  = require('../validators/MonthlySlotValidator');
const FHIRValidator = require("../validators/FHIRValidator");

class SlotController {
  static async handlegetTimeSlots(req, res) {
    try {
      const appointmentDate = req.params.appointmentDate;
      const doctorId = req.params.doctorId;

      if (!appointmentDate || !doctorId) {
        return res.status(400).json({
          issue: [{
            severity: "error",
            code: "invalid",
            details: { text: "Appointment date and doctor ID are required" }
          }]
        });
      }

      const result = await SlotService.getAvailableTimeSlots({ appointmentDate, doctorId });
      const validationErrors = FHIRSlotValidator.validateBundle(result);
    if (validationErrors.length > 0) {
      return res.status(400).json({
        issue: validationErrors.map(msg => ({
          severity: "error",
          code: "invalid",
          details: { text: msg }
        }))
      });
    }
      return res.status(200).json(result);
    } catch (error) {
      console.error("SlotController Error:", error);
      return res.status(500).json({
        issue: [{
          severity: "error",
          code: "exception",
          details: { text: "Error while fetching time slots", diagnostics: error.message }
        }]
      });
    }
  }

  static async handleTimeSlotsByMonth(req, res) {
    const { slotMonth, slotYear, doctorId } = req.params;

    const issues = MonthlySlotValidator.validateRequest({ doctorId, slotMonth, slotYear });

    if (issues.length > 0) {
      return res.status(400).json({ issue: issues });
    }
    
    try {
      const result = await MonthlySlotService.generateMonthlySlotSummary({ doctorId, slotMonth, slotYear });

      const fhirIssues = FHIRValidator.validateFHIRBundle(result);

      if (fhirIssues.length > 0) {
        return res.status(400).json({ issue: fhirIssues });
      }

      return res.json(result);
    } catch (error) {
      console.error("MonthlySlotController Error:", error);
      return res.status(500).json({ error: "Internal Server Error" });
    }
  }
}

module.exports = SlotController;
