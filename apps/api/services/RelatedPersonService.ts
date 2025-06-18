const { petCoOwner } = require('../models/PetDuties');
const helpers = require('../utils/helpers');
import mongoose  from 'mongoose'; // for ObjectId validation

class RelatedPersonService {
  static async createPetCoOwner(fhirData :any, fileUrls :any, userId :string) {
    const firstName = fhirData.name?.[0]?.given?.[0] || '';
    const lastName = fhirData.name?.[0]?.family || '';
    const relationToPetOwner = fhirData.relationship?.[0]?.coding?.[0]?.display || 'Co-owner';

    const profileImage = fileUrls.map((file :any) => ({
      url: file.url,
      originalname: file.originalname,
      mimetype: file.mimetype
    }));

    const recordPayload = {
      firstName,
      lastName,
      relationToPetOwner,
      profileImage,
      createdBy: userId // optional if you add this field in schema
    }

    const record = await petCoOwner.create(recordPayload);
    return record;

  }

  static async handleDeletePetCoOwner(CoOwnerId :string) {
    const objectId = new mongoose.Types.ObjectId(CoOwnerId); 
    const data = await petCoOwner.find({ _id: objectId }); 
    if (data.length === 0) {
     return null; // Return null if not found
   }
   if (Array.isArray(data[0].profileImage) && data[0].profileImage.length > 0) {
     const profileImage = data[0].profileImage;

     for (const image of profileImage) {
       if (image.url) {
         await helpers.deleteFiles(image.url);
       }
     }
   }

   return await petCoOwner.deleteOne({ _id: { $eq: CoOwnerId } });
 }
}

module.exports = RelatedPersonService;
