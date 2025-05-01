const PetService = require('../services/PetService');
const FHIRMapper = require('../mappers/FHIRMapper');
const { getCognitoUserId } = require('../utils/jwtUtils');
const helpers = require('../utils/helpers');
const FHIRMapperService = require('../services/FHIRMapperService');
const { Types } = require('mongoose'); // for ObjectId validation

class PetController {

  // Logic to add a new pet entry
  static async handleAddPet(req, res) {
    try {
      const cognitoUserId = getCognitoUserId(req);
      const fhirData = req.body.data;
  
    const addPetData = await FHIRMapperService.convertFHIRToPet(JSON.parse(fhirData));
      
      const baseUrl = process.env.BASE_URL;
      let imageUrls = '';

      if (req.files && req.files.files) {
        const files = Array.isArray(req.files.files)
          ? req.files.files
          : [req.files.files]; // wrap single file into array

        const imageFiles = files.filter(file => file.mimetype && file.mimetype.startsWith("image/"));

        if (imageFiles.length > 0) {
          imageUrls = await PetService.uploadFiles(imageFiles);
        }
      }
      const petData = { ...addPetData, cognitoUserId, petImage: imageUrls };

      const newPet = await PetService.createPet(petData);

      if (newPet) {
        const fhirData = await FHIRMapper.convertPetToFHIR(newPet, baseUrl);
        return res.status(200).json({
          status: 1,
          message: 'Pet Added successfully',
          data: fhirData,
        });
      }

      res.status(400).json({ status: 0, message: 'Unable to add pet' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ status: 0, message: 'Internal Server Error' });
    }
  }

  // Retrieve all pets added by the user
  static async handleGetPet(req, res) {
    try {
      const baseUrl = process.env.BASE_URL;
      const cognitoUserId = getCognitoUserId(req);
      const { limit = 10, offset = 0 } = req.query;

      const pets = await PetService.getPetsByUser(cognitoUserId, limit, offset);
      if (!pets.length) {
        return res.status(200).json({
          resourceType: 'Bundle',
          type: 'searchset',
          total: 0,
          entry: [],
          message: 'No pets found'
        });
      }

      const fhirPets = await Promise.all(
        pets.map(async (pet) => ({
          resource: await FHIRMapper.convertPetToFHIR(pet, baseUrl)
        }))
      );
 
      res.status(200).json({
        resourceType: 'Bundle',
        type: 'searchset',
        total: fhirPets.length,
        entry: fhirPets
      });
    } catch (error) {
      res.status(500).json({
        resourceType: 'OperationOutcome',
        issue: [{
          severity: 'error',
          code: 'exception',
          diagnostics: error.message
        }]
      });
    }
  }

// Modifies pet information based on pet ID

static async handleEditPet(req, res) {
  try {
    const fhirData = req.body.data;
    const id = req.query.Petid;

    // Validate MongoDB ObjectId
    if (!Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid Pet ID format" });
    }

    // Parse and validate FHIR input
    let parsedData;
    try {
      parsedData = JSON.parse(fhirData);
    } catch (e) {
      return res.status(400).json({ message: "Invalid FHIR JSON data" });
    }

    const updatedPetData = await FHIRMapperService.convertFHIRToPet(parsedData);

    // Handle file uploads (optional)
    if (req.files && req.files.files) {
      const files = Array.isArray(req.files.files)
        ? req.files.files
        : [req.files.files]; // wrap single file into array
    
      const imageFiles = files.filter(file => file.mimetype && file.mimetype.startsWith("image/"));
    
      if (imageFiles.length > 0) {
        const imageUrls = await PetService.uploadFiles(imageFiles);
        updatedPetData.petImage = imageUrls;
      }
    }

    // Securely update the pet record
    const editPetData = await PetService.updatePetById(id, updatedPetData);
    if (!editPetData) {
      return res.status(404).json({ message: "Pet record not found" });
    }

    const fhirFormattedResponse = await FHIRMapper.convertPetToFHIR(editPetData, process.env.BASE_URL);

    res.json({ status: 1, data: fhirFormattedResponse });
  } catch (error) {
    console.error("Update error:", error);
    res.status(500).json({
      message: "Error updating pet record",
      error: error.message || error.toString()
    });
  }
}



// Remove a pet record from the database
static async handleDeletePet(req, res) {
  const petId = req.query.Petid;
  try {
    if (!Types.ObjectId.isValid(petId)) {
      await helpers.operationOutcome(0, "error", "not-found", `Invalid Pet ID format`)
    }
    const result = await PetService.deletePetById(petId);

    if (result.deletedCount === 0) {
      return res.status(200).json(
        await helpers.operationOutcome(0, "error", "not-found", `No pet (Patient) found with ID ${petId}`)
      );
    }
    return res.status(200).json(
        await helpers.operationOutcome(1, "information", "informational", "Pet deleted successfully")
    );
  } catch (error) {
    return res.status(500).json(
       await helpers.operationOutcome(0, "error", "exception", error.message)
    );
  }
}

}



module.exports = PetController;