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
  static async getVaccinationsByUserId(userId) {
    const records = await Vaccination.find({ userId: { $eq: userId } });
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
  
  static convertToFHIR(data) {
    console.log(data.vaccineImage);
  
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
