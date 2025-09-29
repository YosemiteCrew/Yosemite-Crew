import { Request, Response } from 'express';
import logger from '../utils/logger';
import exercisePlan from '../models/Plan';
import yoshPainJournals from '../models/painJournal';
import type { FhirCarePlan, painJournal, plan } from "@yosemite-crew/types";

const planController = {

  exercisePlan: async (req: Request, res: Response): Promise<void> => {
    try {

      const {
        userId,
        petId,
        condition,
        weeksSinceSurgery,
        mobilityLevel,
        painLevel,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      } = fromFhirCarePlan(req.body) as {
        userId: string;
        petId: string;
        condition: string;
        weeksSinceSurgery: string;
        mobilityLevel: string;
        painLevel: string;
      }

      const newPlan: plan = await exercisePlan.create({
        userId,
        petId,
        condition,
        weeksSinceSurgery,
        mobilityLevel,
        painLevel,
      });

      res.status(201).json({
        message: 'Exercise Plan saved successfully',
        plan: { id: newPlan._id },
      });
    } catch (error) {
      logger.error('Error saving exercise plan:', error);
      res.status(500).json({ message: 'Internal Server Error' });
    }
  },

  addPainJournal: async (req: Request, res: Response): Promise<void> => {
    try {
      const journalData = req.body as painJournal;

      const newJournal: painJournal = await yoshPainJournals.create(journalData);

      if (newJournal) {
        res.status(201).json({
          message: 'Pain assessment saved to pain journal successfully',
          Feline: {
            id: newJournal._id,
          },
        });
      }
    } catch (error) {
      logger.error('Error saving pain journal:', error);
      res.status(500).json({
        message: 'Failed to save pain journal entry',
      });
    }
  },


  getExercisePlan: async (req: Request, res: Response): Promise<void> => {

    const userid = req.params.userId;

    const result = await exercisePlan.find({ userId: { $eq: userid } });
    if (result) {
      res.json(result);
    } else {
      res.status(404).json({ message: "No exercise plans found for this user" });

    }

  },

  getPainJournal: async (req: Request, res: Response): Promise<void> => {

    const userid = req.params.userId;
    const result = await yoshPainJournals.find({ userId: { $eq: userid } });
    if (result) {
      res.json(result);
    } else {
      res.status(404).json({ message: "No pain journals found for this user" });
    }

  }

}

export function fromFhirCarePlan(fhir: FhirCarePlan): {
  userId: string;
  petId: string;
  condition?: string;
  weeksSinceSurgery?: string;
  mobilityLevel?: string;
  painLevel?: string;
} {

  const extensions = fhir.extension || [];

  const getValue = (url: string): string => {
    const ext = extensions.find((e) => e.url === url);
    return ext?.valueString || "";
  };

  return {
    userId: fhir.author?.[0]?.reference?.split("/")[1] || "",
    petId: fhir.subject?.reference?.split("/")[1] || "",
    condition: fhir.description || "",
    weeksSinceSurgery: getValue("http://example.org/fhir/StructureDefinition/weeksSinceSurgery"),
    mobilityLevel: getValue("http://example.org/fhir/StructureDefinition/mobilityLevel"),
    painLevel: getValue("http://example.org/fhir/StructureDefinition/painLevel"),
  };
}
export default planController;