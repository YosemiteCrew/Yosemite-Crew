const diabetesRecords = require('../models/Records');
const { mongoose } = require('mongoose');
const helpers = require('../utils/helpers');

class DiabetesService {
    /**
     * Create a diabetes record in the database.
     * @param {Object} parsedData - FHIR-parsed data (petId, vetId, recordDate, etc.)
     * @param {Array} [images=[]] - Optional array of uploaded image objects (filename, path)
     * @param {String|null} userId - Authenticated user ID
     * @returns {Promise<Object>} Created record
     */
    static async createDiabetesRecord(parsedData :any, images = [], userId = null) {
      const recordPayload = {
        ...parsedData,
        userId,
        ...(images.length > 0 && { bodyCondition: images })
      };
  
      const record = await diabetesRecords.create(recordPayload);
      return record;
    }

    static async getDiabetesLogs(userId :string,limit = 10, offset = 0) {
        return await diabetesRecords.find({ userId : {$eq: userId }}).skip(offset)
        .limit(limit);
      }
 
    static async deleteDiabetesLogRecord(id :string) {
        const objectId = new mongoose.Types.ObjectId(id); 
        const data = await diabetesRecords.find({ _id: objectId });
      
        if (data.length === 0) {
          return null; // Return null if not found
        }
      
        if (Array.isArray(data[0].bodyCondition) && data[0].bodyCondition.length > 0) {
          const bodyCondition = data[0].bodyCondition;
      
          for (const condition of bodyCondition) {
            if (condition.url) {
              await helpers.deleteFiles(condition.url);
            }
          }
        }
      
        return await diabetesRecords.deleteOne({ _id: objectId });
      }
  }
  
  module.exports = DiabetesService;