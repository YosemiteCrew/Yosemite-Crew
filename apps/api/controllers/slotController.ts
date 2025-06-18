import { Request, Response } from 'express';
const SlotService = require('../services/SlotService');
const MonthlySlotService = require("../services/MonthlySlotService");
const  FHIRSlotValidator  = require('../validators/FHIRSlotValidator');
const  MonthlySlotValidator  = require('../validators/MonthlySlotValidator');
const FHIRValidator = require("../validators/FHIRValidator");

const slotController = {
  // CodeQL [js/sensitive-data-in-get-request] This endpoint follows the FHIR specification which requires using GET with query parameters for data retrieval.
  getTimeSlots : async (req: Request, res :Response) : Promise<void> => {
    try {
      const { appointmentDate, doctorId } = req.query;

      if (typeof doctorId !== 'string' || !/^[a-fA-F0-9-]{36}$/.test(doctorId)) {
        return res.status(200).json({ status: 0, message: 'Invalid doctor ID' });
      }
      
      const isValidDate = (dateStr) => {
        const date = new Date(dateStr);
        return (
          /^\d{4}-\d{2}-\d{2}$/.test(dateStr) && !isNaN(date.getTime())
        );
      };
      if (!isValidDate(appointmentDate)) {
        return res.status(200).json({
          issue: [{
            status: 0,
            severity: "error",
            code: "invalid",
            details: { text: "Invalid appointment date format. Expected YYYY-MM-DD" }
          }]
        });
      }
  
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
  
    const today = new Date().toISOString().split('T')[0];
    if (appointmentDate < today) {
      return res.status(200).json({
        issue: [{
          status: 0,
          severity: "error",
          code: "invalid",
          details: { text: "Appointment date cannot be in the past" }
        }]
      });
    }
  
      let result = await SlotService.getAvailableTimeSlots({ appointmentDate, doctorId });
  
      if (appointmentDate === today) {
        const now = new Date();
        result.entry = result.entry?.filter(slot => {
          const startTime = new Date(slot.resource.start);
          return startTime > now;
        });
      }
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
  
      return res.status(200).json({ status: 1, data: result });
  
    } catch (error) {
      return res.status(200).json({
        issue: [{
          status: 0,
          severity: "error",
          code: "exception",
          details: { text: "Error while fetching time slots", diagnostics: error.message }
        }]
      });
    }
  },
  
  
    timeSlotsByMonth : async(req : Request, res : Response) : Promise<void> => {
   
      const { slotMonth , slotYear , doctorId } = req.query;
      
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

export default slotController;
