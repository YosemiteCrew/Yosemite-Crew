import { Request, Response } from 'express';
import exercisePlan from '../models/Plan';
import  yoshPainJournals from '../models/painJournal';
import type { painJournal } from "@yosemite-crew/types";

const planController = {

    exercisePlan: async (req : Request, res : Response) : Promise<void>=> {
        const planData = req.body;
        const exercisePlans = await exercisePlan.create({
            userId: planData.userId,
            petId: planData.petId,
            typeOfPlan: planData.typeOfPlan,
            condition: planData.condition,
            weeksSinceSurgery: planData.weeksSinceSurgery,
            mobilityLevel: planData.mobilityLevel,
            painLevel: planData.painLevel,
        });
        if (exercisePlans) {
            res.status(201).json({
                message: 'Exercise Plan saved successfully',
                plan: {
                    id: exercisePlans.id,
                }
            });
        }

    },

    addPainJournal: async (req: Request, res: Response): Promise<void> => {
            try {
                const journalData = req.body as painJournal;
                
                const newJournal = await yoshPainJournals.create(journalData);

                if (newJournal) {
                res.status(201).json({
                    message: 'Pain assessment saved to pain journal successfully',
                    Feline: {
                    id: newJournal._id.toString(),
                    },
                });
                }
            } catch (error) {
                console.error('Error saving pain journal:', error);
                res.status(500).json({
                message: 'Failed to save pain journal entry',
                });
            }
            },


    getExercisePlan: async (req : Request, res : Response) : Promise<void> => {
        const userid = req.params.userId;
        const result = await exercisePlan.find({ userId: { $eq: userid } });
        if (result) {
           res.json(result);
        } else {
             res.status(404).json({ message: "No exercise plans found for this user" });
            
        }
       
    },

    getPainJournal: async (req: Request, res :Response): Promise<void> => {

        const userid = req.params.userId;
        const result = await yoshPainJournals.find({ userId: { $eq: userid } });
        if (result) {
            res.json(result);
        } else{
            res.status(404).json({ message: "No pain journals found for this user" });
        }
        
    }

}

export default planController;