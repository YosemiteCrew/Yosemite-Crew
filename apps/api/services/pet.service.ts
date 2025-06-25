import mongoose from 'mongoose';
import Pet from '../models/pet.model';
import { helpers } from '../utils/helpers';
import type { IPet } from "@yosemite-crew/types"


const PetService = {
 createPet: async (data: IPet) => {
  const age = helpers.calculateAge(data.petdateofBirth); // Now TypeScript knows it's a number
  return await Pet.create({
    ...data,
    petAge: age,
  });
},

  getPetsByUser: async (cognitoUserId: string, limit: number, offset: number) => {
    return Pet.find({ cognitoUserId })
      .skip(offset)
      .limit(limit);
  },

  updatePetById: async (petId: string, data: Partial<PetData>) => {
    return await Pet.findByIdAndUpdate(petId, data, { new: true });
  },

  deletePetById: async (petId: string) => {
    const objectId = new mongoose.Types.ObjectId(petId);
    const data = await Pet.find({ _id: objectId });

    if (data.length === 0) {
      return null;
    }

    const petImage = data[0].petImage;
    if (Array.isArray(petImage) && petImage.length > 0) {
      for (const image of petImage) {
        if (image.url) {
          await helpers.deleteFiles(image.url);
        }
      }
    }

    return await Pet.deleteOne({ _id: objectId });
  }
};

export default PetService;
