import pet from '../models/pet.model';
import helpers from '../utils/helpers';
import mongoose from 'mongoose';
import { handleMultipleFileUpload } from '../middlewares/upload';
import { IPet } from '@yosemite-crew/types';

class PetService {
  static async uploadFiles(files: unknown): Promise<unknown[]> {
    const fileArray = Array.isArray(files) ? files : [files];
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    return await handleMultipleFileUpload(fileArray, 'Images');
  }

  static async createPet(data: IPet): Promise<IPet> {
    const created = await pet.create({
      cognitoUserId: data.cognitoUserId,
      petType: data.petType,
      petBreed: data.petBreed,
      petName: data.petName,
      petdateofBirth: data.petdateofBirth,
      petGender: data.petGender,
      petAge: helpers.calculateAge(data.petdateofBirth).toString(),
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
      petImage: data.petImage,
    });
    return created.toObject() as IPet;
  }

  static async getPetsByUser(cognitoUserId: string, limit: number, offset: number): Promise<IPet[]> {
    const results = await pet.find({ cognitoUserId }).skip(offset).limit(limit);
    return results.map((p) => p.toObject() as IPet);
  }

  static async updatePetById(petId: string, data: Partial<IPet>): Promise<IPet | null> {
    const updated = await pet.findByIdAndUpdate(petId, data, { new: true });
    return updated ? (updated.toObject() as IPet) : null;
  }

  static async deletePetById(petId: string): Promise<unknown> {
    const objectId = new mongoose.Types.ObjectId(petId);
    const data = await pet.find({ _id: objectId });

    if (data.length === 0) {
      return null;
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

export default PetService;
