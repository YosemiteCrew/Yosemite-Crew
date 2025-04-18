const pet = require('../models/YoshPet');
const helpers = require('../utils/helpers');
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
    return await pet.deleteOne({ _id: petId });
  }

}

module.exports = PetService;
