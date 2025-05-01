const VaccinationService = require('../services/ImmunizationService');
const helpers = require('../utils/helpers');
const { getCognitoUserId } = require('../utils/jwtUtils');
const  FHIRMapper  = require('../utils/ImmunizationMapper');
const { mongoose } = require('mongoose');

class ImmunizationController {
  static async handlecreateImmunization(req, res) {
    try {
      const rawData = req.body?.data ?? req.body;
      const fhirData = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
  
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
  
      const saved = await VaccinationService.saveFhirImmunization(
        fhirData,
        vaccineFileUrl,
        cognitoUserId
      );
  
      return res.status(200).json({
        status: 1,
        message: 'Vaccination record added successfully',
      });
    } catch (error) {
      return res.status(200).json({ status: 0, error: error.message });
    }
  }

  static async handleGetVaccination(req, res) {
    try {
      const userId = getCognitoUserId(req);
      const limit = parseInt(req.query.limit) || 10;
      const offset = parseInt(req.query.offset) || 0;
      const petId = req.query.petId;
  
      const results = await VaccinationService.getVaccinationsByUserId(userId, limit, offset, petId);
  
      if (results.length === 0) {
        return res.status(200).json({ status: 0, message: "No vaccination record found for this user" });
      }
  
      const fhirBundle = FHIRMapper.toFHIRBundle(results);
      return res.status(200).json({ status: 1, data: fhirBundle });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ status: 0, message: "Internal Server Error" });
    }
  }

  static async handleEditVaccination(req, res) {
    try {
      const fhirData = req.body.data;
      const id = req.query.recordId;
  
      let parsedData;
      try {
        parsedData = JSON.parse(fhirData);
      } catch (e) {
        return res.status(200).json({ status: 0, message: "Invalid FHIR JSON data" });
      }
  
      const fileArray = req.files?.files
        ? Array.isArray(req.files.files)
          ? req.files.files
          : [req.files.files]
        : [];
  
      let vaccineFileUrl = null;
  
      // Upload files if present
      if (fileArray.length > 0) {
        vaccineFileUrl = await helpers.uploadFiles(fileArray);
      }
  
      const updatedVaccination = await VaccinationService.updateVaccinationFromFHIR(
        id,
        vaccineFileUrl,
        parsedData
      );
      if (!updatedVaccination) {
        return res.status(200).json({ status: 0, message: "Vaccination record not found" });
      }
  
      const fhirResponse = VaccinationService.convertToFHIR(updatedVaccination);
  
      res.status(200).json({ status: 1, data: fhirResponse });
    } catch (error) {
      res.status(200).json({ status: 0, message: "Error updating vaccination record", error: error.message });
    }
  }

  static async handleDeleteVaccinationRecord(req, res) {
    try {
      const id = req.query.recordId;
      if (!mongoose.Types.ObjectId.isValid(id)) {
          return res.status(200).json({ status: 0, message: "Invalid Vaccination ID" });
      }
      const result = await VaccinationService.deleteVaccinationRecord(id);
      if (!result) {
        return res.status(200).json({ status: 0, message: "Vaccination record not found" });
      }
  
      if (result.deletedCount === 0) {
        return res.status(200).json({ status: 0, message: "could not be deleted" });
      }
  
      return res.status(200).json({ status: 1, message: "Vaccination record deleted successfully" });
    } catch (error) {
      console.error("Error while deleting vaccination record:", error.message);
      const status = error.message === "Invalid Vaccination ID" ? 400 : 500;
      return res.status(status).json({ status: 0, message: error.message });
    }
  }
  
   
  static async recentVaccinationRecord(req, res) {
    try {
      const userId = getCognitoUserId(req);
      const limit = parseInt(req.query.limit) || 10;
      const offset = parseInt(req.query.offset) || 0;
      const results = await VaccinationService.getRecentVaccinationsReocrds(userId, limit, offset);
  
      if (results.length === 0) {
        return res.status(200).json({ status: 0, message: "No vaccination record found for this user" });
      }
  
      const fhirBundle = FHIRMapper.toFHIRBundle(results);
      return res.status(200).json({ status: 1, data: fhirBundle });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ status: 0, message: "Internal Server Error" });
    }
  } 

}
module.exports = ImmunizationController;