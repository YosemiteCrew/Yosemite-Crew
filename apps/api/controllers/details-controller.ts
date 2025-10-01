import { Request, Response } from 'express';
import logger from '../utils/logger';
import { ZodError } from 'zod';
import { FhirOrganization, fhirOrganizationSchema, toFhirOrganizationBreeder, toFhirOrganizationGroomer, toFhirOrganizationBoarding, convertToFhirSummary } from '@yosemite-crew/fhir';

import { getCognitoUserId } from '../middlewares/authMiddleware';

import VetClinic, { VetClinicDocument } from '../models/vet-clinic';
import BreederDetails, { BreederDocument } from '../models/breeder-details';
import PetGroomerModel, { PetGroomerDocument } from '../models/pet-groomer';
import PetBoardingModel, { PetBoardingDocument } from '../models/pet-boarding';
import { IVetClinic, PetBoarding, PetGroomer, breeder } from '@yosemite-crew/types';
import mongoose from 'mongoose';
import pets from '../models/pet.model';


function toFhirOrganization(clinic: VetClinicDocument): FhirOrganization {
  return {
    resourceType: "Organization",
    id: clinic._id.toString(),
    name: clinic.clinicName || '',
    telecom: [
      clinic.telephone ? { system: "phone", value: clinic.telephone } : null,
      clinic.emailAddess ? { system: "email", value: clinic.emailAddess } : null,
      clinic.website ? { system: "url", value: clinic.website } : null
    ].filter(Boolean) as FhirOrganization['telecom'],
    address: [
      {
        line: clinic.clinicAddress ? [clinic.clinicAddress] : [],
        city: clinic.city || '',
        postalCode: clinic.zipCode || '',
        country: clinic.country || ''
      }
    ],
    contact: clinic.vetName
      ? [
        {
          name: { text: clinic.vetName },
          purpose: {
            coding: [
              {
                system: "http://terminology.hl7.org/CodeSystem/contactentity-type",
                code: "ADMIN",
                display: "Administrative"
              }
            ]
          },
          telecom: [
            ...(clinic.telephone ? [{ system: "phone" as const, value: clinic.telephone }] : []),
            ...(clinic.emailAddess ? [{ system: "email" as const, value: clinic.emailAddess }] : [])
          ]
        }
      ]
      : []
  };
}

const detailsController = {

  extractTelecomValue(
    telecomArray: { system: string; value: string }[] = [],
    systemType: string
  ): string {
    return telecomArray.find((t) => t.system === systemType)?.value || '';
  },

  vetClinic: async (req: Request, res: Response): Promise<void> => {
    try {
      const body: unknown = req.body;
      const fhirdata = (typeof body === 'object' && body !== null && 'data' in body)
        ? (body as { data?: unknown }).data
        : undefined;
      const userId = getCognitoUserId(req);

      let parsedData: unknown;
      try {
        parsedData = typeof fhirdata === 'string' ? JSON.parse(fhirdata) : fhirdata;
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        res.status(400).json({
          message: "Invalid JSON format",
          error: errorMessage,
        });
        return;
      }
      const validatedData = fhirOrganizationSchema.safeParse(parsedData);

      if (!validatedData.success) {
        res.status(400).json({
          status: 0,
          message: "FHIR Validation Failed",
          errors: validatedData.error.issues
        });
        return;
      }

      // Typed usage
      const organization: FhirOrganization = validatedData.data;
      const clinicData: IVetClinic = {
        userId,
        petId: organization.petId,
        clinicName: organization.name,
        vetName: organization.contact?.[0]?.name?.text || '',
        clinicAddress: organization.address?.[0]?.line?.[0] || '',
        city: organization.address?.[0]?.city || '',
        country: organization.address?.[0]?.country || '',
        zipCode: organization.address?.[0]?.postalCode || '',
        telephone: organization.telecom?.find((t) => t.system === 'phone')?.value || '',
        emailAddess: organization.telecom?.find((t) => t.system === 'email')?.value || '',
        website: organization.telecom?.find((t) => t.system === 'url')?.value || ''
      };

      const clinic = await VetClinic.create(clinicData);
      if (!clinic) {
        res.status(200).json({ status: 0, message: 'Failed to add veterinary clinic' });
        return;
      }
      // Assuming VetClinicService is imported and instantiated if needed
      // If VetClinicService is a class, instantiate it: const vetClinicService = new VetClinicService();
      // Otherwise, if it's static, call directly as below:

      await pets.findOneAndUpdate(
        { _id: clinic.petId },
        { $set: { "summary.vetStatus": "completed" } },
      );

      const fhirResponse = toFhirOrganization(clinic); // Fully typed FhirOrganization

      res.status(201).json({
        status: 1,
        message: 'Veterinary clinic details added successfully',
        vetclinic: fhirResponse // or use fhirResponse if needed
      });

    } catch (error: unknown) {
      if (error instanceof ZodError) {
        res.status(200).json({
          status: 0,
          message: 'Invalid FHIR Organization data',
          errors: error.errors
        });
        return;
      }

      res.status(200).json({ status: 0, message: 'Internal Server Error' });
    }
  },
  
  getVetClinicDetails: async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = getCognitoUserId(req)
      if (!userId) {
        res.status(200).json({ message: 'User ID is missing', })
        return
      }
      const petId = req.query.petId;

      if (typeof petId !== "string" || !mongoose.Types.ObjectId.isValid(petId)) {
        res.status(200).json({
          status: 0,
          message: "Invalid or missing pet Id",
        });
        return;
      }
      
      const vetClinicsDetail: VetClinicDocument[] | null = await VetClinic.find({ userId: userId, petId: petId })
      if (!vetClinicsDetail.length) {
        res.status(200).json({ message: 'No Vet Founded' })
      }
      const entries = vetClinicsDetail.map((item) => toFhirOrganization(item))
      res.status(200).json({
        data: entries
      })
    }
    catch (error) {
      const message = error instanceof Error ? error.message : 'An Error occurred'
      res.status(200).json({ status: 0, message: message })
    }
  },

  searchVet: async (req: Request, res: Response): Promise<void> => {
    try {
      const { search } = req.query as { search: string };

      if (!search) {
        res.status(200).json({ status: 0, message: 'Search term is required' });
        return;
      }

      const vets = await VetClinic.find({
        $or: [
          { vetName: { $regex: search, $options: 'i' } },   // case-insensitive partial match
          { emailAddess: { $regex: search, $options: 'i' } }
        ]
      });

      if (!vets.length) {
        res.status(200).json({ status: 0, message: 'No vet clinic found' });
        return;
      }

      res.status(200).json({
        status: 1,
        data: vets,
        message: 'Vet clinic(s) found successfully'
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'An internal server error occurred';
      res.status(200).json({ status: 0, message });
    }
  },

  breeder: async (req: Request, res: Response): Promise<void> => {
    try {
      const body: unknown = req.body;
      const fhirdata = (typeof body === 'object' && body !== null && 'data' in body)
        ? (body as { data?: unknown }).data
        : undefined;
      const userId = getCognitoUserId(req);

      let parsedData: unknown;
      try {
        parsedData = typeof fhirdata === 'string' ? JSON.parse(fhirdata) : fhirdata;
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        res.status(400).json({
          message: "Invalid JSON format",
          error: errorMessage
        });
        return;
      }

      const validatedData = fhirOrganizationSchema.safeParse(parsedData);
      if (!validatedData.success) {
        res.status(400).json({
          message: "FHIR Validation Failed",
          errors: validatedData.error.issues
        });
        return;
      }

      const breederData: breeder = {
        userId: userId,
        breederName: validatedData.data.name,
        breederAddress: validatedData.data.address?.[0]?.line?.[0] || '',
        city: validatedData.data.address?.[0]?.city || '',
        country: validatedData.data.address?.[0]?.country || '',
        zipCode: validatedData.data.address?.[0]?.postalCode || '',
        telephone: detailsController.extractTelecomValue(validatedData.data.telecom ?? [], 'phone'),
        emailAddress: detailsController.extractTelecomValue(validatedData.data.telecom ?? [], 'email'),
        website: detailsController.extractTelecomValue(validatedData.data.telecom ?? [], 'url'),
        petId: new mongoose.Types.ObjectId(validatedData?.data.subject?.reference.split('/')[1]),
      };

      const result: breeder = await BreederDetails.create(breederData);
      await pets.findOneAndUpdate(
        { _id: result.petId },
        { $set: { "summary.breederStatus": "completed" } },
      );
      const fhirResponse = toFhirOrganizationBreeder(result);

      res.status(200).json({
        status: 1,
        message: 'Pet Breeder added successfully',
        vetBreeder: fhirResponse
      });


    } catch (error: unknown) {
      logger.error('error:', error)
      if (error instanceof ZodError) {
        res.status(200).json({
          status: 0,
          message: 'Invalid FHIR Organization data',
          errors: error.errors
        });
        return;
      }
      res.status(200).json({ status: 0, message: 'Internal Server Error' });
    }
  },

  getbreederDetails: async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = getCognitoUserId(req)
      if (!userId) {
        res.status(200).json({ message: 'User ID is missing', })
        return
      }
      const petId = req.query.petId;

      if (typeof petId !== "string" || !mongoose.Types.ObjectId.isValid(petId)) {
        res.status(200).json({
          status: 0,
          message: "Invalid or missing pet Id",
        });
        return;
      }
      const breederDetail: BreederDocument[] | null = await BreederDetails.find({ userId: userId, petId: petId })
      if (!breederDetail.length) {
        res.status(200).json({ message: 'No Vet Founded' })
      }
      const entries = breederDetail.map((item) => toFhirOrganizationBreeder(item))
      res.status(200).json({
        data: entries
      })
    }
    catch (error) {
      const message = error instanceof Error ? error.message : 'An Error occurred'
      res.status(200).json({ status: 0, message: message })
    }
  },

  petGroomer: async (req: Request, res: Response): Promise<void> => {
    try {
      const body: unknown = req.body;
      const fhirdata = (typeof body === 'object' && body !== null && 'data' in body)
        ? (body as { data?: unknown }).data
        : undefined;
      const userId = getCognitoUserId(req);
      let parsedData: unknown;
      try {
        parsedData = typeof fhirdata === 'string' ? JSON.parse(fhirdata) : fhirdata;
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        res.status(400).json({
          message: "Invalid JSON format",
          error: errorMessage
        });
        return;
      }

      const validatedData = fhirOrganizationSchema.safeParse(parsedData);

      if (!validatedData.success) {
        res.status(400).json({
          message: "FHIR Validation Failed",
          errors: validatedData.error.issues
        });
        return;
      }

      const groomerData: PetGroomer = {
        userId: userId,
        groomerName: validatedData.data.name,
        groomerAddress: validatedData.data.address?.[0]?.line?.[0] || '',
        city: validatedData.data.address?.[0]?.city || '',
        country: validatedData.data.address?.[0]?.country || '',
        zipCode: validatedData.data.address?.[0]?.postalCode || '',
        telephone: detailsController.extractTelecomValue(validatedData.data.telecom, 'phone'),
        emailAddress: detailsController.extractTelecomValue(validatedData.data.telecom, 'email'),
        website: detailsController.extractTelecomValue(validatedData.data.telecom, 'url'),
        petId: new mongoose.Types.ObjectId(validatedData?.data.subject?.reference.split('/')[1]),
      };

      const result: PetGroomer = await PetGroomerModel.create(groomerData);
      await pets.findOneAndUpdate(
        { _id: result.petId },
        { $set: { "summary.groomerStatus": "completed" } },
      );

      const fhirResponse = toFhirOrganizationGroomer(result);

      res.status(201).json({
        status: 1,
        message: 'Pet Groomer added successfully',
        vetGroomer: fhirResponse
      });

    } catch (error: unknown) {
      logger.error('error:', error)
      if (error instanceof ZodError) {
        res.status(200).json({
          status: 0,
          message: 'Invalid FHIR Organization data',
          errors: error.errors
        });
        return;
      }
      res.status(200).json({ status: 0, message: 'Internal Server Error' });
    }
  },

  getPetGroomerDetails: async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = getCognitoUserId(req)
      if (!userId) {
        res.status(200).json({ message: 'User ID is missing', })
        return
      }
      const petId = req.query.petId;

      if (typeof petId !== "string" || !mongoose.Types.ObjectId.isValid(petId)) {
        res.status(200).json({
          status: 0,
          message: "Invalid or missing pet Id",
        });
        return;
      }

      const petGroomersDetail: PetGroomerDocument[] | null = await PetGroomerModel.find({ userId: userId, petId: petId })
      if (!petGroomersDetail.length) {
        res.status(200).json({ message: 'No Vet Founded' })
      }
      const entries = petGroomersDetail.map((item) => toFhirOrganizationGroomer(item))
      res.status(200).json({
        data: entries
      })
    }
    catch (error) {
      const message = error instanceof Error ? error.message : 'An Error occurred'
      res.status(200).json({ status: 0, message: message })
    }
  },

  petBoarding: async (req: Request, res: Response): Promise<void> => {
    try {
      const body: unknown = req.body;
      const fhirdata = (typeof body === 'object' && body !== null && 'data' in body)
        ? (body as { data?: unknown }).data
        : undefined;
      const userId = getCognitoUserId(req);
      let parsedData: unknown;
      try {
        parsedData = typeof fhirdata === 'string' ? JSON.parse(fhirdata) : fhirdata;
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        res.status(400).json({
          message: "Invalid JSON format",
          error: errorMessage
        });
        return;
      }

      const validatedData = fhirOrganizationSchema.safeParse(parsedData);
      if (!validatedData.success) {
        res.status(400).json({
          message: "FHIR Validation Failed",
          errors: validatedData.error.issues
        });
        return;
      }

      const petboardingData: PetBoarding = {
        userId: userId,
        boardingName: validatedData.data.name,
        boardingAddress: validatedData.data.address?.[0]?.line?.[0] || '',
        city: validatedData.data.address?.[0]?.city || '',
        country: validatedData.data.address?.[0]?.country || '',
        zipCode: validatedData.data.address?.[0]?.postalCode || '',
        telephone: detailsController.extractTelecomValue(validatedData.data.telecom, 'phone'),
        emailAddess: detailsController.extractTelecomValue(validatedData.data.telecom, 'email'),
        website: detailsController.extractTelecomValue(validatedData.data.telecom, 'url'),
        petId: new mongoose.Types.ObjectId(validatedData?.data.subject?.reference.split('/')[1]),
      };

      const result: PetBoarding = await PetBoardingModel.create(petboardingData);
      await pets.findOneAndUpdate(
        { _id: result.petId },
        { $set: { "summary.boardingStatus": "completed" } },
      );
      const fhirResponse = toFhirOrganizationBoarding(result);

      res.status(201).json({
        status: 1,
        message: 'Pet Boarding added successfully',
        vetBoarding: fhirResponse
      });

    } catch (error: unknown) {
      if (error instanceof ZodError) {
        res.status(200).json({
          status: 0,
          message: 'Invalid FHIR Organization data',
          errors: error.errors
        });
        return;
      }
      res.status(200).json({ status: 0, message: 'Internal Server Error' });
    }
  },

  getPetBoardingDetails: async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = getCognitoUserId(req)
      if (!userId) {
        res.status(200).json({ message: 'User ID is missing', })
        return
      }
      const petId = req.query.petId;

      if (typeof petId !== "string" || !mongoose.Types.ObjectId.isValid(petId)) {
        res.status(200).json({
          status: 0,
          message: "Invalid or missing pet Id",
        });
        return;
      }

      const petBoardingsDetail: PetBoardingDocument[] | null = await PetBoardingModel.find({ userId: userId, petId: petId })
      if (!petBoardingsDetail.length) {
        res.status(200).json({ message: 'No Vet Founded' })
      }
      const entries = petBoardingsDetail.map((item) => toFhirOrganizationBoarding(item))
      res.status(200).json({
        data: entries
      })
    }
    catch (error) {
      const message = error instanceof Error ? error.message : 'An Error occurred'
      res.status(200).json({ status: 0, message: message })
    }
  },

  petSummaryDetails: async (req: Request, res: Response): Promise<void> => {
    try {
      const { petId } = req.params;
      const docs = await pets.findById(petId);
      if (!docs) {
        res.status(404).json({
          resourceType: "PainAssessment",
          issue: [{ severity: "error", code: "not-found", diagnostics: "Assessment not found" }]
        });
        return
      }
      const result = await convertToFhirSummary(docs);

      res.status(200).json(result);
    } catch (error: unknown) {
      if (error instanceof ZodError) {
        res.status(200).json({
          status: 0,
          message: 'Invalid FHIR Organization data',
          errors: error.errors
        });
        return;
      }
      res.status(200).json({ status: 0, message: 'Internal Server Error' });
    }
  }
};

export default detailsController;


