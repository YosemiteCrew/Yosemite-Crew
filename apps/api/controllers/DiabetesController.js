const FHIRParser = require('../utils/FHIRParser');
const helpers = require('../utils/helpers');
const DiabetesService = require('../services/DiabetesService');
const { getCognitoUserId } = require('../utils/jwtUtils');
const { mongoose } = require('mongoose');

class DiabetesController {
  static async handleDiabetesRecords(req, res) {
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
       return res.status(200).json({  
        status: 1,
        message: 'Diabetes Record added successfully',
      });
      }else{
        return res.status(200).json({  
          status: 0,
          message: 'Error while adding Diabetes Record',
        });
      }
    } catch (error) {
      res.status(200).json({ status: 1,message: 'Internal server error' });
    }
  }

  static async handleGetDiabetesLogs(req, res) {
    try {
      const cognitoUserId = getCognitoUserId(req);
      const limit = parseInt(req.query.limit) || 10;
      const offset = parseInt(req.query.offset) || 0;
      const records = await DiabetesService.getDiabetesLogs(cognitoUserId,limit,offset);
  
      if (records.length === 0) {
        return res.status(404).json({ message: "No Diabetes logs found" });
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
  }
  static async handleDeleteDiabetesLog(req, res) {
    try {
      const id = req.query.recordId;
  
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(200).json({ status: 0, message: "Invalid Diabetes Log ID" });
      }

      const result = await DiabetesService.deleteDiabetesLogRecord(id);
  
      if (!result) {
        return res.status(200).json({ status: 0, message: "Diabetes record not found" });
      }
  
      if (result.deletedCount === 0) {
        return res.status(200).json({ status: 0, message: "Diabetes record could not be deleted" });
      }
  
      return res.status(200).json({ status: 1, message: "Diabetes record deleted successfully" });
  
    } catch (error) {
      console.error("Error while deleting diabetes record:", error.message);
      return res.status(200).json({ status: 0, message: error.message });
    }
  }
  

}
module.exports = DiabetesController;