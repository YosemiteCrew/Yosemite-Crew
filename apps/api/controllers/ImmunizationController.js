const VaccinationService = require('../services/ImmunizationService');
const helpers = require('../utils/helpers');
const { getCognitoUserId } = require('../utils/jwtUtils');
const  FHIRMapper  = require('../utils/ImmunizationMapper');

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
        : null;
  
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
      const results = await VaccinationService.getVaccinationsByUserId(userId);
      if (results.length === 0) {
        return res.status(200).json({ status: 0, message: "No vaccination record found for this user" });
      }
      const fhirBundle = FHIRMapper.toFHIRBundle(results);
       return  res.status(200).json({status: 1, data: fhirBundle});
    } catch (err) {
      return res.status(200).json({ status: 0, message: "Internal Server Error" });
    }
  }

  static async handleEditVaccination(req, res) {
    try {
      const fhirData = req.body.data;
      const id = req.params.recordId;
  
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
  

}
module.exports = ImmunizationController;