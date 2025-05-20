const pet = require('../models/Pets');
const helpers = require('../utils/helpers');
const { mongoose } = require('mongoose');
const {  handleMultipleFileUpload } = require('../middlewares/upload'); // assuming you have this

class PetService {
  static async uploadFiles(files) {
    const fileArray = Array.isArray(files) ? files : [files];
    return await handleMultipleFileUpload(fileArray,'Images');
  }

  static async createPet(data) {
    return await pet.create({
      cognitoUserId: data.cognitoUserId,
      petType: data.petType,
      petBreed: data.petBreed,
      petName: data.petName,
      petdateofBirth: data.petdateofBirth,
      petGender: data.petGender,
      petAge: await helpers.calculateAge(data.petdateofBirth),
      petCurrentWeight: data.petCurrentWeight,
      petColor: data.petColor,
      petBloodGroup: data.petBloodGroup,
      isNeutered: data.isNeutered,
      ageWhenNeutered: data.ageWhenNeutered,
      microChipNumber: data.microChipNumber,
      isInsured: data.isInsured,
      insuranceCompany: data.insuranceCompany,
      policyNumber: data.policyNumber,
      passportNumber: data.passportNumber,
      petFrom: data.petFrom,
      petImage: data.petImage
    });
  }

static async getPetsByUser(cognitoUserId, limit, offset) {
    return pet.find({ cognitoUserId })
      .skip(parseInt(offset))
      .limit(parseInt(limit));
  }
static async updatePetById(petId, data) {
    return await pet.findByIdAndUpdate(petId, data, { new: true });
  }
  
static async deletePetById(petId) {
     const objectId = new mongoose.Types.ObjectId(petId); 
     const data = await pet.find({ _id: objectId }); 
     if (data.length === 0) {
      return null; // Return null if not found
    }
    if (Array.isArray(data[0].petImage) && data[0].petImage.length > 0) {
      const petImage = data[0].petImage;

      for (const image of petImage) {
        if (image.url) {
          await helpers.deleteFiles(image.url);
        }
      }
    }

    return await pet.deleteOne({ _id: { $eq: petId } });
  }

}

module.exports = PetService;
