import { Request, Response } from 'express';
import SlotService from '../services/slot.service';
import MonthlySlotService from '../services/monthly.slot.service';
import { FHIRSlotValidator } from '../validators/FHIRSlotValidator';
import { MonthlySlotValidator } from '../validators/MonthlySlotValidator';
import { FHIRValidator } from '../validators/FHIRValidator';
import validator from 'validator';

interface SlotQuery {
  appointmentDate?: string;
  doctorId?: string;
}

interface MonthlySlotQuery {
  slotMonth?: string;
  slotYear?: string;
  doctorId?: string;
}

const SlotController = {
  // FHIR spec requires GET with query params
  getTimeSlots: async (req: Request<unknown, unknown, unknown, SlotQuery>, res: Response): Promise<Response> => {
    try {
      const { appointmentDate, doctorId } = req.query;

      

      if (
          !appointmentDate ||
          typeof appointmentDate !== 'string' ||
          !validator.isISO8601(appointmentDate)
        ) {
          return res.status(400).json({ message: 'Invalid appointment date' });
        }

        if (
          !doctorId ||
          typeof doctorId !== 'string' ||
          !/^[a-f\d]{24}$/i.test(doctorId)
        ) {
          return res.status(400).json({ message: 'Invalid doctor ID' });
        }
      const isValidDate = (dateStr: string): boolean => {
        const date = new Date(dateStr);
        return /^\d{4}-\d{2}-\d{2}$/.test(dateStr) && !isNaN(date.getTime());
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

      const result = await SlotService.getAvailableTimeSlots({ appointmentDate, doctorId });

      if (appointmentDate === today) {
        const now = new Date();
        result.entry = result.entry?.filter((slot: any) => {
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

    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return res.status(200).json({
        issue: [{
          status: 0,
          severity: "error",
          code: "exception",
          details: { text: "Error while fetching time slots", diagnostics: message }
        }]
      });
    }
  },

  TimeSlotsByMonth: async (req: Request<unknown, unknown, unknown, MonthlySlotQuery>, res: Response): Promise<Response> => {
    const { slotMonth, slotYear, doctorId } = req.query;

    if (typeof doctorId !== 'string' || !/^[a-fA-F0-9-]{36}$/.test(doctorId)) {
      return res.status(200).json({ status: 0, message: 'Invalid doctor ID' });
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

      return res.status(200).json({ status: 1, data: result });
    } catch (error: unknown) {
      console.error("MonthlySlotController Error:", error);
      const message = error instanceof Error ? error.message : 'Internal Server Error';
      return res.status(500).json({ error: message });
    }
  }
};

export default SlotController;
