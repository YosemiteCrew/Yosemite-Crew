const { petDuties } = require('../models/PetDuties');
const { getCognitoUserId } = require('../utils/jwtUtils');
const RelatedPersonService = require('../services/RelatedPersonService');
const helpers = require('../utils/helpers');
const mongoose = require('mongoose');
const PetDutiesService = require('../services/PetDutiesService');


class SharedDutiesController{


  static async handleSavePetCoOwner(req, res) {
    try {
      const fhirDataRaw = req.body?.data;
      const fhirData = JSON.parse(fhirDataRaw);

      const fileArray = req.files?.files
        ? Array.isArray(req.files.files)
          ? req.files.files
          : [req.files.files]
        : [];

      // You must modify your `uploadFiles()` to return full metadata if it doesn't already
      const fileUrls = fileArray.length > 0
        ? await helpers.uploadFiles(fileArray) // expected to return [{url, originalname, mimetype}]
        : [];

      const cognitoUserId = getCognitoUserId(req);

      const result = await RelatedPersonService.createPetCoOwner(
        fhirData,
        fileUrls,
        cognitoUserId
      );

      if (result) {
        return res.status(200).json({
          status: 1,
          message: 'Pet Co-owner saved successfully',
        });
      } else {
        return res.status(200).json({
          status: 0,
          message: 'Failed to save Pet Co-owner',
        });
      }
    } catch (error) {
      console.error(error);
      return res.status(500).json({
        status: 0,
        message: 'Internal server error',
      });
    }
  }

  static async handleSaveSharedDuties(req, res) {
    try {
      const fhirData = req.body.data;
      if (!fhirData) return res.status(400).json({ message: "Missing FHIR data in request body." });
      const userId = getCognitoUserId(req);
      // Save the observation data to MongoDB
      const savedDuty = await PetDutiesService.saveFromFhirObservation(JSON.parse(fhirData), userId);
  
      return res.status(200).json({
        status: 1,
        message: 'Pet duty added successfully.',
      });
  
    } catch (error) {
      console.error("Error saving shared pet duty:", error);
      return res.status(500).json({ message: 'Internal server error', error: error.message });
    }
  }

static async handleEditSharedDuties(req, res) {
  try {
    const fhirData = req.body?.data;
    const id = req.query.taskId;
    if (!mongoose.Types.ObjectId.isValid(id)) {
          throw new Error('Invalid ID format');
    }
    const updatedFhir = await PetDutiesService.updateDutyByIdFromFhir(id, JSON.parse(fhirData));

      if (!updatedFhir) {
        return res.status(404).json({ message: "Shared duty task not found" });
      }

      return res.status(200).json(updatedFhir);
    } catch (error) {
      console.error("Error in handleEditSharedDuties:", error.message);
      return res.status(500).json({
        message: "Error updating shared duty record",
        error: error.message
      });
    }
}


static async handleGetSharedDuties(req, res) {
  try {
    const userId = getCognitoUserId(req);
    if (!userId) {
      return res.status(400).json({ message: "userId is required." });
    }

    const observations = await PetDutiesService.getDutiesByUserId(userId);

    if (!observations.length) {
      return res.status(404).json({ message: "No Shared pet duty record found for this user." });
    }

    res.status(200).json(observations);
  } catch (error) {
    console.error("Error in getSharedDuties:", error.message);
    res.status(500).json({ message: "Internal server error", error: error.message });
  }
}

 static async handledeleteSharedDuties(req, res) {
    try {
      const taskId = req.query.taskId;  // Get feedback ID from URL params

      if (!mongoose.Types.ObjectId.isValid(taskId)) {
        return res.status(200).json({ status: 0, message: "Invalid Task ID" });
      }
      const TaskToDelete = await PetDutiesService.deletePetDuties(taskId);
      if (!TaskToDelete) {
        return res.status(200).json(
          await helpers.operationOutcome(0, "error", "not-found", `No task found with ID ${taskId}`)
        );
      }
      if(TaskToDelete){
      return res.status(200).json({
        status: 1,
        message: "Pet Duty deleted successfully",
      });
     }
    } catch (error) {
      console.error("Error while deleting feedback:", error);
      return res.status(200).json({
        status: 0,
        message: error.message || "An error occurred while deleting feedback",
      });
    }
  }

  // Remove a pet Co Owner record from the database
  static async handleDeletePetCoOwner(req, res) {
    const CoOwnerId = req.query.CoOwnerId;
    try {
      if (!mongoose.Types.ObjectId.isValid(CoOwnerId)) {
        await helpers.operationOutcome(0, "error", "not-found", `Invalid Co Owner ID format`)
      }
      const result = await RelatedPersonService.handleDeletePetCoOwner(CoOwnerId);
  
      if (!result) {
        return res.status(200).json(
          await helpers.operationOutcome(0, "error", "not-found", `No Co owner found with ID ${CoOwnerId}`)
        );
      }
  
      if (result.deletedCount === 0) {
        return res.status(200).json(
          await helpers.operationOutcome(0, "error", "not-found", `No Co owner found with ID ${CoOwnerId}`)
        );
      }
      return res.status(200).json(
          await helpers.operationOutcome(1, "information", "informational", "Co owner deleted successfully")
      );
    } catch (error) {
      return res.status(500).json(
         await helpers.operationOutcome(0, "error", "exception", error.message)
      );
    }
  }
  
}
module.exports = SharedDutiesController