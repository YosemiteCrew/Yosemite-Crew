
import { Request, Response } from 'express';
import ExercisePlanModel from '../models/YoshExercisePlans';
import ExerciseTypeModel from '../models/ExerciseTypeModel';
import ExercisesModel from  '../models/YoshExercises';
import { convertExerciseToFHIR, convertPlanTypesToFHIR , convertExerciseTypeToFHIR} from "@yosemite-crew/fhir";

//import FHIRExerciseService from '../services/FHIRExerciseService';

const AdminController = {

   //Retrieve all plan types added by the admin
     planTypes : async (req : Request, res :Response) => {
      try {
        const exercisePlans = await ExercisePlanModel.find({});

        if(exercisePlans){
          const fhirBundle = convertPlanTypesToFHIR(exercisePlans);
          return res.status(200).json(fhirBundle);
        }
      } catch (error) {
         const message = error instanceof Error ? error.message : "Unknown error occurred";
            return res.status(500).json({
              resourceType: "OperationOutcome",
              issue: [
                {
                  severity: "error",
                  code: "exception",
                  diagnostics: message
                }
              ]
            });
      }
    },

    //Retrieve all exercise types added by the admin
    exerciseTypes:  async (req : Request, res : Response) => {
      try {
        const exerciseTypes = await ExerciseTypeModel.find({});
        if(exerciseTypes){
          const fhirBundle = convertExerciseTypeToFHIR(exerciseTypes);
          return res.status(200).json(fhirBundle);
        }
      } catch (error) {
         const message = error instanceof Error ? error.message : "Unknown error occurred";
          return res.status(500).json({
            resourceType: "OperationOutcome",
            issue: [
              {
                severity: "error",
                code: "exception",
                diagnostics: message
              }
            ]
          });
      }
    },

   //Retrieve all exercise according type
   getExercise: async (req : Request, res : Response) =>{
    try {
      const { type,  keyword = "", page = 1, limit = 10,sort = "desc" } = req.query;

      const regex = new RegExp(keyword, "i");

      // Build the base query
      const query = {
        ...(type && { exerciseType: type }),
        ...(keyword && {
          $or: [
            { exerciseTitle: { $regex: regex } },
            { exerciseSubTitle: { $regex: regex } },
            { exerciseDescription: { $regex: regex } }
          ]
        })
      };

      const skip = (parseInt(page) - 1) * parseInt(limit);
      const sortOption = sort === 'asc' ? 1 : -1;

      const [exercises, total] = await Promise.all([
        ExercisesModel.find(query)
          .sort({ updatedAt: sortOption })
          .skip(skip)
          .limit(parseInt(limit)),
        ExercisesModel.countDocuments(query)
      ]);
      if(exercises){
      const fhirBundle = convertExerciseToFHIR(exercises, { page: parseInt(page),  limit: parseInt(limit),total,type,keyword });
      return res.status(200).json(fhirBundle);
      }

    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error occurred";
      return res.status(500).json({
        resourceType: "OperationOutcome",
        issue: [
          {
            severity: "error",
            code: "exception",
            diagnostics: message
          }
        ]
      });
    }
  }

}

export default AdminController;