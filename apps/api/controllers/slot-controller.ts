import { Request, Response } from 'express';
import SlotService from '../services/slot-service';
import MonthlySlotService from '../services/monthly.slot.service';
import  {FHIRSlotValidator , MonthlySlotValidator}  from '@yosemite-crew/fhir';
import validator from 'validator';
import { SlotQuery } from '@yosemite-crew/types';

const SlotController = {
  // FHIR spec requires GET with query params
  getTimeSlots : async (req: Request<unknown, unknown, unknown, SlotQuery>, res: Response):Promise<void> => {
    try {
      const { appointmentDate, doctorId } = req.query as { appointmentDate?: string; doctorId?: string };

      if (
          !appointmentDate ||
          typeof appointmentDate !== 'string' ||
          !validator.isISO8601(appointmentDate)
        ) {
           res.status(200).json({status:0, message: 'Invalid appointment date' });
           return
        }

        if (
          !doctorId ||
          typeof doctorId !== 'string'
        ) {
           res.status(200).json({status:0, message: 'Invalid doctor ID' });
           return
        }

      const isValidDate = (dateStr: string): boolean => {
        const date = new Date(dateStr);
        return /^\d{4}-\d{2}-\d{2}$/.test(dateStr) && !isNaN(date.getTime());
      };

      if (!isValidDate(appointmentDate)) {
         res.status(200).json({
          issue: [{
            status: 0,
            severity: "error",
            code: "invalid",
            details: { text: "Invalid appointment date format. Expected YYYY-MM-DD" }
          }]
        });
        return
      }

      const today = new Date().toISOString().split('T')[0];
      if (appointmentDate < today) {
         res.status(200).json({
          issue: [{
            status: 0,
            severity: "error",
            code: "invalid",
            details: { text: "Appointment date cannot be in the past" }
          }]
        });
        return
      }

      const result = await SlotService.getAvailableTimeSlots({ appointmentDate, doctorId });
console.log(result,'resuly', appointmentDate, today, result?.entry);
      if (appointmentDate === today) {
        const now = new Date();
        result.entry = result.entry?.filter((slot) => {
          const startTime = new Date(slot.resource.start);
          return startTime > now;
        });
      }

      const validationErrors  = FHIRSlotValidator.validateBundle(result)
      if (validationErrors.length > 0) {
         res.status(200).json({
          issue: validationErrors.map(msg => ({
            status: 0,
            severity: "error",
            code: "invalid",
            details: { text: msg }
          }))
        });
        return
      }

       res.status(200).json({ status: 1, data: result }); return

    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
       res.status(200).json({
        issue: [{
          status: 0,
          severity: "error",
          code: "exception",
          details: { text: "Error while fetching time slots", diagnostics: message }
        }]
      });
      return
    }
  },

  timeSlotsByMonth : async (req: Request<unknown, unknown, unknown, {slotMonth?:number, slotYear?:number, doctorId?:string}>, res: Response) :Promise<void>=> {
    const { slotMonth, slotYear, doctorId } = req.query;

    if (typeof doctorId !== 'string' || !/^[a-fA-F0-9-]{36}$/.test(doctorId)) {
       res.status(200).json({ status: 0, message: 'Invalid doctor ID' });
       return
    }

    const issues = MonthlySlotValidator.validateRequest({ doctorId, slotMonth, slotYear });

    if (issues.length > 0) {
       res.status(200).json({ status: 0, issue: issues });
       return
    }
    try {
      
      const result = await MonthlySlotService.generateMonthlySlotSummary({ doctorId, slotMonth, slotYear });
  
      // const fhirIssues = FHIRSlotValidator.validateFHIRBundle(result);

      // if (fhirIssues.length > 0) {
      //    res.status(200).json({ status: 0, issue: fhirIssues });
      //    return
      // }

       res.status(200).json({ status: 1, data: result });
       return
    } catch (error: unknown) {
      console.error("MonthlySlotController Error:", error);
      const message = error instanceof Error ? error.message : 'Internal Server Error';
       res.status(200).json({ status:0,  error: message });
       return
    }
  }
};
export default SlotController;
