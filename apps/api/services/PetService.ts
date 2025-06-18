const pet = require('../models/Pets');
const helpers = require('../utils/helpers');
import mongoose from 'mongoose';
const {  handleMultipleFileUpload } = require('../middlewares/upload'); // assuming you have this

class PetService {
  static async uploadFiles(files :any) {
    const fileArray = Array.isArray(files) ? files : [files];
    return await handleMultipleFileUpload(fileArray,'Images');
  }

  static async createPet(data :any) {
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

static async getPetsByUser(cognitoUserId :string, limit :number, offset: number) {
    return pet.find({ cognitoUserId })
      .skip(offset)
      .limit(limit);
  }
static async updatePetById(petId :string, data :any) {
    return await pet.findByIdAndUpdate(petId, data, { new: true });
  }
  
static async deletePetById(petId :string) {
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
