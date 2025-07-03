import { Request, Response } from 'express';
import { Types } from 'mongoose';
import  mongoose  from 'mongoose';
import { validate,toFHIRBundleImmunization,VaccinationDoc } from '@yosemite-crew/fhir'; // ✅ right
import { BasicImmunizationResource, TransformedVaccination } from '@yosemite-crew/types'; // ✅ right
import Vaccination  from '../models/Vaccination';
import helpers from '../utils/helpers';
import { getCognitoUserId }  from  '../middlewares/authMiddleware';
import { UploadedFile } from 'express-fileupload';

const immunizationController =  {
  createImmunization: async(req: Request, res: Response): Promise<void> => {
    try {
      const body: unknown = req.body;
      let rawData: unknown;
      if (typeof body === 'object' && body !== null && 'data' in body) {
        rawData = (body as { data: unknown }).data;
      } else {
        rawData = body;
      }
     const fhirData: Partial<BasicImmunizationResource> = typeof rawData === 'string'
  ? (JSON.parse(rawData) as Partial<BasicImmunizationResource>)
  : (rawData as Partial<BasicImmunizationResource>);

      const { valid, error } = validate(fhirData);
      if (!valid) {
         res.status(200).json({ status: 0, error: error });
      }

      let fileArray: unknown[] = [];
      if (req.files) {
        if (Array.isArray(req.files)) {
          fileArray = req.files;
        } else if (typeof req.files === 'object') {
          // If multer is configured with fields, req.files is an object: { fieldname: File[] }
          // Try to get all files from all fields
          fileArray = Object.values(req.files).flat();
        }
      }

      const vaccineFileUrl = fileArray.length > 0
        ? await helpers.uploadFiles(fileArray as unknown as UploadedFile[])
        : [];

      const cognitoUserId = getCognitoUserId(req);

    const transformed: TransformedVaccination = {     
          userId: cognitoUserId,
          petId: fhirData.patient?.reference?.replace(/^.*\//, '') ?? '',
          manufacturerName: fhirData.manufacturer?.display ?? '',
          vaccineName: fhirData.vaccineCode?.text ?? '',
          batchNumber: fhirData.lotNumber ?? '',
          expiryDate: fhirData.expirationDate ?? '',
          vaccinationDate: fhirData.occurrenceDateTime ?? '',
          hospitalName: fhirData.performer?.[0]?.actor?.display ?? '',
          nextdueDate:
            fhirData.note?.find(n => n.text?.startsWith('Next due'))?.text?.replace('Next due: ', '') ?? null,
          vaccineImage: vaccineFileUrl, // must match VaccineImageFile[] type
          reminder:
            fhirData.extension?.find(e => e.url?.includes('immunization-reminder'))?.valueBoolean ?? false
    };

    // Save to MongoDB
    const saved = await Vaccination.create(transformed);
      if (!saved) {
        res.status(200).json({ status: 0, message: 'Failed to save vaccination record' });
      }else{
       res.status(200).json({
        status: 1,
        message: 'Vaccination record added successfully',
      });
       }
    } catch (error: unknown) {
       const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
       res.status(200).json({ status: 0, error: errorMessage });
    }
  },

  getVaccination: async(req: Request, res: Response): Promise<void> => {
    try {
      const userId = getCognitoUserId(req);
      let limit = parseInt(req.query.limit as string) || 10;
      let offset = parseInt(req.query.offset as string) || 0;
      const petId = req.query.petId as string;
       const query: Record<string, unknown> = { userId }; // Assuming userId is a safe string (e.g., from JWT or trusted source)

      // Sanitize limit and offset
      if (isNaN(limit) || limit < 0) limit = 10;
      if (isNaN(offset) || offset < 0) offset = 0; 

      // Validate and convert petId if provided
      if (petId && mongoose.Types.ObjectId.isValid(petId)) {
        query.petId = new mongoose.Types.ObjectId(petId);
      }
      // Fetch vaccination records
      const results = await Vaccination.find(query).skip(offset).limit(limit);
      if (results.length === 0) {
        res.status(200).json({ status: 0, message: 'No vaccination record found for this user' });
      }
      // Convert to FHIR Bundle
      const transformed: VaccinationDoc[] = results.map((doc) => ({
          _id: doc._id,
          petId: doc.petId,
          vaccineName: doc.vaccineName || '',
          batchNumber: doc.batchNumber || '',
          manufacturerName: doc.manufacturerName || '',
          vaccinationDate: doc.vaccinationDate?.toISOString() || '',
          hospitalName: doc.hospitalName || '',
          nextdueDate: doc.nextdueDate?.toISOString() || '',
          expiryDate: doc.expiryDate?.toISOString() || '',
          reminder: doc.reminder ?? false,
          vaccineImage: doc.vaccineImage || []
        }));
      const fhirBundle = toFHIRBundleImmunization(transformed);
       res.status(200).json({ status: 1, data: fhirBundle });
    } catch (err: unknown) {
      console.error(err);
       res.status(500).json({ status: 0, message: 'Internal Server Error' });
    }
  },

  editVaccination: async (req: Request, res: Response): Promise<void> => {
    try {
      const fhirData: unknown = (typeof req.body === 'object' && req.body !== null && 'data' in req.body)
        ? (req.body as { data?: unknown }).data
        : undefined;
      const id = req.query.recordId as string;
      if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error("Invalid ID format");
      }
      let parsedData: unknown;
      try {
        parsedData = JSON.parse(fhirData as string);
      } catch {
        res.status(200).json({ status: 0, message: 'Invalid FHIR JSON data' });
        return;
      }

       let fileArray: unknown[] = [];
      if (req.files) {
        if (Array.isArray(req.files)) {
          fileArray = req.files;
        } else if (typeof req.files === 'object') {
          // If multer is configured with fields, req.files is an object: { fieldname: File[] }
          // Try to get all files from all fields
          fileArray = Object.values(req.files).flat();
        }
      }

      const vaccineFileUrl = fileArray.length > 0
        ? await helpers.uploadFiles(fileArray as unknown as UploadedFile[])
        : [];
      const typedFhirData = parsedData as Partial<BasicImmunizationResource>;
      const updatedData = {
      vaccineName: typedFhirData.vaccineCode?.text || typedFhirData.vaccineCode?.coding?.[0]?.display,
      manufacturerName: typedFhirData.manufacturer?.display,
      batchNumber: typedFhirData.lotNumber,
      expiryDate: typedFhirData.expirationDate,
      vaccinationDate: typedFhirData.occurrenceDateTime,
      hospitalName: (typedFhirData.location && typeof typedFhirData.location === 'object' && 'display' in typedFhirData.location)
        ? (typedFhirData.location as { display?: string }).display
        : undefined,
      nextdueDate: typedFhirData.note?.[0]?.text?.replace("Next due date: ", ""),
      reminder: typedFhirData.extension?.[0]?.valueBoolean ?? false
    };
  
    let updatedVaccination;
            if (vaccineFileUrl && vaccineFileUrl.length > 0) {
          const fileObjects = vaccineFileUrl.map((filePath: unknown) => {
            const url = typeof filePath === 'string' ? filePath : '';
            return {
              url,
              mimetype: 'application/pdf', // or derive dynamically if needed
              originalname: typeof url === 'string' && url.split('/').length > 0
                ? url.split('/').pop() || 'file.pdf'
                : 'file.pdf',
            };
          });

          updatedVaccination = await Vaccination.findOneAndUpdate(
            { _id: id },
            {
              $set: updatedData,
              $push: { vaccineImage: { $each: fileObjects } }
            },
            { new: true }
          );
        } else {
          updatedVaccination = await Vaccination.findOneAndUpdate(
            { _id: id },
            { $set: updatedData },
            { new: true }
          );
        }
    if (!updatedVaccination) {
      res.status(200).json({ status: 0, message: 'Vaccination record not found' });
      return;
    }

    const vaccinationDoc: VaccinationDoc = {
      _id: updatedVaccination._id,
      petId: updatedVaccination.petId,
      vaccineName: updatedVaccination.vaccineName || '',
      batchNumber: updatedVaccination.batchNumber || '',
      manufacturerName: updatedVaccination.manufacturerName || '',
      vaccinationDate: updatedVaccination.vaccinationDate ? updatedVaccination.vaccinationDate.toISOString() : '',
      hospitalName: updatedVaccination.hospitalName || '',
      nextdueDate: updatedVaccination.nextdueDate
        ? (updatedVaccination.nextdueDate instanceof Date
            ? updatedVaccination.nextdueDate.toISOString()
            : updatedVaccination.nextdueDate || '')
        : '',
      expiryDate: updatedVaccination.expiryDate
        ? (updatedVaccination.expiryDate instanceof Date
            ? updatedVaccination.expiryDate.toISOString()
            : updatedVaccination.expiryDate || '')
        : '',
      reminder: updatedVaccination.reminder ?? false,
      vaccineImage: updatedVaccination.vaccineImage || []
    };

    const fhirResponse = toFHIRBundleImmunization([vaccinationDoc]);

    res.status(200).json({ status: 1, data: fhirResponse });
    return;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(200).json({ status: 0, message: 'Error updating vaccination record', error: errorMessage });
      return;
    }
  },

  deleteVaccinationRecord: async(req: Request, res: Response): Promise<void> =>{
    try {
      const id = req.query.recordId as string;

      if (!Types.ObjectId.isValid(id)) {
        res.status(200).json({ status: 0, message: 'Invalid Vaccination ID' });
      }
      const objectId = new mongoose.Types.ObjectId(id); 
      const data = await Vaccination.find({ _id: objectId });  
      if (data.length === 0) {
       res.status(200).json({ status: 0, message: 'Vaccination record not found' });
      }
    
      if (Array.isArray(data[0].vaccineImage) && data[0].vaccineImage.length > 0) {
        const vaccineImage = data[0].vaccineImage;

        for (const image of vaccineImage) {
          if (image.url) {
            await helpers.deleteFiles(image.url);
          }
        }
      }
      const result = await Vaccination.deleteOne({ _id: objectId });

      if (result.deletedCount === 0) {
         res.status(200).json({ status: 0, message: 'Could not be deleted' });
      }

       res.status(200).json({ status: 1, message: 'Vaccination record deleted successfully' });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
       res.status(200).json({ status: 0, message: errorMessage });
    }
  },

  recentVaccinationRecord: async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = getCognitoUserId(req);
       if (typeof userId !== 'string' || userId.trim() === '') {
       res.status(200).json({ status: 0, message: 'Invalid userId' });
    }
      let limit = parseInt(req.query.limit as string) || 10;
      let offset = parseInt(req.query.offset as string) || 0;
      if (isNaN(limit) || limit < 0 || limit > 100) limit = 10;
      if (isNaN(offset) || offset < 0) offset = 0;
       const sanitizedUserId = userId.trim();
       const today = new Date();
       today.setUTCHours(0, 0, 0, 0);
        const query = {
          userId: sanitizedUserId,
          vaccinationDate: { $lt: today },
        };

        const results = await Vaccination.find(query).sort({ vaccinationDate: -1 }).skip(offset).limit(limit);
     
      if (results.length === 0) {
         res.status(200).json({ status: 0, message: 'No vaccination record found for this user' });
      }

      const transformed: VaccinationDoc[] = results.map((doc) => ({
        _id: doc._id,
        petId: doc.petId,
        vaccineName: doc.vaccineName || '',
        batchNumber: doc.batchNumber || '',
        manufacturerName: doc.manufacturerName || '',
        vaccinationDate: doc.vaccinationDate ? doc.vaccinationDate.toISOString() : '',
        hospitalName: doc.hospitalName || '',
        nextdueDate: doc.nextdueDate
          ? (doc.nextdueDate instanceof Date
              ? doc.nextdueDate.toISOString()
              : doc.nextdueDate || '')
          : '',
        expiryDate: doc.expiryDate
          ? (doc.expiryDate instanceof Date
              ? doc.expiryDate.toISOString()
              : doc.expiryDate || '')
          : '',
        reminder: doc.reminder ?? false,
        vaccineImage: doc.vaccineImage || []
      }));
      const fhirBundle = toFHIRBundleImmunization(transformed);
       res.status(200).json({ status: 1, data: fhirBundle });
    } catch (err: unknown) {
      console.error(err);
       res.status(500).json({ status: 0, message: 'Internal Server Error' });
    }
  }
}

export default immunizationController;
