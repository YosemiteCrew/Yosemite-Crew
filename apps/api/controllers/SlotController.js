const SlotService = require('../services/SlotService');
const MonthlySlotService = require("../services/MonthlySlotService");
const  FHIRSlotValidator  = require('../validators/FHIRSlotValidator');
const  MonthlySlotValidator  = require('../validators/MonthlySlotValidator');
const FHIRValidator = require("../validators/FHIRValidator");

class SlotController {
  static async handlegetTimeSlots(req, res) {
    try {
     
    const { appointmentDate, doctorId } = req.params;
 
      if (!appointmentDate || !doctorId) {
        return res.status(200).json({
          issue: [{
            status: 0,
            severity: "error",
            code: "invalid",
            details: { text: "Appointment date and doctor ID are required" }
          }]
        });
      }
 
    if (typeof doctorId !== 'string' || !/^[a-fA-F0-9-]{36}$/.test(doctorId)) {
          return res.status(200).json({  status: 0, message: 'Invalid doctor ID' });
     }
      const result = await SlotService.getAvailableTimeSlots({ appointmentDate, doctorId });
      const validationErrors = FHIRSlotValidator.validateBundle(result);
    if (validationErrors.length > 0) {
      return res.status(200).json({
        issue: validationErrors.map(msg => ({
          status: 0,
          severity: "error",
          code: "invalid",
          details: { text: msg }
        }))
      });
    }
      return res.status(200).json({status: 1, data: result});
    } catch (error) {
      console.error("SlotController Error:", error);
      return res.status(200).json({
        issue: [{
          status: 0,
          severity: "error",
          code: "exception",
          details: { text: "Error while fetching time slots", diagnostics: error.message }
        }]
      });
    }
  }

  static async handleTimeSlotsByMonth(req, res) {
   
    const { slotMonth , slotYear , doctorId } = req.params;
    
    if (typeof doctorId !== 'string' || !/^[a-fA-F0-9-]{36}$/.test(doctorId)) {
      return res.status(200).json({ status: 0,  message: 'Invalid doctor ID' });
    }

      const issues = MonthlySlotValidator.validateRequest({ doctorId, slotMonth, slotYear });

    if (issues.length > 0) {
      return res.status(200).json({ status: 0, issue: issues });
    }
    
    try {
      const result = await MonthlySlotService.generateMonthlySlotSummary({ doctorId, slotMonth, slotYear });

      const fhirIssues = FHIRValidator.validateFHIRBundle(result);

      if (fhirIssues.length > 0) {
        return res.status(200).json({ status: 0, issue: fhirIssues });
      }
      return res.status(200).json({status: 1, data: result});
    } catch (error) {
      console.error("MonthlySlotController Error:", error);
      return res.status(500).json({ error: "Internal Server Error" });
    }
  }
}

module.exports = SlotController;
