const VetClinicService = require('../services/VetClinicService');
const { fhirOrganizationSchema } = require('../validators/fhirOrganizationValidator');
const { getCognitoUserId } = require('../utils/jwtUtils');
const BreederService = require('../services/BreederService');
const GroomerService = require('../services/GroomerService');
const PetBoardingService = require('../services/PetBoardingService');

class detailsController {
    async handleVetClinic(req, res) {
      try {
        const fhirdata =req.body?.data;
        const getCognitoUser =  getCognitoUserId(req);
        // Validate input (FHIR format)
        let parsedData;
                try {
                parsedData = typeof fhirdata === 'string' ? JSON.parse(fhirdata) : fhirdata;
                } catch (err) {
                return res.status(400).json({
                    message: "Invalid JSON format",
                    error: err.message
                });
                }

        const validatedData = fhirOrganizationSchema.safeParse(parsedData);
  
        // Pass entire FHIR object to service
        const clinic = await VetClinicService.createClinic(validatedData,getCognitoUser);
        
        const fhirResponse = VetClinicService.toFhirOrganization(clinic);
       
        return res.status(201).json({
          status: 1,  
          message: 'Veterinary clinic details added successfully',
          vetclinic: fhirResponse
        });
      } catch (error) {
        if (error.name === 'ZodError') {
          return res.status(200).json({
            status: 0,
            message: 'Invalid FHIR Organization data',
            errors: error.errors
          });
        }
        return res.status(500).json({ status: 0, message: 'Internal Server Error' });
      }
    }
  
    async handleBreeder(req,res){
      try {
      const fhirdata =req.body?.data;
      const getCognitoUser =  getCognitoUserId(req);
      let parsedData;
      try {
      parsedData = typeof fhirdata === 'string' ? JSON.parse(fhirdata) : fhirdata;
      } catch (err) {
      return res.status(400).json({
          message: "Invalid JSON format",
          error: err.message
      });
      }
      const validatedData = fhirOrganizationSchema.safeParse(parsedData);
      if (!validatedData.success) {
        return res.status(400).json({
          message: "FHIR Validation Failed",
          errors: validatedData.error.issues
        });
      }
      const breederService = new BreederService();
      const result = await breederService.createFromFhirOrganization(validatedData.data, getCognitoUser);
      const fhirResponse = breederService.toFhirOrganizationBreeder(result);
      return res.status(200).json({
        status: 1,  
        message: 'Pet Breeder added successfully',
        vetBreeder: fhirResponse
      });
      } catch (error) {
      if (error.name === 'ZodError') {
        return res.status(200).json({
          status: 0,
          message: 'Invalid FHIR Organization data',
          errors: error.errors
        });
      }
      return res.status(500).json({ status: 0, message: 'Internal Server Error' });
    } 
   }
   
   async handlePetGroomer(req,res){
    try {
      const fhirdata =req.body?.data;
      const getCognitoUser =  getCognitoUserId(req);
      let parsedData;
      try {
      parsedData = typeof fhirdata === 'string' ? JSON.parse(fhirdata) : fhirdata;
      } catch (err) {
      return res.status(400).json({
          message: "Invalid JSON format",
          error: err.message
      });
      }
      const validatedData = fhirOrganizationSchema.safeParse(parsedData);
      if (!validatedData.success) {
        return res.status(400).json({
          message: "FHIR Validation Failed",
          errors: validatedData.error.issues
        });
      }
      const groomerService = new GroomerService();
      const result = await groomerService.createFromFhirOrganization(validatedData.data, getCognitoUser);
      const fhirResponse = groomerService.toFhirOrganizationGroomer(result);
      return res.status(201).json({
        status: 1,  
        message: 'Pet Groomer added successfully',
        vetBreeder: fhirResponse
      });
      } catch (error) {
      if (error.name === 'ZodError') {
        return res.status(200).json({
          status: 0,
          message: 'Invalid FHIR Organization data',
          errors: error.errors
        });
      }
      return res.status(500).json({ status: 0, message: 'Internal Server Error' });
    } 
   
   }

   async handlePetBoarding(req,res){
    try {
      const fhirdata =req.body?.data;
      const getCognitoUser =  getCognitoUserId(req);
      let parsedData;
      try {
      parsedData = typeof fhirdata === 'string' ? JSON.parse(fhirdata) : fhirdata;
      } catch (err) {
      return res.status(400).json({
          message: "Invalid JSON format",
          error: err.message
      });
      }
      const validatedData = fhirOrganizationSchema.safeParse(parsedData);
      if (!validatedData.success) {
        return res.status(400).json({
          message: "FHIR Validation Failed",
          errors: validatedData.error.issues
        });
      }
      const petboardingService = new PetBoardingService();
      const result = await petboardingService.createFromFhirOrganization(validatedData.data, getCognitoUser);
      const fhirResponse = petboardingService.toFhirOrganizationGroomer(result);
      return res.status(201).json({
        status: 1,  
        message: 'Pet Groomer added successfully',
        vetBreeder: fhirResponse
      });
      } catch (error) {
      if (error.name === 'ZodError') {
        return res.status(200).json({
          status: 0,
          message: 'Invalid FHIR Organization data',
          errors: error.errors
        });
      }
      return res.status(500).json({ status: 0, message: 'Internal Server Error' });
    } 
   
   }

  }
  
  module.exports = new detailsController();



