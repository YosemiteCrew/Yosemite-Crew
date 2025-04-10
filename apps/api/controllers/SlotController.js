const SlotService = require('../services/SlotService');
const MonthlySlotService = require("../services/MonthlySlotService");

class SlotController {
  static async handlegetTimeSlots(req, res) {
    try {
      const { appointmentDate, doctorId } = req.body;

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
    const { doctorId, slotMonth, slotYear } = req.body;

    try {
      const result = await MonthlySlotService.generateMonthlySlotSummary({ doctorId, slotMonth, slotYear });
      return res.json(result);
    } catch (error) {
      console.error("MonthlySlotController Error:", error);
      return res.status(500).json({ error: "Internal Server Error" });
    }
  }
}

module.exports = SlotController;
