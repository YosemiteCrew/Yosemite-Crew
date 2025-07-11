import { Request, Response } from 'express';
const VetClinicService = require('../services/VetClinicService');
const { fhirOrganizationSchema } = require('../validators/fhirOrganizationValidator');
import { getCognitoUserId }  from  '../middlewares/authMiddleware';
const BreederService = require('../services/BreederService');
const GroomerService = require('../services/GroomerService');
const PetBoardingService = require('../services/PetBoardingService');

const detailsController = {

     vetClinic : async (req: Request, res :Response) : Promise<void> => {
      try {
        const fhirdata =req.body?.data;
        const getCognitoUser =  getCognitoUserId(req);
        // Validate input (FHIR format)
        let parsedData;
                try {
                parsedData = typeof fhirdata === 'string' ? JSON.parse(fhirdata) : fhirdata;
                } catch (err) {
                 res.status(400).json({
                    message: "Invalid JSON format",
                    error: err.message
                });
                }

        const validatedData = fhirOrganizationSchema.safeParse(parsedData);
  
        // Pass entire FHIR object to service
        const clinic = await VetClinicService.createClinic(validatedData,getCognitoUser);
        
        const fhirResponse = VetClinicService.toFhirOrganization(clinic);
        if(fhirResponse){
           res.status(201).json({
            status: 1,  
            message: 'Veterinary clinic details added successfully',
            vetclinic: fhirResponse
          });
        }
      } catch (error) {
        if (error.name === 'ZodError') {
           res.status(200).json({
            status: 0,
            message: 'Invalid FHIR Organization data',
            errors: error.errors
          });
        }
         res.status(500).json({ status: 0, message: 'Internal Server Error' });
      }
    },
  
     breeder : async (req: Request,res :Response) : Promise<void> => {
      try {
      const fhirdata =req.body?.data;
      const getCognitoUser =  getCognitoUserId(req);
      let parsedData;
      try {
      parsedData = typeof fhirdata === 'string' ? JSON.parse(fhirdata) : fhirdata;
      } catch (err) {
       res.status(400).json({
          message: "Invalid JSON format",
          error: err.message
      });
      }
      const validatedData = fhirOrganizationSchema.safeParse(parsedData);
      if (!validatedData.success) {
         res.status(400).json({
          message: "FHIR Validation Failed",
          errors: validatedData.error.issues
        });
      }
      const breederService = new BreederService();
      const result = await breederService.createFromFhirOrganization(validatedData.data, getCognitoUser);
      const fhirResponse = breederService.toFhirOrganizationBreeder(result);
      if(fhirResponse){
         res.status(200).json({
          status: 1,  
          message: 'Pet Breeder added successfully',
          vetBreeder: fhirResponse
        });
       }
      } catch (error) {
      if (error.name === 'ZodError') {
         res.status(200).json({
          status: 0,
          message: 'Invalid FHIR Organization data',
          errors: error.errors
        });
      }
       res.status(500).json({ status: 0, message: 'Internal Server Error' });
    } 
   },
   
    petGroomer : async (req: Request,res :Response) :Promise<void> => {
    try {
      const fhirdata =req.body?.data;
      const getCognitoUser =  getCognitoUserId(req);
      let parsedData;
      try {
      parsedData = typeof fhirdata === 'string' ? JSON.parse(fhirdata) : fhirdata;
      } catch (err) {
       res.status(400).json({
          message: "Invalid JSON format",
          error: err.message
      });
      }
      const validatedData = fhirOrganizationSchema.safeParse(parsedData);
      if (!validatedData.success) {
         res.status(400).json({
          message: "FHIR Validation Failed",
          errors: validatedData.error.issues
        });
      }
      const groomerService = new GroomerService();
      const result = await groomerService.createFromFhirOrganization(validatedData.data, getCognitoUser);
      const fhirResponse = groomerService.toFhirOrganizationGroomer(result);
      if(fhirResponse){ 
          res.status(201).json({
            status: 1,  
            message: 'Pet Groomer added successfully',
            vetBreeder: fhirResponse
          });
        }
      } catch (error) {
      if (error.name === 'ZodError') {
         res.status(200).json({
          status: 0,
          message: 'Invalid FHIR Organization data',
          errors: error.errors
        });
      }
       res.status(500).json({ status: 0, message: 'Internal Server Error' });
    } 
   
   },

    petBoarding : async (req: Request,res : Response) : Promise<void> => {
    try {
      const fhirdata =req.body?.data;
      const getCognitoUser =  getCognitoUserId(req);
      let parsedData;
      try {
      parsedData = typeof fhirdata === 'string' ? JSON.parse(fhirdata) : fhirdata;
      } catch (err) {
       res.status(400).json({
          message: "Invalid JSON format",
          error: err.message
      });
      }
      const validatedData = fhirOrganizationSchema.safeParse(parsedData);
      if (!validatedData.success) {
         res.status(400).json({
          message: "FHIR Validation Failed",
          errors: validatedData.error.issues
        });
      }
      const petboardingService = new PetBoardingService();
      const result = await petboardingService.createFromFhirOrganization(validatedData.data, getCognitoUser);
      const fhirResponse = petboardingService.toFhirOrganizationGroomer(result);
      if(fhirResponse){
        res.status(201).json({
          status: 1,  
          message: 'Pet Groomer added successfully',
          vetBreeder: fhirResponse
        });
      }
      } catch (error) {
      if (error.name === 'ZodError') {
         res.status(200).json({
          status: 0,
          message: 'Invalid FHIR Organization data',
          errors: error.errors
        });
      }
       res.status(500).json({ status: 0, message: 'Internal Server Error' });
    } 
   
   }

  }

  export default detailsController;



