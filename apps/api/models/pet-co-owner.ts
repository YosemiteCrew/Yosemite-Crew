import mongoose, {Schema, Model} from 'mongoose';
import { PetCoOwner } from "@yosemite-crew/types";

const petCoOwnerSchema = new Schema<PetCoOwner>({
  firstName: String,
  lastName: String,
  relationToPetOwner: String,
  createdBy: String,
  profileImage: [
    {
      url: String,
      originalname: String,
      mimetype: String,
    }
  ]
}, { timestamps: true });

const petCoOwner : Model<PetCoOwner> = mongoose.model<PetCoOwner>('petCoOwner',petCoOwnerSchema);
export default petCoOwner;
