import mongoose, {Schema, Model} from 'mongoose';
import type { SharedPetDuties } from "@yosemite-crew/types";

const sharedSchema = new Schema<SharedPetDuties>({
  petId: { type: String, required: true },
  userId: { type: String, required: true },
  ownerId: { type: String, required: true },
  taskName: String,
  taskDate: Date,
  taskTime: String,
  repeatTask: String,
  taskReminder: String,
  syncWithCalendar: { type: Boolean, default: false },
}, { timestamps: true });

const sharedRecord : Model<SharedPetDuties> = mongoose.model<SharedPetDuties>('SharedPetDuties',sharedSchema);
export default sharedRecord;
