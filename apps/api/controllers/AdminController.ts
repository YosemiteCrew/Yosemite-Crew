
import { Request, Response } from 'express';
import ExercisePlanModel from '../models/YoshExercisePlans';
import ExerciseTypeModel from '../models/ExerciseTypeModel';
import ExercisesModel from  '../models/YoshExercises';
import type { exercisePlanType,  exerciseType , exercises, queryParams } from "@yosemite-crew/types";
import { convertExerciseToFHIR, convertPlanTypesToFHIR , convertExerciseTypeToFHIR} from "@yosemite-crew/fhir";

//import FHIRExerciseService from '../services/FHIRExerciseService';

const AdminController = {

   //Retrieve all plan types added by the admin
     planTypes : async (req : Request, res :Response) : Promise<void> => {
      try {
         const exercisePlans: exercisePlanType[] = await ExercisePlanModel.find({}).lean();

        if(exercisePlans){
          const fhirBundle = convertPlanTypesToFHIR(exercisePlans);
          res.status(200).json(fhirBundle);
        }
      } catch (error) {
         const message = error instanceof Error ? error.message : "Unknown error occurred";
             res.status(500).json({
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
    exerciseTypes:  async (req : Request, res : Response) : Promise<void>=> {
      try {
        const exerciseTypes : exerciseType[]= await ExerciseTypeModel.find({});
        if(exerciseTypes){
          const fhirBundle = convertExerciseTypeToFHIR(exerciseTypes);
           res.status(200).json(fhirBundle);
        }
      } catch (error) {
         const message = error instanceof Error ? error.message : "Unknown error occurred";
           res.status(500).json({
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
   getExercise: async (req : Request, res : Response) :Promise<void> =>{
    try {
      const { type,  keyword  = "", page = 1, limit = 10, sort = "desc" } : queryParams = req.query;

        const keywordStr = typeof keyword === "string" ? keyword : "";
        const typeStr = typeof type === "string" ? type : undefined;
        const sortStr = sort === "asc" ? "asc" : "desc";
        const pageNum = parseInt(typeof page === "string" ? page : "1", 10);
        const limitNum = parseInt(typeof limit === "string" ? limit : "10", 10);
        const skip = (pageNum - 1) * limitNum;
        const sortOption = sortStr === "asc" ? 1 : -1;

        const regex = new RegExp(keywordStr, "i");

          // Build query
        const query: Record<string, any> = {
          ...(typeStr && { exerciseType: typeStr }),
          ...(keywordStr && {
            $or: [
              { exerciseTitle: { $regex: regex } },
              { exerciseSubTitle: { $regex: regex } },
              { exerciseDescription: { $regex: regex } }
            ]
          })
        };

      //const skip = (parseInt(page) - 1) * parseInt(limit);
      //const sortOption = sort === 'asc' ? 1 : -1;

      const exercises : exercises[] = await  ExercisesModel.find(query).sort({ updatedAt: sortOption }).skip(skip).limit(limitNum);
       

      const total =  await ExercisesModel.countDocuments(query);

      if(exercises){
      const fhirBundle = convertExerciseToFHIR(exercises, {page: pageNum,  limit: limitNum, total, type: typeStr,keyword: keywordStr});
       res.status(200).json(fhirBundle);
      }

    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error occurred";
       res.status(500).json({
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