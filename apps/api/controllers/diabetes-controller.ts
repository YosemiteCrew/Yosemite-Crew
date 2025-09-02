import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { parseDiabetesObservation, toFHIRObservation} from '@yosemite-crew/fhir'; // ✅ right
import helpers from '../utils/helpers';
import  diabetesRecords  from '../models/Records';
import { getCognitoUserId }  from  '../middlewares/authMiddleware';
import type { DiabetesRecords } from "@yosemite-crew/types";



const diabetesController = {

    diabetesRecords: async(req :Request , res : Response) : Promise<void>  => {
    try {
      const body = req.body as { data?: string };
      const fhirObservation = body?.data;
     
      if (!fhirObservation) {
        res.status(400).json({ status: 0, message: 'Missing diabetes observation data' });
        return;
      }
      
      let parsedData: Record<string, unknown> | undefined;
      try {
        const observationObj = JSON.parse(fhirObservation) as unknown;
        if (observationObj && typeof observationObj === 'object' && !('message' in observationObj)) {
          if (typeof observationObj === 'object' && observationObj !== null) {
            if (typeof parseDiabetesObservation === 'function') {
              const result = (parseDiabetesObservation as (input: Record<string, unknown>) => unknown)(observationObj as Record<string, unknown>);
              if (result && typeof result === 'object') {
                parsedData = result as Record<string, unknown>;
              } else {
                res.status(200).json({ status: 0, message: 'Parsed data is invalid' });
                return;
              }
            } else {
              res.status(200).json({ status: 0, message: 'Internal server error: parser not available' });
              return;
            }
          } else {
            res.status(200).json({ status: 0, message: 'Invalid diabetes observation data format' });
            return;
          }
        } else {
          res.status(200).json({ status: 0, message: 'Invalid diabetes observation data format' });
          return;
        }
      } catch {
        res.status(200).json({ status: 0, message: 'Invalid diabetes observation data format' });
        return;
      }
     
      const fileArray = req.files?.files
        ? Array.isArray(req.files.files)
          ? req.files.files
          : [req.files.files]
        : [];
      
      // Upload files if present
      const vaccineFileUrl = fileArray.length > 0
        ? await helpers.uploadFiles(fileArray)
        : [];
       
      const cognitoUserId = getCognitoUserId(req);
     const recordPayload = {
      ...parsedData, // flatten it here
      userId: cognitoUserId, // rename
      ...(vaccineFileUrl.length > 0 && { bodyCondition: vaccineFileUrl })
    };
      const newRecord = await diabetesRecords.create(recordPayload);
    
      if(newRecord){
        res.status(200).json({  
        status: 1,
        message: 'Diabetes Record added successfully',
      });
      }else{
         res.status(200).json({  
          status: 0,
          message: 'Error while adding Diabetes Record',
        });
      }
    } catch {
        res.status(200).json({ status: 0,message: 'Internal server error' });
    }
  },


  getDiabetesLogs: async(req : Request, res : Response) : Promise<void> => {
    try {
      const cognitoUserId = getCognitoUserId(req);
      const limit = parseInt(req.query.limit as string, 10) || 10;
      const offset = parseInt(req.query.offset as string, 10) || 0;
      if (isNaN(limit) || isNaN(offset) || limit <= 0 || offset < 0) {
        res.status(200).json({ status: 0, message: "Invalid limit or offset" });
        return;
      }
      const records =  await diabetesRecords.find({ userId : {$eq: cognitoUserId }}).skip(offset)
        .limit(limit).lean<DiabetesRecords[]>();;
  
      if (records.length === 0) {
         res.status(200).json({status: 1, entry: [], message: "No Diabetes logs found" });
         return
      }
  
      const fhirObservations = records.map(record =>
        (typeof toFHIRObservation === 'function'
          ? (toFHIRObservation as (input: DiabetesRecords) => unknown)(record)
          : {}) as Record<string, unknown>
      );

      const bundle = {
        message:"Diabetes logs found successfully!",
        status:1,
        resourceType: "Bundle",
        type: "collection",
        entry: fhirObservations.map((obs: Record<string, unknown>) => ({ resource: obs }))
      };
  
      res.json(bundle);
    } catch {
      res.status(200).json({ message: "Internal server error" });
    }
  },

   deleteDiabetesLog : async (req : Request, res : Response): Promise<void>  => {
    try {
      const id = req.query.recordId;
  
      if (!mongoose.Types.ObjectId.isValid(id as string)) {
         res.status(200).json({ status: 0, message: "Invalid Diabetes Log ID" });
         return;
      }
        const objectId = new mongoose.Types.ObjectId(id as string); 
        const data = await diabetesRecords.find({ _id: objectId });
        if (data.length === 0) {
          res.status(200).json({ status: 0, message: "Diabetes record not found" });
          return;
        }
        if (Array.isArray(data[0].bodyCondition) && data[0].bodyCondition.length > 0) {
          const bodyCondition = data[0].bodyCondition;
      
          for (const condition of bodyCondition) {
            if (condition.url) {
              await helpers.deleteFiles(condition.url);
            }
          }
        }
        const result =  await diabetesRecords.deleteOne({ _id: objectId });
       if (!result || result.deletedCount === 0) {
         res.status(200).json({ status: 0, message: "Diabetes record not found or could not be deleted" });
         return;
       }

       res.status(200).json({ status: 1, message: "Diabetes record deleted successfully" });

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'An unknown error occurred';
      console.error("Error while deleting diabetes record:", errorMsg);
      res.status(200).json({ status: 0, message: errorMsg });
    }
  }
  
}

export default diabetesController;