import { Request, Response } from 'express';
import mongoose from 'mongoose';
const FHIRParser = require('../utils/FHIRParser');
const helpers = require('../utils/helpers');
const DiabetesService = require('../services/DiabetesService');

import { getCognitoUserId }  from  '../middlewares/authMiddleware';


const diabetesController = {

    diabetesRecords: async(req :Request , res : Response) : Promise<void>  => {
    try {
      const fhirObservation = req.body?.data;
     
      const parsedData = FHIRParser.parseDiabetesObservation(JSON.parse(fhirObservation));

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

      const newRecord = await DiabetesService.createDiabetesRecord(
        parsedData,
        vaccineFileUrl,
        cognitoUserId
      );
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
    } catch (error) {
        res.status(200).json({ status: 1,message: 'Internal server error' });
    }
  },


  getDiabetesLogs: async(req : Request, res : Response) : Promise<void> => {
    try {
      const cognitoUserId = getCognitoUserId(req);
      const limit = parseInt(req.query.limit) || 10;
      const offset = parseInt(req.query.offset) || 0;

      const records = await DiabetesService.getDiabetesLogs(cognitoUserId,limit,offset);
  
      if (records.length === 0) {
         res.status(200).json({status: 1, entry: [], message: "No Diabetes logs found" });
      }
  
      const fhirObservations = records.map(record =>
        FHIRParser.toFHIRObservation(record)
      );
  
      const bundle = {
        resourceType: "Bundle",
        type: "collection",
        entry: fhirObservations.map(obs => ({ resource: obs }))
      };
  
      res.json(bundle);
    } catch (err) {
      res.status(200).json({ message: "Internal server error" });
    }
  },

   deleteDiabetesLog : async (req : Request, res : Response): Promise<void>  => {
    try {
      const id = req.query.recordId;
  
      if (!mongoose.Types.ObjectId.isValid(id)) {
         res.status(200).json({ status: 0, message: "Invalid Diabetes Log ID" });
      }

      const result = await DiabetesService.deleteDiabetesLogRecord(id);
  
      if (!result) {
         res.status(200).json({ status: 0, message: "Diabetes record not found" });
      }
  
      if (result.deletedCount === 0) {
         res.status(200).json({ status: 0, message: "Diabetes record could not be deleted" });
      }
  
       res.status(200).json({ status: 1, message: "Diabetes record deleted successfully" });
  
    } catch (error) {
      console.error("Error while deleting diabetes record:", error.message);
       res.status(200).json({ status: 0, message: error.message });
    }
  }
  
}

export default diabetesController;