const Vaccination = require('../models/vaccination');
const FhirImmunizationValidator = require('../validators/FhirImmunizationValidator');
const { mongoose } = require('mongoose');

class VaccinationService {
  static async saveFhirImmunization(data, fileName = "",cognitoUserId) {
    // Validate FHIR structure
    const { valid, error } = FhirImmunizationValidator.validate(data);
    if (!valid) {
      throw new Error(error);
    }

    // Transform FHIR to Mongo model
    const transformed = {     
      userId:cognitoUserId,
      petId: data.patient.reference.replace('Pet/', ''),
      manufacturerName: data.manufacturer.display,
      vaccineName: data.vaccineCode.text,
      batchNumber: data.lotNumber,
      expiryDate: data.expirationDate,
      vaccinationDate: data.occurrenceDateTime,
      hospitalName: data.performer?.[0]?.actor?.display || '',
      nextdueDate: data.note?.[0]?.text.replace('Next due date: ', '') || null,
      vaccineImage: fileName
    };

    // Save to MongoDB
    const saved = await Vaccination.create(transformed);
    return saved;
  }
  static async getVaccinationsByUserId(userId, limit = 10, offset = 0, petId = null) {
    // Sanitize limit and offset
    limit = parseInt(limit);
    offset = parseInt(offset);
    if (isNaN(limit) || limit < 0) limit = 10;
    if (isNaN(offset) || offset < 0) offset = 0;
  
    const query = { userId }; // Assuming userId is a safe string (e.g., from JWT or trusted source)
  
    // Validate and convert petId if provided
    if (petId && mongoose.Types.ObjectId.isValid(petId)) {
      query.petId = new mongoose.Types.ObjectId(petId);
    }
  
    const records = await Vaccination.find(query)
      .skip(offset)
      .limit(limit);
  
    return records;
  }

  static async updateVaccinationFromFHIR(id, fileName = null, fhirData) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error("Invalid ID format");
    }
  
    const updatedData = {
      vaccineName: fhirData.vaccineCode?.text || fhirData.vaccineCode?.coding?.[0]?.display,
      manufacturerName: fhirData.manufacturer?.display,
      batchNumber: fhirData.lotNumber,
      expiryDate: fhirData.expirationDate,
      vaccinationDate: fhirData.occurrenceDateTime,
      hospitalName: fhirData.location?.display,
      nextdueDate: fhirData.note?.[0]?.text?.replace("Next due date: ", "")
    };
  
    if (fileName) {
      // Use $push operator to add fileName to vaccineImage array
      return await Vaccination.findOneAndUpdate(
        { _id: id },
        {
          $set: updatedData,
          $push: { vaccineImage: fileName }
        },
        { new: true }
      );
    } else {
      return await Vaccination.findOneAndUpdate(
        { _id: id },
        { $set: updatedData },
        { new: true }
      );
    }
  }

  static async deleteVaccinationRecord(id) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error("Invalid Vaccination ID");
    }
    const objectId = new mongoose.Types.ObjectId(id); 
    return await Vaccination.deleteOne({ _id: objectId });
  }

  static async getRecentVaccinationsReocrds(userId, limit = 10, offset = 0) {
    if (typeof userId !== 'string' || userId.trim() === '') {
      throw new Error("Invalid userId");
    }
    const sanitizedUserId = userId.trim();
    limit = parseInt(limit, 10);
    offset = parseInt(offset, 10);
    if (isNaN(limit) || limit < 0 || limit > 100) limit = 10;
    if (isNaN(offset) || offset < 0) offset = 0;
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
  
    const query = {
      userId: sanitizedUserId,
      vaccinationDate: { $lt: today },
    };
  
    const records = await Vaccination.find(query)
      .sort({ vaccinationDate: -1 })
      .skip(offset)
      .limit(limit);
  
    return records;
  }
  

  
  
  static convertToFHIR(data) {
  
    const fhirData = {
      resourceType: "Immunization",
      status: "completed",
      vaccineCode: {
        coding: [
          {
            system: "http://hl7.org/fhir/sid/cvx",
            code: data.vaccineName,
            display: data.vaccineName
          }
        ],
        text: data.vaccineName
      },
      manufacturer: {
        display: data.manufacturerName
      },
      lotNumber: data.batchNumber,
      expirationDate: data.expiryDate,
      occurrenceDateTime: data.vaccinationDate,
      primarySource: true,
      location: {
        display: data.hospitalName
      },
      note: [
        {
          text: `Next due date: ${data.nextdueDate}`
        }
      ]
    };
  
    // Check if vaccineImage is an array and has items
    if (Array.isArray(data.vaccineImage) && data.vaccineImage.length > 0) {
      fhirData.extension = data.vaccineImage.map((image) => ({
        url: "http://example.org/fhir/StructureDefinition/vaccineImage",
        extension: [
          { url: "url", valueUrl: image.url },
          { url: "name", valueString: image.originalname },
          { url: "type", valueString: image.mimetype }
        ]
      }));
    }
  
    return fhirData;
  }
  

 
  
}

module.exports = VaccinationService;
