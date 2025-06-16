import { Request, Response } from 'express';
import pet from '../models/Pets';
import { handleMultipleFileUpload, deleteFromS3 } from "../middlewares/upload";
import { getCognitoUserId } from '../middlewares/authMiddleware';
import type { pets} from "@yosemite-crew/types";
import { Types } from 'mongoose'; // for ObjectId validation
import { convertPetToFHIR, convertFHIRToPet } from "@yosemite-crew/fhir";


const baseUrl = process.env.BASE_URL || '';

const petController = {
  // add new pet
  addPet: async (req: Request, res: Response) : Promise<void>  => {
    try {
      const cognitoUserId = getCognitoUserId(req);

      const fhirData = req.body.data;

      const addPetData = convertFHIRToPet(JSON.parse(fhirData));

       let imageUrls: string[] = [];

      if (req.files && req.files.files) {
        const files = Array.isArray(req.files.files)
          ? req.files.files
          : [req.files.files]; // wrap single file into array

        const imageFiles = files.filter(file => file.mimetype && file.mimetype.startsWith("image/"));

        if (imageFiles.length > 0) {
          imageUrls = await handleMultipleFileUpload(imageFiles, 'Images');
        }
      }
      const petData = { ...addPetData, cognitoUserId, petImage: imageUrls };

      const dob = new Date(petData.petdateofBirth);
      const diff = Date.now() - dob.getTime();
      const ageDt = new Date(diff);
      petData.petAge = Math.abs(ageDt.getUTCFullYear() - 1970);

      const newPet = await pet.create(petData);

      if (newPet) {
        const fhirData = convertPetToFHIR(newPet, baseUrl);
         res.status(200).json({
          status: 1,
          message: 'Pet Added successfully',
          data: fhirData,
        });
      }

      res.status(400).json({ status: 0, message: 'Unable to add pet' });
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

  // Retrieve all pets added by the user
  getPet: async (req: Request, res: Response) : Promise<void> => {
    try {

      const cognitoUserId = getCognitoUserId(req);
      const limit = parseInt(req.query.limit as string) || 10;
      const offset = parseInt(req.query.offset as string) || 0;
      const pets : pets[]= await pet.find({ cognitoUserId }).skip(offset).limit(limit);

      if (!pets.length) {
         res.status(200).json({
          resourceType: 'Bundle',
          type: 'searchset',
          total: 0,
          entry: [],
          message: 'No pets found'
        });
      }

      const fhirPets = await Promise.all(
        pets.map(async (pet) => ({
          resource: convertPetToFHIR(pet, baseUrl)
        }))
      );

      res.status(200).json({
        resourceType: 'Bundle',
        type: 'searchset',
        total: fhirPets.length,
        entry: fhirPets
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error occurred";
      res.status(500).json({
        resourceType: 'OperationOutcome',
        issue: [{
          severity: 'error',
          code: 'exception',
          diagnostics: message
        }]
      });
    }
  },


  // Modifies pet information based on pet ID

  editPet: async (req: Request, res: Response) : Promise<void>  => {
    try {
      const fhirData = req.body.data;
      const id = req.query.Petid as string;

      // Validate MongoDB ObjectId
      if (!Types.ObjectId.isValid(id)) {
         res.status(400).json({
          resourceType: "OperationOutcome",
          issue: [{
            status: 0,
            severity: "error",
            code: "invalid",
            message: "Invalid Pet ID format",
          }]
        });
      }

      // Parse and validate FHIR input
      let parsedData;
      try {
        parsedData = JSON.parse(fhirData);
      } catch (error) {
         res.status(400).json({
          resourceType: 'OperationOutcome',
          issue: [{
            severity: 'error',
            code: 'exception',
            diagnostics: `Invalid FHIR JSON data: ${(error as Error).message}`
          }]
        });
      }

      const updatedPetData = convertFHIRToPet(parsedData);

      // Handle file uploads (optional)
      if (req.files && req.files.files) {
        const files = Array.isArray(req.files.files)
          ? req.files.files
          : [req.files.files]; // wrap single file into array

        const imageFiles = files.filter(file => file.mimetype && file.mimetype.startsWith("image/"));

        if (imageFiles.length > 0) {
          const imageUrls = await handleMultipleFileUpload(imageFiles, 'Images');
          updatedPetData.petImage = imageUrls;
        }
      }

      // Securely update the pet record
      const editPetData = await pet.findByIdAndUpdate(id, updatedPetData, { new: true });
      if (!editPetData) {
         res.status(404).json({
          resourceType: "OperationOutcome",
          issue: [{
            status: 0,
            severity: "error",
            code: "not-found",
            message: `No pet (Patient) found}`,
          }]
        });
      }

      const fhirFormattedResponse = convertPetToFHIR(editPetData, baseUrl);

      res.json({ status: 1, data: fhirFormattedResponse });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error occurred";
      res.status(500).json({
        resourceType: 'OperationOutcome',
        issue: [{
          severity: 'error',
          code: 'exception',
          diagnostics: message
        }]
      });
    }
  },



  // Remove a pet record from the database
  deletePet: async (req: Request, res: Response) : Promise<void> => {
    const petId = req.query.Petid as string;
    try {
      if (!Types.ObjectId.isValid(petId)) {
         res.status(200).json({
          resourceType: "OperationOutcome",
          issue: [{
            status: 0,
            severity: "error",
            code: "invalid",
            message: "Invalid Pet ID format",
          }]
        });
      }

      const objectId = new Types.ObjectId(petId);
      const data = await pet.find({ _id: objectId });
      if (data.length === 0) {
         res.status(200).json({
          resourceType: "OperationOutcome",
          issue: [{
            status: 0,
            severity: "error",
            code: "not-found",
            message: `No pet (Patient) found with ID ${petId}`,
          }]
        });
      }

      if (Array.isArray(data[0].petImage)) {
        for (const image of data[0].petImage) {
          if (typeof image === 'object' && image.url) {
            await deleteFromS3(image.url);
          }
        }
      }

      //const result = await PetService.deletePetById(petId);
      const result = await pet.findOneAndDelete({ _id: { $eq: petId } });

      if (!result) {
         res.status(200).json({
          resourceType: "OperationOutcome",
          issue: [{
            status: 0,
            severity: "error",
            code: "not-found",
            message: `No pet (Patient) found with ID ${petId}`,
          }]
        });
      }
      if(result){
        res.status(200).json({
          resourceType: "OperationOutcome",
          issue: [{
            status: 1,
            severity: "information",
            code: "informational",
            message: `Pet deleted successfully`,
          }]
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error occurred";
      res.status(500).json({
        resourceType: 'OperationOutcome',
        issue: [{
          severity: 'error',
          code: 'exception',
          diagnostics: message
        }]
      });
    }
  }

}

export default petController;